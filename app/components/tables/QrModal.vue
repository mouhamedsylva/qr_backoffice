<script setup lang="ts">
/** QR code d'une table : aperçu, téléchargement, régénération (TAB-03, TAB-04). */
import { useClipboard } from '@vueuse/core';
import { ConfirmModal } from '#components';
import type { DiningTable } from '~/types/api';

const props = defineProps<{ table: DiningTable }>();
const emit = defineEmits<{ close: [regenerated: boolean] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();
const overlay = useOverlay();
const confirm = overlay.create(ConfirmModal);
const { copy, copied } = useClipboard();

const info = ref<{ url: string; version: number } | null>(null);
const svgUrl = ref<string | null>(null);
const loading = ref(true);
const regenerated = ref(false);
const base = computed(() => `${restaurant.base}/tables/${props.table.id}/qr`);

async function load() {
  loading.value = true;
  try {
    const [qr, svg] = await Promise.all([
      api<{ url: string; version: number }>(base.value),
      api<Blob>(`${base.value}/image`, { query: { format: 'svg' }, responseType: 'blob' }),
    ]);
    info.value = qr;
    if (svgUrl.value) URL.revokeObjectURL(svgUrl.value);
    svgUrl.value = URL.createObjectURL(svg);
  } finally {
    loading.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => svgUrl.value && URL.revokeObjectURL(svgUrl.value));

const downloading = ref<string | null>(null);
async function download(format: 'png' | 'svg') {
  downloading.value = format;
  try {
    const blob = await api<Blob>(`${base.value}/image`, {
      query: { format, ...(format === 'png' && { size: 1024 }) },
      responseType: 'blob',
    });
    downloadBlob(blob, `qr-table-${props.table.label.replace(/\s+/g, '-')}.${format}`);
  } finally {
    downloading.value = null;
  }
}

const regenerating = ref(false);
async function regenerate() {
  const ok = await confirm.open({
    title: `Régénérer le QR de la table ${props.table.label} ?`,
    description: 'L\'ancien QR code ne fonctionnera plus : pensez à réimprimer et remplacer l\'autocollant.',
    confirmLabel: 'Régénérer',
    color: 'warning',
  });
  if (!ok) return;
  regenerating.value = true;
  try {
    await api(`${base.value}/regenerate`, { method: 'POST' });
    regenerated.value = true;
    toast.add({ title: 'Nouveau QR code généré', color: 'success', icon: 'i-lucide-refresh-cw' });
    await load();
  } catch {
    // erreur déjà notifiée
  } finally {
    regenerating.value = false;
  }
}

function copyLink() {
  if (!info.value) return;
  copy(info.value.url);
  toast.add({ title: 'Lien copié', color: 'success', icon: 'i-lucide-copy' });
}
</script>

<template>
  <UModal
    :title="`QR code · Table ${table.label}`"
    :description="table.zone ? table.zone.name : undefined"
    @update:open="(o) => !o && emit('close', regenerated)"
  >
    <template #body>
      <div class="flex flex-col items-center gap-4">
        <!-- Carton de table, tel qu'il sera imprimé -->
        <div class="w-64 rounded-2xl border border-default bg-white p-5 text-center shadow-sm">
          <p class="font-display text-lg font-semibold text-neutral-900">{{ restaurant.membership?.name }}</p>
          <div class="mx-auto my-3 size-48">
            <USkeleton v-if="loading" class="size-full" />
            <img v-else-if="svgUrl" :src="svgUrl" :alt="`QR code de la table ${table.label}`" class="size-full" >
          </div>
          <p class="text-sm font-medium text-neutral-700">Table {{ table.label }}</p>
          <p class="text-xs text-neutral-500">Scannez pour voir le menu et commander</p>
        </div>

        <div v-if="info" class="flex w-full items-center gap-2 rounded-md bg-elevated px-3 py-2">
          <UIcon name="i-lucide-link" class="size-4 shrink-0 text-muted" />
          <span class="min-w-0 flex-1 truncate font-mono text-xs">{{ info.url }}</span>
          <UButton size="xs" color="neutral" variant="ghost" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" aria-label="Copier le lien" @click="copyLink" />
        </div>
        <p v-if="info" class="text-xs text-muted">Version {{ info.version }} du QR code</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <UButton
          v-if="restaurant.can('tables.manage')"
          color="warning"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          label="Régénérer"
          :loading="regenerating"
          @click="regenerate"
        />
        <span v-else />
        <div class="flex gap-2">
          <UButton color="neutral" variant="outline" icon="i-lucide-download" label="SVG" :loading="downloading === 'svg'" @click="download('svg')" />
          <UButton icon="i-lucide-download" label="PNG haute définition" :loading="downloading === 'png'" @click="download('png')" />
        </div>
      </div>
    </template>
  </UModal>
</template>
