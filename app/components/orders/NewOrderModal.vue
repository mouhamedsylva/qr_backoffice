<script setup lang="ts">
/** Saisie d'une commande par le personnel (CMD-12). */
import type { DiningTable, MenuItem, Order, OrderMode, Paginated } from '~/types/api';

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ created: [order: Order] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const orders = useOrdersStore();
const toast = useToast();
const { money } = useMoney();

interface Line {
  key: number;
  item: MenuItem;
  quantity: number;
  /** Options choisies, par groupe. */
  selected: Record<string, string[]>;
  notes: string;
}

const mode = ref<OrderMode>('DINE_IN');
const tableId = ref<string | undefined>();
const customerName = ref('');
const notes = ref('');
const search = ref('');
const lines = ref<Line[]>([]);
const submitting = ref(false);
let nextKey = 1;

const menuItems = ref<MenuItem[]>([]);
const tables = ref<DiningTable[]>([]);
const loading = ref(false);

watch(open, async (isOpen) => {
  if (!isOpen) return;
  reset();
  loading.value = true;
  try {
    const [items, tbls] = await Promise.all([
      api<Paginated<MenuItem>>(`${restaurant.base}/menu/items`, { query: { isActive: true, limit: 100 } }),
      restaurant.can('tables.view') ? api<DiningTable[]>(`${restaurant.base}/tables`, { silent: true }).catch(() => []) : [],
    ]);
    menuItems.value = items.data;
    tables.value = tbls;
  } finally {
    loading.value = false;
  }
});

function reset() {
  mode.value = 'DINE_IN';
  tableId.value = undefined;
  customerName.value = '';
  notes.value = '';
  search.value = '';
  lines.value = [];
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return menuItems.value.filter((i) => !q || i.name.toLowerCase().includes(q));
});

const tableItems = computed(() =>
  tables.value.map((t) => ({ label: `Table ${t.label}${t.zone ? ` · ${t.zone.name}` : ''}`, value: t.id })),
);

function add(item: MenuItem) {
  if (!item.available) return;
  // Article sans option déjà présent : on augmente la quantité.
  const existing = !item.optionGroups.length && lines.value.find((l) => l.item.id === item.id);
  if (existing) {
    existing.quantity++;
    return;
  }
  const selected: Record<string, string[]> = {};
  for (const g of item.optionGroups) {
    // Groupe obligatoire à choix unique : première option disponible présélectionnée.
    const first = g.options.find((o) => o.isAvailable);
    selected[g.id] = g.isRequired && g.maxSelect === 1 && first ? [first.id] : [];
  }
  lines.value.push({ key: nextKey++, item, quantity: 1, selected, notes: '' });
}

function lineTotal(line: Line) {
  const deltas = line.item.optionGroups
    .flatMap((g) => g.options.filter((o) => line.selected[g.id]?.includes(o.id)))
    .reduce((s, o) => s + o.priceDelta, 0);
  return (line.item.priceAmount + deltas) * line.quantity;
}

const total = computed(() => lines.value.reduce((s, l) => s + lineTotal(l), 0));

function groupError(line: Line, groupId: string) {
  const g = line.item.optionGroups.find((x) => x.id === groupId)!;
  const n = line.selected[g.id]?.length ?? 0;
  const min = Math.max(g.minSelect, g.isRequired ? 1 : 0);
  if (n < min) return `Choisissez au moins ${min} option(s)`;
  if (g.maxSelect && n > g.maxSelect) return `${g.maxSelect} option(s) maximum`;
  return undefined;
}

const valid = computed(
  () =>
    lines.value.length > 0 &&
    (mode.value === 'TAKEAWAY' || !!tableId.value || !tables.value.length) &&
    lines.value.every((l) => l.item.optionGroups.every((g) => !groupError(l, g.id))),
);

async function submit() {
  if (!valid.value) return;
  submitting.value = true;
  try {
    const order = await api<Order>(`${restaurant.base}/orders`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: {
        mode: mode.value,
        ...(mode.value === 'DINE_IN' && tableId.value && { tableId: tableId.value }),
        items: lines.value.map((l) => ({
          menuItemId: l.item.id,
          quantity: l.quantity,
          optionIds: Object.values(l.selected).flat(),
          ...(l.notes.trim() && { notes: l.notes.trim() }),
        })),
        ...(customerName.value.trim() && { customerName: customerName.value.trim() }),
        ...(notes.value.trim() && { notes: notes.value.trim() }),
      },
    });
    orders.upsert(order);
    toast.add({ title: `Commande n°${order.number} créée`, color: 'success', icon: 'i-lucide-check' });
    open.value = false;
    emit('created', order);
  } catch {
    // erreur déjà notifiée
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Nouvelle commande"
    description="Saisie en salle ou au comptoir, pour un client sans téléphone."
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <div class="grid gap-6 md:grid-cols-2">
        <!-- Choix des articles -->
        <div class="flex min-h-0 flex-col gap-3">
          <UInput v-model="search" icon="i-lucide-search" placeholder="Rechercher un article…" autofocus />
          <div class="max-h-96 space-y-1 overflow-y-auto pe-1">
            <template v-if="loading">
              <USkeleton v-for="n in 6" :key="n" class="h-11 w-full" />
            </template>
            <p v-else-if="!filtered.length" class="py-6 text-center text-sm text-muted">Aucun article trouvé.</p>
            <button
              v-for="item in filtered"
              v-else
              :key="item.id"
              type="button"
              :disabled="!item.available"
              class="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-start transition hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
              @click="add(item)"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium">{{ item.name }}</span>
                <span v-if="!item.available" class="text-xs text-error">Épuisé</span>
                <span v-else-if="item.optionGroups.length" class="text-xs text-muted">Avec options</span>
              </span>
              <span class="tabular shrink-0 text-sm text-muted">{{ money(item.priceAmount) }}</span>
            </button>
          </div>
        </div>

        <!-- Panier -->
        <div class="flex flex-col gap-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField label="Mode">
              <USelect
                v-model="mode"
                class="w-full"
                :items="[
                  { label: 'Sur place', value: 'DINE_IN' },
                  { label: 'À emporter', value: 'TAKEAWAY' },
                ]"
              />
            </UFormField>
            <UFormField v-if="mode === 'DINE_IN' && tables.length" label="Table" required>
              <USelectMenu
                v-model="tableId"
                class="w-full"
                :items="tableItems"
                value-key="value"
                placeholder="Choisir"
                :search-input="{ placeholder: 'Filtrer…' }"
              />
            </UFormField>
            <UFormField v-else label="Nom du client">
              <UInput v-model="customerName" class="w-full" placeholder="Facultatif" />
            </UFormField>
          </div>

          <UEmpty
            v-if="!lines.length"
            icon="i-lucide-shopping-basket"
            title="Panier vide"
            description="Cliquez sur un article pour l'ajouter."
            variant="naked"
            class="py-6"
          />
          <ul v-else class="max-h-80 space-y-3 overflow-y-auto pe-1">
            <li v-for="(line, index) in lines" :key="line.key" class="rounded-lg border border-default p-3">
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ line.item.name }}</span>
                <UInputNumber v-model="line.quantity" :min="1" :max="99" size="xs" class="w-24" />
                <span class="tabular w-20 text-right text-sm">{{ money(lineTotal(line)) }}</span>
                <UButton
                  icon="i-lucide-trash-2"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  aria-label="Retirer"
                  @click="lines.splice(index, 1)"
                />
              </div>
              <div v-for="g in line.item.optionGroups" :key="g.id" class="mt-2">
                <UFormField :label="g.name" :required="g.isRequired" :error="groupError(line, g.id)" size="xs">
                  <URadioGroup
                    v-if="g.maxSelect === 1"
                    :model-value="line.selected[g.id]?.[0]"
                    orientation="horizontal"
                    size="xs"
                    :items="g.options.map((o) => ({ label: o.priceDelta ? `${o.name} (+${money(o.priceDelta)})` : o.name, value: o.id, disabled: !o.isAvailable }))"
                    @update:model-value="(v) => (line.selected[g.id] = v ? [String(v)] : [])"
                  />
                  <UCheckboxGroup
                    v-else
                    v-model="line.selected[g.id]"
                    orientation="horizontal"
                    size="xs"
                    :items="g.options.map((o) => ({ label: o.priceDelta ? `${o.name} (+${money(o.priceDelta)})` : o.name, value: o.id, disabled: !o.isAvailable }))"
                  />
                </UFormField>
              </div>
              <UInput v-model="line.notes" size="xs" class="mt-2 w-full" placeholder="Note (ex. sans oignon)" />
            </li>
          </ul>

          <UTextarea v-model="notes" :rows="2" placeholder="Note pour la cuisine (facultatif)" class="w-full" />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <p class="text-sm">
          Total : <strong class="tabular text-highlighted">{{ money(total) }}</strong>
        </p>
        <div class="flex gap-2">
          <UButton color="neutral" variant="ghost" label="Annuler" @click="open = false" />
          <UButton icon="i-lucide-send" label="Envoyer en cuisine" :disabled="!valid" :loading="submitting" @click="submit" />
        </div>
      </div>
    </template>
  </UModal>
</template>
