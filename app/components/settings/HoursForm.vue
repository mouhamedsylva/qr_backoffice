<script setup lang="ts">
/** Horaires hebdomadaires et fermetures exceptionnelles (RES-06, RES-07). */
import { ConfirmModal } from '#components';
import type { Closure, OpeningHour } from '~/types/api';

const api = useApi();
const restaurant = useRestaurantStore();
const overlay = useOverlay();
const confirm = overlay.create(ConfirmModal);
const { save, saving, details, canSettings } = useSettingsSave();
const { dateTime } = useMoney();

// Lundi d'abord ; l'API compte 0 = dimanche.
const DAYS = [
  { dow: 1, label: 'Lundi' }, { dow: 2, label: 'Mardi' }, { dow: 3, label: 'Mercredi' }, { dow: 4, label: 'Jeudi' },
  { dow: 5, label: 'Vendredi' }, { dow: 6, label: 'Samedi' }, { dow: 0, label: 'Dimanche' },
];
const MAX_SLOTS = 4;

type Slot = { opensAt: string; closesAt: string };
const week = ref<Record<number, Slot[]>>({});

function fromApi(hours: OpeningHour[]) {
  const w: Record<number, Slot[]> = {};
  for (const d of DAYS) w[d.dow] = [];
  for (const h of hours) w[h.dayOfWeek]?.push({ opensAt: h.opensAt, closesAt: h.closesAt });
  week.value = w;
}
watch(() => details.value?.openingHours, (h) => h && fromApi(h), { immediate: true });

function toggleDay(dow: number, open: boolean) {
  week.value[dow] = open ? [{ opensAt: '11:00', closesAt: '23:00' }] : [];
}
function copyToAll(dow: number) {
  const slots = week.value[dow] ?? [];
  for (const d of DAYS) week.value[d.dow] = slots.map((s) => ({ ...s }));
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const slotError = (s: Slot) => {
  if (!HHMM.test(s.opensAt) || !HHMM.test(s.closesAt)) return 'Format HH:mm';
  if (s.opensAt === s.closesAt) return 'Ouverture = fermeture';
  return undefined;
};
const overnight = (s: Slot) => HHMM.test(s.opensAt) && HHMM.test(s.closesAt) && s.closesAt < s.opensAt;
const valid = computed(() => Object.values(week.value).flat().every((s) => !slotError(s)));

async function submitHours() {
  if (!valid.value) return;
  const hours = DAYS.flatMap((d) => (week.value[d.dow] ?? []).map((s) => ({ dayOfWeek: d.dow, ...s })));
  await save('/opening-hours', { hours }, 'Horaires enregistrés', 'PUT');
}

// --- Fermetures exceptionnelles ---
const { data: closures, refresh: refreshClosures } = useAsyncData(
  'closures',
  () => api<Closure[]>(`${restaurant.base}/closures`),
  { default: () => [], watch: [() => restaurant.id] },
);

const closure = reactive({ start: '', end: '', reason: '' });
const closureValid = computed(() => !!closure.start && !!closure.end && closure.end >= closure.start);
const adding = ref(false);

async function addClosure() {
  if (!closureValid.value) return;
  adding.value = true;
  try {
    await api(`${restaurant.base}/closures`, {
      method: 'POST',
      body: {
        startsAt: new Date(`${closure.start}T00:00:00`).toISOString(),
        endsAt: new Date(`${closure.end}T23:59:59`).toISOString(),
        ...(closure.reason.trim() && { reason: closure.reason.trim() }),
      },
    });
    Object.assign(closure, { start: '', end: '', reason: '' });
    await refreshClosures();
  } catch {
    // erreur déjà notifiée
  } finally {
    adding.value = false;
  }
}

async function removeClosure(c: Closure) {
  const ok = await confirm.open({ title: 'Supprimer cette fermeture ?', confirmLabel: 'Supprimer' });
  if (!ok) return;
  await api(`${restaurant.base}/closures/${c.id}`, { method: 'DELETE' }).catch(() => undefined);
  await refreshClosures();
}

const upcoming = computed(() => closures.value.filter((c) => new Date(c.endsAt).getTime() > Date.now()));
</script>

<template>
  <div class="space-y-6">
    <UPageCard
      title="Horaires d'ouverture"
      :description="`Fuseau horaire : ${restaurant.timezone}. En dehors de ces horaires, les clients ne peuvent pas commander.`"
      variant="subtle"
    >
      <ul class="divide-y divide-default">
        <li v-for="d in DAYS" :key="d.dow" class="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
          <div class="flex w-40 items-center gap-3 pt-1.5">
            <USwitch
              :model-value="!!week[d.dow]?.length"
              :disabled="!canSettings"
              :aria-label="`${d.label} ouvert`"
              @update:model-value="toggleDay(d.dow, $event)"
            />
            <span class="text-sm font-medium" :class="!week[d.dow]?.length && 'text-muted'">{{ d.label }}</span>
          </div>

          <p v-if="!week[d.dow]?.length" class="pt-1.5 text-sm text-muted">Fermé</p>
          <div v-else class="flex-1 space-y-2">
            <div v-for="(slot, i) in week[d.dow]" :key="i" class="flex flex-wrap items-center gap-2">
              <UInput v-model="slot.opensAt" type="time" :disabled="!canSettings" size="sm" class="w-28" aria-label="Ouverture" />
              <span class="text-muted">→</span>
              <UInput v-model="slot.closesAt" type="time" :disabled="!canSettings" size="sm" class="w-28" aria-label="Fermeture" />
              <UBadge v-if="overnight(slot)" size="sm" color="info" variant="subtle" label="jusqu'au lendemain" />
              <span v-if="slotError(slot)" class="text-xs text-error">{{ slotError(slot) }}</span>
              <UButton
                v-if="canSettings"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                aria-label="Retirer le créneau"
                @click="week[d.dow]!.splice(i, 1)"
              />
            </div>
            <div v-if="canSettings" class="flex gap-2">
              <UButton
                v-if="week[d.dow]!.length < MAX_SLOTS"
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-lucide-plus"
                label="Créneau"
                @click="week[d.dow]!.push({ opensAt: '18:00', closesAt: '23:00' })"
              />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-copy" label="Appliquer à tous les jours" @click="copyToAll(d.dow)" />
            </div>
          </div>
        </li>
      </ul>
      <div v-if="canSettings" class="flex justify-end">
        <UButton label="Enregistrer les horaires" icon="i-lucide-save" :disabled="!valid" :loading="saving" @click="submitHours" />
      </div>
    </UPageCard>

    <UPageCard title="Fermetures exceptionnelles" description="Congés, travaux, jours fériés : le menu reste visible mais les commandes sont bloquées." variant="subtle">
      <form v-if="canSettings" class="flex flex-wrap items-end gap-2" @submit.prevent="addClosure">
        <UFormField label="Du">
          <UInput v-model="closure.start" type="date" class="w-40" />
        </UFormField>
        <UFormField label="Au">
          <UInput v-model="closure.end" type="date" :min="closure.start" class="w-40" />
        </UFormField>
        <UFormField label="Motif" class="min-w-48 flex-1">
          <UInput v-model="closure.reason" class="w-full" placeholder="Ex. Tabaski, congés annuels" />
        </UFormField>
        <UButton type="submit" icon="i-lucide-calendar-x" label="Ajouter" :disabled="!closureValid" :loading="adding" />
      </form>

      <p v-if="!upcoming.length" class="text-sm text-muted">Aucune fermeture prévue.</p>
      <ul v-else class="divide-y divide-default rounded-lg border border-default">
        <li v-for="c in upcoming" :key="c.id" class="flex items-center gap-3 px-3 py-2">
          <UIcon name="i-lucide-calendar-x" class="size-4 text-warning" />
          <span class="flex-1 text-sm">
            {{ dateTime(c.startsAt, { dateStyle: 'medium' }) }} → {{ dateTime(c.endsAt, { dateStyle: 'medium' }) }}
            <span v-if="c.reason" class="text-muted">· {{ c.reason }}</span>
          </span>
          <UButton v-if="canSettings" size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" aria-label="Supprimer" @click="removeClosure(c)" />
        </li>
      </ul>
    </UPageCard>
  </div>
</template>
