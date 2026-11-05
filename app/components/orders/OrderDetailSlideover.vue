<script setup lang="ts">
import { OrdersReceiptModal, OrdersRefundModal } from '#components';
import type { Order, Payment } from '~/types/api';
import {
  canTransition,
  MODE_LABEL,
  NEXT_ACTION,
  PAYMENT_STATUS,
  type OrderStatus,
} from '~/utils/order-status';

const props = defineProps<{ orderId: string | null }>();
const emit = defineEmits<{ close: [] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const orders = useOrdersStore();
const realtime = useRealtime();
const toast = useToast();
const { money, dateTime } = useMoney();
const { changeStatus, busy } = useOrderActions();
const overlay = useOverlay();
const refundModal = overlay.create(OrdersRefundModal);
const receiptModal = overlay.create(OrdersReceiptModal);

const open = computed({
  get: () => !!props.orderId,
  set: (v) => !v && emit('close'),
});

const order = ref<Order | null>(null);
const payments = ref<Payment[]>([]);
const loading = ref(false);

async function load() {
  if (!props.orderId) return;
  loading.value = true;
  try {
    const [o, p] = await Promise.all([
      api<Order>(`${restaurant.base}/orders/${props.orderId}`),
      restaurant.can('orders.view')
        ? api<Payment[]>(`${restaurant.base}/orders/${props.orderId}/payments`, { silent: true }).catch(() => [])
        : Promise.resolve([]),
    ]);
    order.value = o;
    payments.value = p;
  } finally {
    loading.value = false;
  }
}

watch(() => props.orderId, (id) => (id ? load() : (order.value = null)), { immediate: true });

// La fiche ouverte suit le temps réel.
realtime.on('*', (message) => {
  if (props.orderId && message.orderId === props.orderId) void load();
});

const paid = computed(() =>
  payments.value.filter((p) => p.status === 'SUCCEEDED').reduce((s, p) => s + p.amount, 0),
);
const due = computed(() => Math.max(0, (order.value?.total ?? 0) - paid.value));

const actions = computed(() => {
  if (!order.value || !restaurant.can('orders.manage')) return [];
  const from = order.value.status;
  const next = NEXT_ACTION[from];
  const list: { to: OrderStatus; label: string; icon: string; color: 'primary' | 'neutral' | 'error' }[] = [];
  if (next) list.push({ ...next, color: 'primary' });
  if (from === 'ACCEPTED' && canTransition(from, 'READY')) {
    list.push({ to: 'READY', label: 'Directement prête', icon: 'i-lucide-bell', color: 'neutral' });
  }
  if (from === 'READY') list.push({ to: 'COMPLETED', label: 'Terminer', icon: 'i-lucide-circle-check-big', color: 'neutral' });
  if (canTransition(from, 'REJECTED')) list.push({ to: 'REJECTED', label: 'Refuser', icon: 'i-lucide-circle-x', color: 'error' });
  if (canTransition(from, 'CANCELLED') && restaurant.can('orders.cancel')) {
    list.push({ to: 'CANCELLED', label: 'Annuler', icon: 'i-lucide-ban', color: 'error' });
  }
  return list;
});

async function act(to: OrderStatus) {
  if (!order.value) return;
  const updated = await changeStatus(order.value, to);
  if (updated) order.value = updated;
}

// Remboursement, reçu et rapprochement (PAY-08, PAY-09).
const hasReceipt = computed(() =>
  !!order.value && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.value.paymentStatus),
);
const canRefund = (p: Payment) =>
  p.status === 'SUCCEEDED' && p.amount - p.refundedAmount > 0 && restaurant.can('orders.refund');

async function refund(p: Payment) {
  if (!order.value) return;
  if (await refundModal.open({ payment: p, currency: order.value.currency })) await load();
}

const reconciling = ref<string | null>(null);
async function reconcile(p: Payment) {
  reconciling.value = p.id;
  try {
    await api(`${restaurant.base}/payments/${p.id}/reconcile`, { method: 'POST' });
    await load();
    toast.add({ title: 'Statut du paiement vérifié', color: 'success', icon: 'i-lucide-refresh-cw' });
  } catch {
    // erreur déjà notifiée
  } finally {
    reconciling.value = null;
  }
}

// Encaissement espèces (PAY-05).
const amountReceived = ref<number | null>(null);
const cashing = ref(false);
const change = computed(() =>
  amountReceived.value !== null ? Math.max(0, toMinorUnits(amountReceived.value, restaurant.currency) - due.value) : 0,
);

async function collectCash() {
  if (!order.value) return;
  cashing.value = true;
  try {
    const res = await api<{ change: number }>(`${restaurant.base}/orders/${order.value.id}/payments/cash`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: amountReceived.value ? { amountReceived: toMinorUnits(amountReceived.value, restaurant.currency) } : {},
    });
    toast.add({
      title: 'Paiement encaissé',
      description: res.change ? `Monnaie à rendre : ${money(res.change)}` : undefined,
      color: 'success',
      icon: 'i-lucide-banknote',
    });
    amountReceived.value = null;
    await load();
    orders.patch(order.value.id, { paymentStatus: order.value.paymentStatus });
  } catch {
    // erreur déjà notifiée
  } finally {
    cashing.value = false;
  }
}
</script>

<template>
  <USlideover v-model:open="open" :ui="{ content: 'max-w-lg' }">
    <template #title>
      <span v-if="order" class="font-display text-xl">Commande n°{{ order.number }}</span>
      <span v-else>Commande</span>
    </template>
    <template #description>
      <span v-if="order">
        {{ order.table ? `Table ${order.table.label}` : MODE_LABEL[order.mode] }} · {{ dateTime(order.createdAt) }}
      </span>
    </template>

    <template #body>
      <div v-if="loading && !order" class="space-y-3">
        <USkeleton class="h-6 w-1/2" />
        <USkeleton class="h-24 w-full" />
        <USkeleton class="h-16 w-full" />
      </div>

      <div v-else-if="order" class="space-y-6">
        <div class="flex flex-wrap items-center gap-2">
          <OrdersStatusBadge :status="order.status" size="md" />
          <UBadge :color="PAYMENT_STATUS[order.paymentStatus]?.color" variant="subtle" :label="PAYMENT_STATUS[order.paymentStatus]?.label" />
          <UBadge v-if="order.isRush" color="primary" label="Prioritaire" />
          <UBadge v-if="order.source === 'STAFF'" color="neutral" variant="outline" label="Saisie en salle" />
        </div>

        <UAlert
          v-if="order.cancelReason"
          color="error"
          variant="subtle"
          icon="i-lucide-info"
          :title="`Motif : ${order.cancelReason}`"
        />

        <div v-if="order.customerName || order.customerPhone || order.notes" class="space-y-1 text-sm">
          <p v-if="order.customerName"><span class="text-muted">Client :</span> {{ order.customerName }}</p>
          <p v-if="order.customerPhone"><span class="text-muted">Téléphone :</span> {{ order.customerPhone }}</p>
          <p v-if="order.notes" class="rounded bg-warning/10 px-2 py-1 text-warning">« {{ order.notes }} »</p>
        </div>

        <!-- Articles -->
        <section>
          <h3 class="mb-2 text-sm font-semibold text-highlighted">Articles</h3>
          <ul class="divide-y divide-default rounded-lg border border-default">
            <li v-for="item in order.items" :key="item.id" class="flex gap-3 p-3">
              <span class="tabular w-8 font-semibold text-highlighted">{{ item.quantity }}×</span>
              <div class="min-w-0 flex-1">
                <p class="font-medium">
                  {{ item.name }}
                  <UBadge v-if="item.batch > 1" size="xs" color="info" variant="subtle" :label="`Ajout n°${item.batch - 1}`" />
                </p>
                <p v-if="item.options.length" class="text-xs text-muted">
                  {{ item.options.map((o) => `${o.groupName} : ${o.name}`).join(' · ') }}
                </p>
                <p v-if="item.notes" class="text-xs text-warning">« {{ item.notes }} »</p>
              </div>
              <span class="tabular text-sm">{{ money(item.lineTotal, order.currency) }}</span>
            </li>
          </ul>
        </section>

        <!-- Totaux -->
        <section class="space-y-1 text-sm">
          <div class="flex justify-between"><span class="text-muted">Sous-total</span><span class="tabular">{{ money(order.subtotal, order.currency) }}</span></div>
          <div v-if="order.discountTotal" class="flex justify-between text-success">
            <span>Remise {{ order.promoCode ? `(${order.promoCode})` : '' }}</span>
            <span class="tabular">− {{ money(order.discountTotal, order.currency) }}</span>
          </div>
          <div v-if="order.serviceFee" class="flex justify-between"><span class="text-muted">Service</span><span class="tabular">{{ money(order.serviceFee, order.currency) }}</span></div>
          <div v-if="order.tipAmount" class="flex justify-between"><span class="text-muted">Pourboire</span><span class="tabular">{{ money(order.tipAmount, order.currency) }}</span></div>
          <div v-if="order.taxTotal" class="flex justify-between text-xs text-muted"><span>dont TVA</span><span class="tabular">{{ money(order.taxTotal, order.currency) }}</span></div>
          <div class="flex justify-between border-t border-default pt-2 text-base font-semibold text-highlighted">
            <span>Total</span><span class="tabular">{{ money(order.total, order.currency) }}</span>
          </div>
        </section>

        <!-- Paiements -->
        <section v-if="payments.length" class="space-y-2">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-highlighted">Paiements</h3>
            <UButton
              v-if="hasReceipt"
              size="xs"
              color="neutral"
              variant="outline"
              icon="i-lucide-receipt"
              label="Reçu"
              @click="receiptModal.open({ orderId: order.id })"
            />
          </div>
          <ul class="divide-y divide-default rounded-lg border border-default text-sm">
            <li v-for="p in payments" :key="p.id" class="px-3 py-2">
              <div class="flex items-center justify-between gap-2">
                <span>
                  {{ { CASH: 'Espèces', CARD: 'Carte', MOBILE_MONEY: p.operator ?? 'Mobile money' }[p.method] }}
                  <span class="text-xs text-muted">· {{ dateTime(p.createdAt, { timeStyle: 'short' }) }}</span>
                </span>
                <span class="flex items-center gap-1">
                  <span class="tabular" :class="p.status === 'SUCCEEDED' ? 'text-success' : 'text-muted'">
                    {{ money(p.amount, order.currency) }}
                    <template v-if="p.status !== 'SUCCEEDED'"> ({{ p.status === 'PENDING' ? 'en attente' : 'échoué' }})</template>
                  </span>
                  <UButton
                    v-if="p.status === 'PENDING' && p.method !== 'CASH' && restaurant.can('payments.collect')"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-refresh-cw"
                    aria-label="Vérifier auprès du prestataire"
                    :loading="reconciling === p.id"
                    @click="reconcile(p)"
                  />
                  <UButton v-if="canRefund(p)" size="xs" color="error" variant="ghost" label="Rembourser" @click="refund(p)" />
                </span>
              </div>
              <p v-for="r in p.refunds ?? []" :key="r.id" class="mt-1 flex justify-between text-xs text-muted">
                <span><UIcon name="i-lucide-undo-2" class="align-middle" /> Remboursé · {{ r.reason }}</span>
                <span class="tabular">− {{ money(r.amount, order.currency) }}</span>
              </p>
            </li>
          </ul>
        </section>

        <!-- Encaissement espèces -->
        <section
          v-if="due > 0 && !['CANCELLED', 'REJECTED'].includes(order.status) && restaurant.can('payments.collect')"
          class="space-y-3 rounded-lg border border-default bg-elevated/50 p-4"
        >
          <div class="flex items-baseline justify-between">
            <h3 class="text-sm font-semibold text-highlighted">Encaisser en espèces</h3>
            <span class="tabular text-sm">Reste dû : <strong>{{ money(due, order.currency) }}</strong></span>
          </div>
          <UFormField label="Somme remise par le client" hint="Facultatif">
            <UInputNumber v-model="amountReceived" :min="0" :step="500" class="w-full" placeholder="Montant reçu" />
          </UFormField>
          <p v-if="change" class="text-sm text-success">Monnaie à rendre : <strong>{{ money(change) }}</strong></p>
          <UButton block icon="i-lucide-banknote" :loading="cashing" :label="`Encaisser ${money(due, order.currency)}`" @click="collectCash" />
        </section>
      </div>
    </template>

    <template v-if="order && actions.length" #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          v-for="a in actions"
          :key="a.to"
          :icon="a.icon"
          :label="a.label"
          :color="a.color"
          :variant="a.color === 'primary' ? 'solid' : 'soft'"
          :loading="busy === order.id"
          @click="act(a.to)"
        />
      </div>
    </template>
  </USlideover>
</template>
