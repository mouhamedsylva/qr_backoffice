<script setup lang="ts">
/**
 * Champ téléphone avec l'indicatif +221 affiché d'office : la valeur liée
 * (v-model) est le numéro international (+221771234567) attendu par l'API.
 * Commencer la saisie par « + » ou « 00 » permet un numéro étranger.
 */
import { DEFAULT_DIAL_CODE, formatSenegal, toInternational, toLocalDisplay } from '~/utils/phone';

withDefaults(defineProps<{ placeholder?: string; autofocus?: boolean; autocomplete?: string }>(), {
  placeholder: '77 123 45 67',
  autofocus: false,
  autocomplete: 'tel-national',
});
const model = defineModel<string>({ default: '' });

const text = ref(toLocalDisplay(model.value));
// Valeur modifiée de l'extérieur (chargement des réglages, réinitialisation).
watch(model, (v) => {
  if (toInternational(text.value) !== (v ?? '')) text.value = toLocalDisplay(v);
});

/** Numéro étranger en cours de saisie : l'indicatif par défaut est masqué. */
const foreign = computed(() => /^\s*(\+|00)/.test(text.value));

function onInput(value: string | number) {
  const raw = String(value);
  // Numéro local : mis en forme au fil de la saisie (77 123 45 67).
  text.value = /^\s*(\+|00)/.test(raw) ? raw : formatSenegal(raw);
  model.value = toInternational(text.value);
}
</script>

<template>
  <UInput
    :model-value="text"
    type="tel"
    inputmode="tel"
    :autocomplete="autocomplete"
    :autofocus="autofocus"
    :placeholder="placeholder"
    :ui="{ base: foreign ? undefined : 'ps-[4.75rem]' }"
    @update:model-value="onInput"
  >
    <template v-if="!foreign" #leading>
      <span class="flex items-center gap-1.5 text-sm text-muted">
        <span aria-hidden="true">🇸🇳</span>
        <span class="tabular font-medium text-highlighted">{{ DEFAULT_DIAL_CODE }}</span>
      </span>
    </template>
    <template v-else #leading>
      <UIcon name="i-lucide-globe" class="size-4 text-muted" />
    </template>
  </UInput>
</template>
