<script setup lang="ts">
/** Remboursement total ou partiel d'un paiement (PAY-08). */
import type { Payment } from '~/types/api';

const props = defineProps<{ payment: Payment; currency: string }>();
const emit = defineEmits<{ close: [done: boolean] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();
const { money } = useMoney();

const refundable = computed(() => props.payment.amount - props.payment.refundedAmount);
const full = ref(true);
const amount = ref<number>(fromMinorUnits(refundable.value, props.currency));
const reason = ref('');
const SUGGESTIONS = ['Plat non servi', 'Erreur de commande', 'Client insatisfait', 'Double paiement'];

const minor = computed(() => (full.value ? refundable.value : toMinorUnits(amount.value || 0, props.currency)));
const valid = computed(() => reason.value.trim().length >= 3 && minor.value > 0 && minor.value <= refundable.value);

const sending = ref(false);
async function submit() {
  if (!valid.value) return;
  sending.value = true;
  try {
    await api(`${restaurant.base}/payments/${props.payment.id}/refunds`, {
      method: 'POST',
      body: { reason: reason.value.trim(), ...(!full.value && { amount: minor.value }) },
    });
    toast.add({ title: `Remboursement de ${money(minor.value, props.currency)} effectué`, color: 'success', icon: 'i-lucide-undo-2' });
    emit('close', true);
  } catch {
    // erreur déjà notifiée
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <UModal title="Rembourser" :description="`Remboursable : ${money(refundable, currency)}`" @update:open="(o) => !o && emit('close', false)">
    <template #body>
      <div class="space-y-4">
        <URadioGroup
          v-model="full"
          orientation="horizontal"
          :items="[
            { label: 'Totalité', value: true },
            { label: 'Montant partiel', value: false },
          ]"
        />
        <UFormField v-if="!full" label="Montant">
          <UInputNumber
            v-model="amount"
            :min="0"
            :max="fromMinorUnits(refundable, currency)"
            class="w-48"
            :format-options="{ style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: fractionDigits(currency) }"
          />
        </UFormField>
        <div class="flex flex-wrap gap-2">
          <UButton v-for="s in SUGGESTIONS" :key="s" size="xs" color="neutral" variant="soft" :label="s" @click="reason = s" />
        </div>
        <UFormField label="Motif" required help="Conservé dans le journal d'audit.">
          <UTextarea v-model="reason" :rows="2" class="w-full" />
        </UFormField>
        <UAlert
          v-if="payment.method !== 'CASH'"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          description="Le client est remboursé sur son moyen de paiement d'origine, sous quelques jours."
        />
        <UAlert v-else color="warning" variant="subtle" icon="i-lucide-banknote" description="Rendez la somme en espèces au client." />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="emit('close', false)" />
        <UButton color="error" icon="i-lucide-undo-2" :label="`Rembourser ${money(minor, currency)}`" :disabled="!valid" :loading="sending" @click="submit" />
      </div>
    </template>
  </UModal>
</template>
