<script setup lang="ts">
/** Identité visuelle : couleur de marque, logo, bannière, thème du menu (RES-02). */
import { AA_CONTRAST, contrastRatio, generatePalette, SHADES } from '~/utils/palette';

const { save, saving, details, canEdit } = useSettingsSave();
const restaurant = useRestaurantStore();
const imagesEndpoint = computed(() => `${restaurant.base}/branding/images`);

/** Couleur par défaut de QR-Order (terracotta 500). */
const DEFAULT_PRIMARY = '#cc4a12';
const PRESETS = ['#cc4a12', '#c2410c', '#b91c1c', '#be185d', '#7c3aed', '#1d4ed8', '#0e7490', '#047857', '#4d7c0f', '#a16207', '#57534e'];

const state = reactive({
  primary: DEFAULT_PRIMARY,
  useBrand: false,
  logoUrl: '',
  bannerUrl: '',
  menuTheme: 'LIGHT' as 'LIGHT' | 'DARK',
});

watch(
  details,
  (d) => {
    if (!d) return;
    state.useBrand = !!d.brandColors?.primary;
    state.primary = d.brandColors?.primary ?? DEFAULT_PRIMARY;
    state.logoUrl = d.logoUrl ?? '';
    state.bannerUrl = d.bannerUrl ?? '';
    state.menuTheme = d.menuTheme;
  },
  { immediate: true },
);

const validHex = computed(() => /^#[0-9a-f]{6}$/i.test(state.primary));
const palette = computed(() => (validHex.value ? generatePalette(state.primary) : null));
/** Lisibilité du texte blanc sur la couleur choisie telle quelle. */
const rawContrast = computed(() => (validHex.value ? contrastRatio(state.primary, '#ffffff') : 0));
const adjusted = computed(() => !!palette.value && palette.value[500].toLowerCase() !== state.primary.toLowerCase());

const valid = computed(() => validHex.value);

async function submit() {
  if (!valid.value) return;
  await save(
    '/branding',
    {
      brandColors: state.useBrand ? { primary: state.primary.toLowerCase() } : {},
      menuTheme: state.menuTheme,
      // null : logo ou bannière retiré(e).
      logoUrl: state.logoUrl || null,
      bannerUrl: state.bannerUrl || null,
    },
    'Identité visuelle mise à jour',
  );
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <UPageCard
      title="Couleur de marque"
      description="Elle remplace la couleur terracotta dans le back-office et sur le menu client."
      variant="subtle"
    >
      <USwitch v-model="state.useBrand" :disabled="!canEdit" label="Utiliser la couleur de mon restaurant" />

      <div v-if="state.useBrand" class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in PRESETS"
              :key="c"
              type="button"
              class="size-8 rounded-full ring-offset-2 ring-offset-default transition hover:scale-110"
              :class="state.primary.toLowerCase() === c && 'ring-2 ring-inverted'"
              :style="{ backgroundColor: c }"
              :aria-label="`Choisir ${c}`"
              :disabled="!canEdit"
              @click="state.primary = c"
            />
          </div>
          <div class="flex items-center gap-2">
            <UPopover>
              <UButton color="neutral" variant="outline" :disabled="!canEdit" aria-label="Nuancier">
                <span class="size-5 rounded" :style="{ backgroundColor: validHex ? state.primary : 'transparent' }" />
              </UButton>
              <template #content>
                <UColorPicker v-model="state.primary" class="p-2" />
              </template>
            </UPopover>
            <UInput v-model="state.primary" :disabled="!canEdit" class="w-32 font-mono" placeholder="#cc4a12" />
            <span v-if="!validHex" class="text-sm text-error">Code couleur à 6 chiffres, ex. #1d4ed8</span>
          </div>

          <UAlert
            v-if="validHex && rawContrast < AA_CONTRAST"
            color="info"
            variant="subtle"
            icon="i-lucide-contrast"
            title="Teinte ajustée pour rester lisible"
            :description="`Le texte blanc sur cette couleur est peu lisible (contraste ${rawContrast.toFixed(1)}:1, minimum 4,5:1). Les boutons utiliseront une nuance plus foncée de la même teinte.`"
          />
          <p v-else-if="validHex" class="flex items-center gap-1.5 text-sm text-success">
            <UIcon name="i-lucide-circle-check" /> Bonne lisibilité ({{ rawContrast.toFixed(1) }}:1)
          </p>
        </div>

        <!-- Aperçu -->
        <div v-if="palette" class="space-y-3">
          <div class="flex overflow-hidden rounded-lg border border-default">
            <div v-for="s in SHADES" :key="s" class="h-10 flex-1" :style="{ backgroundColor: palette[s] }" :title="`${s} · ${palette[s]}`" />
          </div>
          <div class="rounded-lg border border-default p-4">
            <p class="mb-3 text-xs text-muted">Aperçu</p>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-md px-3 py-1.5 text-sm font-medium text-white" :style="{ backgroundColor: palette[500] }">Commander</span>
              <span class="rounded-md px-3 py-1.5 text-sm font-medium" :style="{ backgroundColor: palette[100], color: palette[700] }">Prioritaire</span>
              <span class="text-sm font-semibold" :style="{ color: palette[600] }">3 500 F CFA</span>
              <span v-if="adjusted" class="text-xs text-muted">(bouton : {{ palette[500] }})</span>
            </div>
          </div>
        </div>
      </div>
    </UPageCard>

    <UPageCard
      title="Images"
      description="Envoyées depuis votre ordinateur ou votre téléphone, puis allégées automatiquement. Pensez à enregistrer."
      variant="subtle"
    >
      <div class="grid gap-6 sm:grid-cols-[auto_1fr]">
        <UFormField label="Logo" help="Carré de préférence.">
          <ImageUpload v-model="state.logoUrl" :endpoint="imagesEndpoint" :query="{ kind: 'logo' }" variant="logo" :disabled="!canEdit" />
        </UFormField>
        <UFormField label="Bannière du menu" help="Format paysage, environ 1600 × 600 px.">
          <ImageUpload v-model="state.bannerUrl" :endpoint="imagesEndpoint" :query="{ kind: 'banner' }" variant="banner" :disabled="!canEdit" />
        </UFormField>
      </div>
    </UPageCard>

    <UPageCard title="Thème du menu client" variant="subtle">
      <URadioGroup
        v-model="state.menuTheme"
        :disabled="!canEdit"
        orientation="horizontal"
        variant="card"
        :items="[
          { label: 'Clair', description: 'Fond blanc, idéal en journée', value: 'LIGHT' },
          { label: 'Sombre', description: 'Ambiance tamisée, soirée', value: 'DARK' },
        ]"
      />
    </UPageCard>

    <div v-if="canEdit" class="flex justify-end">
      <UButton type="submit" label="Enregistrer" icon="i-lucide-save" :disabled="!valid" :loading="saving" />
    </div>
  </form>
</template>
