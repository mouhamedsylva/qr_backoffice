<script setup lang="ts">
/** Création d'une table, d'une série de tables, ou modification (TAB-01, TAB-02). */
import type { DiningTable, Zone } from '~/types/api';

const props = defineProps<{ table?: DiningTable | null; zones: Zone[]; defaultZoneId?: string | null }>();
const emit = defineEmits<{ close: [saved: boolean] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();

const editing = props.table ?? null;
const mode = ref<'single' | 'bulk'>('single');
const modes = [
  { label: 'Une table', value: 'single', icon: 'i-lucide-square' },
  { label: 'Plusieurs tables', value: 'bulk', icon: 'i-lucide-layout-grid' },
];

const zoneItems = computed(() => [{ label: 'Sans zone', value: null }, ...props.zones.map((z) => ({ label: z.name, value: z.id }))]);

const single = reactive({
  label: editing?.label ?? '',
  zoneId: editing ? (editing.zone?.id ?? null) : (props.defaultZoneId ?? null),
  capacity: editing?.capacity ?? (4 as number | null),
  kind: editing?.kind ?? ('TABLE' as DiningTable['kind']),
});
const bulk = reactive({ prefix: 'T', from: 1, to: 10, zoneId: props.defaultZoneId ?? null as string | null, capacity: 4 as number | null });

const bulkCount = computed(() => Math.max(0, bulk.to - bulk.from + 1));
const bulkPreview = computed(() => {
  if (bulkCount.value <= 0) return '';
  const first = `${bulk.prefix}${bulk.from}`;
  const last = `${bulk.prefix}${bulk.to}`;
  return bulkCount.value === 1 ? first : `${first}, ${bulk.prefix}${bulk.from + 1}${bulkCount.value > 2 ? ' … ' + last : ''}`;
});

const valid = computed(() =>
  mode.value === 'single' ? single.label.trim().length > 0 : bulkCount.value > 0 && bulkCount.value <= 200,
);

const saving = ref(false);
async function submit() {
  if (!valid.value) return;
  saving.value = true;
  try {
    if (editing) {
      await api(`${restaurant.base}/tables/${editing.id}`, {
        method: 'PATCH',
        body: { label: single.label.trim(), zoneId: single.zoneId, capacity: single.capacity ?? undefined, kind: single.kind },
      });
      toast.add({ title: 'Table modifiée', color: 'success', icon: 'i-lucide-check' });
    } else if (mode.value === 'single') {
      await api(`${restaurant.base}/tables`, {
        method: 'POST',
        body: {
          label: single.label.trim(),
          ...(single.zoneId && { zoneId: single.zoneId }),
          ...(single.capacity && { capacity: single.capacity }),
          kind: single.kind,
        },
      });
      toast.add({ title: `Table ${single.label} créée`, description: 'Son QR code est prêt.', color: 'success', icon: 'i-lucide-check' });
    } else {
      await api(`${restaurant.base}/tables/bulk`, {
        method: 'POST',
        body: {
          prefix: bulk.prefix,
          from: bulk.from,
          to: bulk.to,
          ...(bulk.zoneId && { zoneId: bulk.zoneId }),
          ...(bulk.capacity && { capacity: bulk.capacity }),
        },
      });
      toast.add({ title: `${bulkCount.value} tables créées`, color: 'success', icon: 'i-lucide-check' });
    }
    emit('close', true);
  } catch {
    // erreur déjà notifiée (ex. TABLE_LABEL_TAKEN, PLAN_LIMIT_REACHED)
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal :title="editing ? `Modifier la table ${editing.label}` : 'Ajouter des tables'" @update:open="(o) => !o && emit('close', false)">
    <template #body>
      <form id="table-form" class="space-y-4" @submit.prevent="submit">
        <UTabs v-if="!editing" v-model="mode" :items="modes" :content="false" size="sm" class="w-full" />

        <template v-if="mode === 'single' || editing">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Numéro ou nom" required>
              <UInput v-model="single.label" autofocus class="w-full" placeholder="Ex. 12, Terrasse 3, Bar" />
            </UFormField>
            <UFormField label="Type">
              <USelect
                v-model="single.kind"
                class="w-full"
                :items="[
                  { label: 'Table', value: 'TABLE' },
                  { label: 'Comptoir', value: 'COUNTER' },
                ]"
              />
            </UFormField>
            <UFormField label="Zone">
              <USelect v-model="single.zoneId" :items="zoneItems" class="w-full" />
            </UFormField>
            <UFormField label="Couverts">
              <UInputNumber v-model="single.capacity" :min="1" :max="100" class="w-full" />
            </UFormField>
          </div>
        </template>

        <template v-else>
          <div class="grid gap-4 sm:grid-cols-3">
            <UFormField label="Préfixe" hint="facultatif">
              <UInput v-model="bulk.prefix" class="w-full" placeholder="T" />
            </UFormField>
            <UFormField label="De">
              <UInputNumber v-model="bulk.from" :min="0" class="w-full" />
            </UFormField>
            <UFormField label="À">
              <UInputNumber v-model="bulk.to" :min="bulk.from" class="w-full" />
            </UFormField>
            <UFormField label="Zone" class="sm:col-span-2">
              <USelect v-model="bulk.zoneId" :items="zoneItems" class="w-full" />
            </UFormField>
            <UFormField label="Couverts">
              <UInputNumber v-model="bulk.capacity" :min="1" :max="100" class="w-full" />
            </UFormField>
          </div>
          <UAlert
            v-if="bulkCount > 200"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="200 tables maximum par lot."
          />
          <p v-else-if="bulkCount" class="text-sm text-muted">
            {{ bulkCount }} table(s) : <span class="font-medium text-default">{{ bulkPreview }}</span>, chacune avec son QR code.
          </p>
        </template>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="emit('close', false)" />
        <UButton
          type="submit"
          form="table-form"
          :disabled="!valid"
          :loading="saving"
          :label="editing ? 'Enregistrer' : mode === 'bulk' ? `Créer ${bulkCount} tables` : 'Créer la table'"
        />
      </div>
    </template>
  </UModal>
</template>
