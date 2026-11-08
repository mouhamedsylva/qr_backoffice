<script setup lang="ts">
/**
 * Photo envoyée depuis l'ordinateur ou le téléphone (appareil photo ou galerie).
 * Le fichier part tout de suite à l'API, qui le recompresse ; le v-model reçoit
 * l'URL publique de la photo ('' si aucune).
 */
const props = withDefaults(defineProps<{ endpoint: string; disabled?: boolean }>(), { disabled: false });
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
    const res = await api<{ url: string }>(props.endpoint, { method: 'POST', body, silent: true });
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
</script>

<template>
  <div class="space-y-2">
    <input ref="input" type="file" :accept="ACCEPT" class="hidden" @change="onPick">

    <!-- Photo en place -->
    <div v-if="shown" class="flex items-center gap-4">
      <div class="relative size-28 shrink-0 overflow-hidden rounded-lg border border-default bg-elevated">
        <img :src="shown" alt="Photo du plat" class="size-full object-cover">
        <div v-if="uploading" class="absolute inset-0 flex items-center justify-center bg-black/40">
          <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-white" />
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-refresh-cw"
          label="Changer la photo"
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
      <span class="text-sm font-medium text-highlighted">Ajouter une photo</span>
      <span class="text-xs text-muted">Cliquez ou glissez une image · JPEG, PNG ou WebP · 10 Mo max</span>
    </button>

    <p v-if="error" class="text-sm text-error">{{ error }}</p>
  </div>
</template>
