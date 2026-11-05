<script setup lang="ts">
/** Reçu numéroté (PAY-09), au format ticket de caisse, imprimable. */
import type { Receipt } from '~/types/api';
import { MODE_LABEL } from '~/utils/order-status';

const props = defineProps<{ orderId: string }>();
const emit = defineEmits<{ close: [] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const { money, dateTime } = useMoney();

const { data: receipt, error } = useAsyncData(`receipt-${props.orderId}`, () =>
  api<Receipt>(`${restaurant.base}/orders/${props.orderId}/receipt`, { silent: true }),
);

const METHOD: Record<string, string> = { CASH: 'Espèces', CARD: 'Carte', MOBILE_MONEY: 'Mobile money' };
const m = (v: number) => money(v, receipt.value?.currency);

/** Impression du seul ticket, dans une fenêtre dédiée. */
const ticket = useTemplateRef<HTMLElement>('ticket');
function print() {
  if (!ticket.value) return;
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return;
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${receipt.value?.receiptNumber}</title>
    <style>body{font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;margin:16px;color:#111}
    .row{display:flex;justify-content:space-between;gap:8px}.c{text-align:center}.b{font-weight:700}
    hr{border:0;border-top:1px dashed #999;margin:8px 0}.m{color:#555;font-size:12px}h1{font-size:16px;margin:0}</style></head>
    <body>${ticket.value.innerHTML}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}
</script>

<template>
  <UModal title="Reçu" @update:open="(o) => !o && emit('close')">
    <template #body>
      <UEmpty
        v-if="error"
        icon="i-lucide-receipt"
        title="Reçu indisponible"
        description="Le reçu est émis une fois la commande entièrement réglée."
        variant="naked"
      />
      <USkeleton v-else-if="!receipt" class="h-96 w-full" />
      <div v-else class="mx-auto max-w-xs rounded-md border border-default bg-white p-4 text-neutral-900 shadow-sm">
        <div ref="ticket" class="font-mono text-[13px] leading-snug">
          <div class="c" style="text-align: center">
            <h1 class="text-base font-bold">{{ receipt.restaurant.name }}</h1>
            <p v-if="receipt.restaurant.address" class="m text-xs text-neutral-500">{{ receipt.restaurant.address }}</p>
            <p v-if="receipt.restaurant.phone" class="m text-xs text-neutral-500">{{ receipt.restaurant.phone }}</p>
          </div>
          <hr class="my-2 border-dashed border-neutral-400" >
          <div class="row flex justify-between"><span>Reçu</span><span class="b font-bold">{{ receipt.receiptNumber }}</span></div>
          <div class="row flex justify-between"><span>Date</span><span>{{ dateTime(receipt.issuedAt) }}</span></div>
          <div class="row flex justify-between">
            <span>Commande n°{{ receipt.order.number }}</span>
            <span>{{ receipt.order.table ? `Table ${receipt.order.table}` : MODE_LABEL[receipt.order.mode] }}</span>
          </div>
          <hr class="my-2 border-dashed border-neutral-400" >
          <div v-for="(i, idx) in receipt.items" :key="idx" class="mb-1">
            <div class="row flex justify-between gap-2"><span>{{ i.quantity }} × {{ i.name }}</span><span>{{ m(i.lineTotal) }}</span></div>
            <p v-if="i.options.length" class="m ps-4 text-xs text-neutral-500">{{ i.options.join(', ') }}</p>
          </div>
          <hr class="my-2 border-dashed border-neutral-400" >
          <div class="row flex justify-between"><span>Sous-total</span><span>{{ m(receipt.subtotal) }}</span></div>
          <div v-if="receipt.discountTotal" class="row flex justify-between"><span>Remise</span><span>− {{ m(receipt.discountTotal) }}</span></div>
          <div v-if="receipt.serviceFee" class="row flex justify-between"><span>Service</span><span>{{ m(receipt.serviceFee) }}</span></div>
          <div v-if="receipt.tipAmount" class="row flex justify-between"><span>Pourboire</span><span>{{ m(receipt.tipAmount) }}</span></div>
          <div v-if="receipt.taxTotal" class="row flex justify-between">
            <span>{{ receipt.pricesIncludeTax ? 'dont TVA' : 'TVA' }} {{ receipt.taxRateBp / 100 }} %</span><span>{{ m(receipt.taxTotal) }}</span>
          </div>
          <div class="row b mt-1 flex justify-between text-base font-bold"><span>TOTAL</span><span>{{ m(receipt.total) }}</span></div>
          <hr class="my-2 border-dashed border-neutral-400" >
          <template v-for="(p, idx) in receipt.payments" :key="idx">
            <div class="row flex justify-between"><span>{{ p.operator ?? METHOD[p.method] }}</span><span>{{ m(p.amount) }}</span></div>
            <div v-for="(r, j) in p.refunds" :key="j" class="row m flex justify-between text-xs text-neutral-500">
              <span>Remboursé · {{ r.reason }}</span><span>− {{ m(r.amount) }}</span>
            </div>
          </template>
          <hr class="my-2 border-dashed border-neutral-400" >
          <p class="c m text-center text-xs text-neutral-500" style="text-align: center">Merci de votre visite !</p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Fermer" @click="emit('close')" />
        <UButton v-if="receipt" icon="i-lucide-printer" label="Imprimer" @click="print" />
      </div>
    </template>
  </UModal>
</template>
