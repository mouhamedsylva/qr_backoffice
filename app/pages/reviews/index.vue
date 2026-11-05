<script setup lang="ts">
import { ReviewsHideModal } from '#components';
import type { Paginated, Review, ReviewSummary } from '~/types/api';

useHead({ title: 'Avis clients · QR-Order' });

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();
const overlay = useOverlay();
const { dateTime } = useMoney();
const hideModal = overlay.create(ReviewsHideModal);

const page = ref(1);
const limit = 20;

const { data: list, status, refresh } = useAsyncData(
  'reviews',
  () => api<Paginated<Review>>(`${restaurant.base}/reviews`, { query: { page: page.value, limit } }),
  { watch: [page, () => restaurant.id] },
);

// Note moyenne et répartition des avis publiés (mêmes chiffres que la page publique).
const { data: summary, refresh: refreshSummary } = useAsyncData(
  'reviews-summary',
  () =>
    restaurant.membership
      ? api<ReviewSummary & { meta: { total: number } }>(`/public/restaurants/${restaurant.membership.slug}/reviews`, { query: { limit: 1 }, silent: true }).catch(() => null)
      : Promise.resolve(null),
  { watch: [() => restaurant.id] },
);

const filter = ref<'all' | 'unanswered' | 'negative' | 'hidden'>('all');
const reviews = computed(() =>
  (list.value?.data ?? []).filter((r) => {
    if (filter.value === 'unanswered') return !r.reply && r.status === 'PUBLISHED';
    if (filter.value === 'negative') return r.rating <= 2;
    if (filter.value === 'hidden') return r.status === 'HIDDEN';
    return true;
  }),
);

const published = computed(() => summary.value?.meta?.total ?? 0);
const distribution = computed(() =>
  [5, 4, 3, 2, 1].map((n) => {
    const count = Number(summary.value?.distribution?.[n] ?? 0);
    return { n, count, pct: published.value ? (count / published.value) * 100 : 0 };
  }),
);

// Réponse publique (AVI-02).
const editing = ref<string | null>(null);
const draft = ref('');
const sending = ref(false);
function startReply(r: Review) {
  editing.value = r.id;
  draft.value = r.reply ?? '';
}
async function sendReply(r: Review) {
  if (draft.value.trim().length < 2) return;
  sending.value = true;
  try {
    const updated = await api<Review>(`${restaurant.base}/reviews/${r.id}/reply`, { method: 'POST', body: { reply: draft.value.trim() } });
    Object.assign(r, { reply: updated.reply, repliedAt: updated.repliedAt });
    editing.value = null;
    toast.add({ title: 'Réponse publiée', color: 'success', icon: 'i-lucide-message-circle-reply' });
  } catch {
    // erreur déjà notifiée
  } finally {
    sending.value = false;
  }
}

async function setStatus(r: Review, status: Review['status']) {
  let reason: string | undefined;
  if (status === 'HIDDEN') {
    const res = await hideModal.open();
    if (!res) return;
    reason = res;
  }
  try {
    await api(`${restaurant.base}/reviews/${r.id}/status`, { method: 'PATCH', body: { status, ...(reason && { reason }) } });
    Object.assign(r, { status, hiddenReason: reason ?? null });
    toast.add({ title: status === 'HIDDEN' ? 'Avis masqué' : 'Avis republié', color: 'success', icon: status === 'HIDDEN' ? 'i-lucide-eye-off' : 'i-lucide-eye' });
    await refreshSummary();
  } catch {
    // erreur déjà notifiée
  }
}

const TEMPLATES = [
  'Merci beaucoup pour votre visite et ce bel avis ! À très bientôt.',
  'Merci pour votre retour. Nous sommes désolés que tout n\'ait pas été parfait : nous en tenons compte.',
];
</script>

<template>
  <UDashboardPanel id="reviews">
    <template #header>
      <UDashboardNavbar title="Avis clients">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" aria-label="Actualiser" @click="() => { refresh(); refreshSummary(); }" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-4xl space-y-6">
        <!-- Synthèse -->
        <UCard>
          <div class="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div class="text-center sm:w-48">
              <p class="font-display text-5xl font-semibold text-highlighted">
                {{ summary?.averageRating?.toLocaleString('fr-FR', { minimumFractionDigits: 1 }) ?? '—' }}
              </p>
              <ReviewsStars :rating="summary?.averageRating ?? 0" size="size-5" />
              <p class="mt-1 text-sm text-muted">{{ published }} avis publié{{ published > 1 ? 's' : '' }}</p>
            </div>
            <div class="flex-1 space-y-1.5">
              <div v-for="d in distribution" :key="d.n" class="flex items-center gap-2 text-sm">
                <span class="tabular w-3 text-muted">{{ d.n }}</span>
                <UIcon name="i-lucide-star" class="size-3.5 text-safran-500" />
                <UProgress :model-value="d.pct" size="sm" color="warning" class="flex-1" />
                <span class="tabular w-8 text-right text-muted">{{ d.count }}</span>
              </div>
            </div>
          </div>
        </UCard>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="f in [
              { v: 'all', l: 'Tous' },
              { v: 'unanswered', l: 'Sans réponse' },
              { v: 'negative', l: '1 à 2 étoiles' },
              { v: 'hidden', l: 'Masqués' },
            ] as const"
            :key="f.v"
            size="sm"
            :color="filter === f.v ? 'primary' : 'neutral'"
            :variant="filter === f.v ? 'soft' : 'ghost'"
            :label="f.l"
            @click="filter = f.v"
          />
        </div>

        <div v-if="status === 'pending' && !list" class="space-y-3">
          <USkeleton v-for="n in 3" :key="n" class="h-32 w-full" />
        </div>

        <UEmpty
          v-else-if="!reviews.length"
          icon="i-lucide-star"
          :title="list?.data.length ? 'Aucun avis dans ce filtre' : 'Pas encore d\'avis'"
          description="Après le paiement, vos clients sont invités à noter leur repas depuis leur téléphone."
          variant="naked"
          class="py-12"
        />

        <ul v-else class="space-y-4">
          <li
            v-for="r in reviews"
            :key="r.id"
            class="space-y-3 rounded-xl border bg-default p-4"
            :class="r.status === 'HIDDEN' ? 'border-dashed border-default opacity-70' : r.rating <= 2 ? 'border-error/40' : 'border-default'"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-3">
                <UAvatar :text="(r.authorName ?? 'C')[0]!.toUpperCase()" size="sm" />
                <div>
                  <p class="text-sm font-medium">{{ r.authorName ?? 'Client' }}</p>
                  <p class="text-xs text-muted">
                    {{ dateTime(r.createdAt, { dateStyle: 'medium' }) }}<template v-if="r.order"> · commande n°{{ r.order.number }}</template>
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <ReviewsStars :rating="r.rating" />
                <UBadge v-if="r.status === 'HIDDEN'" color="neutral" variant="outline" icon="i-lucide-eye-off" label="Masqué" />
              </div>
            </div>

            <p v-if="r.comment" class="text-sm whitespace-pre-line">{{ r.comment }}</p>
            <p v-else class="text-sm text-dimmed italic">Note sans commentaire.</p>
            <p v-if="r.status === 'HIDDEN' && r.hiddenReason" class="text-xs text-muted">Motif du masquage : {{ r.hiddenReason }}</p>

            <!-- Réponse -->
            <div v-if="editing === r.id" class="space-y-2">
              <div class="flex flex-wrap gap-2">
                <UButton v-for="(t, i) in TEMPLATES" :key="i" size="xs" color="neutral" variant="soft" :label="i === 0 ? 'Remerciement' : 'Excuses'" @click="draft = t" />
              </div>
              <UTextarea v-model="draft" :rows="3" autofocus class="w-full" placeholder="Votre réponse, visible publiquement…" />
              <div class="flex justify-end gap-2">
                <UButton size="sm" color="neutral" variant="ghost" label="Annuler" @click="editing = null" />
                <UButton size="sm" icon="i-lucide-send" label="Publier la réponse" :disabled="draft.trim().length < 2" :loading="sending" @click="sendReply(r)" />
              </div>
            </div>
            <div v-else-if="r.reply" class="rounded-lg border-s-4 border-primary bg-elevated/60 px-3 py-2">
              <p class="text-xs font-semibold text-primary">Réponse du restaurant · {{ r.repliedAt ? dateTime(r.repliedAt, { dateStyle: 'medium' }) : '' }}</p>
              <p class="text-sm whitespace-pre-line">{{ r.reply }}</p>
            </div>

            <div v-if="editing !== r.id" class="flex flex-wrap gap-1">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-message-circle-reply"
                :label="r.reply ? 'Modifier la réponse' : 'Répondre'"
                @click="startReply(r)"
              />
              <UButton
                v-if="r.status === 'PUBLISHED'"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-eye-off"
                label="Masquer"
                @click="setStatus(r, 'HIDDEN')"
              />
              <UButton v-else size="xs" color="neutral" variant="ghost" icon="i-lucide-eye" label="Republier" @click="setStatus(r, 'PUBLISHED')" />
            </div>
          </li>
        </ul>

        <div v-if="list && list.meta.totalPages > 1" class="flex justify-end">
          <UPagination v-model:page="page" :total="list.meta.total" :items-per-page="limit" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
