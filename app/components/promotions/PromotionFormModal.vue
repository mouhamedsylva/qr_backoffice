<script setup lang="ts">
/** Création / modification d'un code promo (PRO-01, PRO-02). */
import type { Promotion, PromotionType } from '~/types/api';
import { benefitLabel, PROMOTION_TYPES, randomCode } from '~/utils/promotions';

const props = defineProps<{ promotion?: Promotion | null }>();
const emit = defineEmits<{ close: [saved: boolean] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();
const { options: itemOptions, nameOf } = useMenuItemOptions();
const currency = computed(() => restaurant.currency);
const editing = props.promotion ?? null;

/** Date ISO → valeur d'un champ datetime-local (heure du navigateur). */
const toLocal = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const state = reactive({
  code: editing?.code ?? randomCode(),
  name: editing?.name ?? '',
  description: editing?.description ?? '',
  type: (editing?.type ?? 'PERCENT') as PromotionType,
  percent: editing?.type === 'PERCENT' ? editing.value / 100 : 10,
  amount: editing?.type === 'AMOUNT' ? fromMinorUnits(editing.value, currency.value) : 1000,
  buyQuantity: editing?.buyQuantity ?? 2,
  freeQuantity: editing?.freeQuantity ?? 1,
  menuItemId: editing?.menuItemId ?? undefined,
  minSubtotal: editing?.minSubtotal != null ? fromMinorUnits(editing.minSubtotal, currency.value) : null,
  maxDiscount: editing?.maxDiscount != null ? fromMinorUnits(editing.maxDiscount, currency.value) : null,
  startsAt: toLocal(editing?.startsAt ?? null),
  endsAt: toLocal(editing?.endsAt ?? null),
  usageLimit: editing?.usageLimit ?? null,
  perCustomerLimit: editing?.perCustomerLimit ?? null,
  isActive: editing?.isActive ?? true,
});

const needsItem = computed(() => state.type === 'BUY_X_GET_Y' || state.type === 'FREE_ITEM');
const moneyFormat = computed(() => ({
  style: 'currency' as const,
  currency: currency.value,
  currencyDisplay: 'narrowSymbol' as const,
  maximumFractionDigits: fractionDigits(currency.value),
}));

const errors = computed(() => {
  const e: Record<string, string> = {};
  if (!/^[A-Z0-9_-]{3,40}$/.test(state.code)) e.code = '3 à 40 caractères : lettres, chiffres, - ou _';
  if (!state.name.trim()) e.name = 'Nom obligatoire';
  if (state.type === 'PERCENT' && !(state.percent > 0 && state.percent <= 100)) e.value = 'Entre 0 et 100 %';
  if (state.type === 'AMOUNT' && !(state.amount > 0)) e.value = 'Montant obligatoire';
  if (needsItem.value && !state.menuItemId) e.menuItemId = 'Choisissez un article';
  if (state.startsAt && state.endsAt && state.endsAt <= state.startsAt) e.endsAt = 'La fin doit suivre le début';
  return e;
});
const valid = computed(() => Object.keys(errors.value).length === 0);

const preview = computed(() =>
  benefitLabel(
    {
      type: state.type,
      value: state.type === 'PERCENT' ? Math.round(state.percent * 100) : toMinorUnits(state.amount || 0, currency.value),
      buyQuantity: state.buyQuantity,
      freeQuantity: state.freeQuantity,
    },
    currency.value,
    restaurant.locale,
    nameOf(state.menuItemId),
  ),
);

const saving = ref(false);
async function submit() {
  if (!valid.value) return;
  const minor = (v: number | null) => (v ? toMinorUnits(v, currency.value) : null);
  const iso = (v: string) => (v ? new Date(v).toISOString() : null);
  // `null` efface la valeur (utile en modification ou après un changement de type).
  const body: Record<string, unknown> = {
    name: state.name.trim(),
    description: state.description.trim() || null,
    type: state.type,
    ...(state.type === 'PERCENT' && { value: Math.round(state.percent * 100) }),
    ...(state.type === 'AMOUNT' && { value: toMinorUnits(state.amount, currency.value) }),
    maxDiscount: state.type === 'PERCENT' ? minor(state.maxDiscount) : null,
    buyQuantity: state.type === 'BUY_X_GET_Y' ? state.buyQuantity : null,
    freeQuantity: state.type === 'BUY_X_GET_Y' ? state.freeQuantity : null,
    menuItemId: needsItem.value ? state.menuItemId : null,
    minSubtotal: minor(state.minSubtotal),
    startsAt: iso(state.startsAt),
    endsAt: iso(state.endsAt),
    usageLimit: state.usageLimit || null,
    perCustomerLimit: state.perCustomerLimit || null,
    isActive: state.isActive,
  };
  saving.value = true;
  try {
    if (editing) {
      await api(`${restaurant.base}/promotions/${editing.id}`, { method: 'PATCH', body });
    } else {
      await api(`${restaurant.base}/promotions`, { method: 'POST', body: { ...body, code: state.code } });
    }
    toast.add({ title: editing ? 'Promotion modifiée' : `Code ${state.code} créé`, color: 'success', icon: 'i-lucide-ticket-percent' });
    emit('close', true);
  } catch {
    // erreur déjà notifiée (ex. PROMO_CODE_TAKEN)
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal
    :title="editing ? `Modifier ${editing.code}` : 'Nouveau code promo'"
    :ui="{ content: 'sm:max-w-2xl' }"
    @update:open="(o) => !o && emit('close', false)"
  >
    <template #body>
      <form id="promo-form" class="space-y-5" @submit.prevent="submit">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Code" required :error="errors.code" :help="editing ? 'Le code ne peut plus être modifié.' : 'Saisi par le client au moment de payer.'">
            <UInput
              :model-value="state.code"
              :disabled="!!editing"
              class="w-full font-mono"
              @update:model-value="(v) => (state.code = String(v).toUpperCase().replace(/\s+/g, ''))"
            >
              <template v-if="!editing" #trailing>
                <UButton size="xs" color="neutral" variant="link" icon="i-lucide-dices" aria-label="Générer un code" @click="state.code = randomCode()" />
              </template>
            </UInput>
          </UFormField>
          <UFormField label="Nom interne" required :error="errors.name">
            <UInput v-model="state.name" class="w-full" placeholder="Ex. Happy hour jus" />
          </UFormField>
        </div>

        <UFormField label="Avantage">
          <URadioGroup
            v-model="state.type"
            variant="card"
            class="w-full"
            :ui="{ fieldset: 'grid grid-cols-2 gap-2' }"
            :items="(Object.keys(PROMOTION_TYPES) as PromotionType[]).map((t) => ({ value: t, label: PROMOTION_TYPES[t].label, description: PROMOTION_TYPES[t].description }))"
          />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <template v-if="state.type === 'PERCENT'">
            <UFormField label="Réduction" required :error="errors.value" hint="%">
              <UInputNumber v-model="state.percent" :min="1" :max="100" :step="5" class="w-full" />
            </UFormField>
            <UFormField label="Réduction maximale" hint="facultatif">
              <UInputNumber v-model="state.maxDiscount" :min="0" class="w-full" :format-options="moneyFormat" />
            </UFormField>
          </template>
          <UFormField v-else-if="state.type === 'AMOUNT'" label="Montant de la réduction" required :error="errors.value">
            <UInputNumber v-model="state.amount" :min="0" class="w-full" :format-options="moneyFormat" />
          </UFormField>
          <template v-if="state.type === 'BUY_X_GET_Y'">
            <UFormField label="Achetés">
              <UInputNumber v-model="state.buyQuantity" :min="1" :max="20" class="w-full" />
            </UFormField>
            <UFormField label="Offerts">
              <UInputNumber v-model="state.freeQuantity" :min="1" :max="20" class="w-full" />
            </UFormField>
          </template>
          <UFormField v-if="needsItem" label="Article concerné" required :error="errors.menuItemId" class="sm:col-span-2">
            <USelectMenu v-model="state.menuItemId" :items="itemOptions" value-key="value" class="w-full" placeholder="Choisir un article" />
          </UFormField>
          <UFormField label="Commande minimum" hint="facultatif">
            <UInputNumber v-model="state.minSubtotal" :min="0" class="w-full" :format-options="moneyFormat" />
          </UFormField>
        </div>

        <USeparator label="Conditions" />
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Début" hint="facultatif">
            <UInput v-model="state.startsAt" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField label="Fin" hint="facultatif" :error="errors.endsAt">
            <UInput v-model="state.endsAt" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField label="Utilisations au total" hint="vide = illimité">
            <UInputNumber v-model="state.usageLimit" :min="1" class="w-full" />
          </UFormField>
          <UFormField label="Par client" hint="vide = illimité">
            <UInputNumber v-model="state.perCustomerLimit" :min="1" class="w-full" />
          </UFormField>
        </div>
        <UFormField label="Description" hint="facultatif">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>
        <USwitch v-model="state.isActive" label="Code utilisable" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UBadge color="primary" variant="subtle" size="lg" icon="i-lucide-ticket-percent" :label="preview" />
        <div class="flex gap-2">
          <UButton color="neutral" variant="ghost" label="Annuler" @click="emit('close', false)" />
          <UButton type="submit" form="promo-form" :disabled="!valid" :loading="saving" :label="editing ? 'Enregistrer' : 'Créer le code'" />
        </div>
      </div>
    </template>
  </UModal>
</template>
