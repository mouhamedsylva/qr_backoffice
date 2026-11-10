<script setup lang="ts">
/**
 * Photo envoyée depuis l'ordinateur ou le téléphone (appareil photo ou galerie).
 * Le fichier part tout de suite à l'API, qui le recompresse ; le v-model reçoit
 * l'URL publique de la photo ('' si aucune).
 */
const props = withDefaults(
  defineProps<{
    endpoint: string;
    /** Paramètres ajoutés à l'URL d'envoi (ex. { kind: 'logo' }). */
    query?: Record<string, string>;
    /** Forme de l'aperçu : photo de plat, logo carré ou bannière large. */
    variant?: 'photo' | 'logo' | 'banner';
    disabled?: boolean;
  }>(),
  { query: undefined, variant: 'photo', disabled: false },
);
const model = defineModel<string>({ default: '' });

const api = useApi();
const input = useTemplateRef<HTMLInputElement>('input');
const uploading = ref(false);
const error = ref<string | null>(null);
const dragging = ref(false);
/** Aperçu local affiché pendant l'envoi. */
const preview = ref<string | null>(null);

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif';

async function send(file: File) {
  error.value = null;
  if (!file.type.startsWith('image/')) {
    error.value = 'Choisissez une photo (JPEG, PNG ou WebP).';
    return;
  }
  if (file.size > MAX_BYTES) {
    error.value = 'Photo trop lourde : 10 Mo maximum.';
    return;
  }
  preview.value = URL.createObjectURL(file);
  uploading.value = true;
  try {
    const body = new FormData();
    body.append('file', file);
    const res = await api<{ url: string }>(props.endpoint, { method: 'POST', body, query: props.query, silent: true });
    model.value = res.url;
  } catch (err) {
    error.value = apiErrorMessage(err);
  } finally {
    uploading.value = false;
    if (preview.value) URL.revokeObjectURL(preview.value);
    preview.value = null;
  }
}

function onPick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) void send(file);
  (event.target as HTMLInputElement).value = '';
}

function onDrop(event: DragEvent) {
  dragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file && !props.disabled && !uploading.value) void send(file);
}

function pick() {
  if (!props.disabled && !uploading.value) input.value?.click();
}

const shown = computed(() => preview.value ?? model.value);
const PREVIEW_CLASS = {
  photo: 'size-28 rounded-lg',
  logo: 'size-24 rounded-xl',
  banner: 'aspect-[8/3] w-full max-w-md rounded-lg',
} as const;
const LABEL = { photo: 'Ajouter une photo', logo: 'Ajouter le logo', banner: 'Ajouter la bannière' } as const;
const CHANGE = { photo: 'Changer la photo', logo: 'Changer le logo', banner: 'Changer la bannière' } as const;
</script>

<template>
  <div class="space-y-2">
    <input ref="input" type="file" :accept="ACCEPT" class="hidden" @change="onPick">

    <!-- Photo en place -->
    <div v-if="shown" class="flex items-center gap-4" :class="variant === 'banner' && 'flex-col items-start sm:flex-row sm:items-center'">
      <div class="relative shrink-0 overflow-hidden border border-default bg-elevated" :class="PREVIEW_CLASS[variant]">
        <img :src="shown" alt="" class="size-full object-cover">
        <div v-if="uploading" class="absolute inset-0 flex items-center justify-center bg-black/40">
          <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-white" />
        </div>
      </div>
      <div class="flex gap-2" :class="variant === 'banner' ? 'flex-row sm:flex-col' : 'flex-col'">
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-refresh-cw"
          :label="CHANGE[variant]"
          :disabled="disabled || uploading"
          @click="pick"
        />
        <UButton
          color="error"
          variant="ghost"
          size="sm"
          icon="i-lucide-trash-2"
          label="Retirer"
          :disabled="disabled || uploading"
          @click="model = ''"
        />
      </div>
    </div>

    <!-- Zone d'envoi -->
    <button
      v-else
      type="button"
      class="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition"
      :class="[
        dragging ? 'border-primary bg-primary/5' : 'border-accented hover:border-primary/60 hover:bg-elevated/50',
        disabled && 'cursor-not-allowed opacity-50',
      ]"
      :disabled="disabled"
      @click="pick"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <UIcon name="i-lucide-image-plus" class="size-7 text-muted" />
      <span class="text-sm font-medium text-highlighted">{{ LABEL[variant] }}</span>
      <span class="text-xs text-muted">Cliquez ou glissez une image · JPEG, PNG ou WebP · 10 Mo max</span>
    </button>

    <p v-if="error" class="text-sm text-error">{{ error }}</p>
  </div>
</template>
