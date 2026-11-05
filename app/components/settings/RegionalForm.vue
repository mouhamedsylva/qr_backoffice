<script setup lang="ts">
/** Devise, langue, fuseau horaire (RES-03) puis TVA et frais de service (RES-04). */
const { save, saving, details, canSettings } = useSettingsSave();
const { money } = useMoney();

const CURRENCIES = [
  { value: 'XOF', label: 'Franc CFA (BCEAO) · XOF' },
  { value: 'XAF', label: 'Franc CFA (BEAC) · XAF' },
  { value: 'GNF', label: 'Franc guinéen · GNF' },
  { value: 'MAD', label: 'Dirham marocain · MAD' },
  { value: 'NGN', label: 'Naira · NGN' },
  { value: 'GHS', label: 'Cedi · GHS' },
  { value: 'EUR', label: 'Euro · EUR' },
  { value: 'USD', label: 'Dollar US · USD' },
];
const LOCALES = [
  { value: 'fr-SN', label: 'Français (Sénégal)' },
  { value: 'fr-CI', label: "Français (Côte d'Ivoire)" },
  { value: 'fr-ML', label: 'Français (Mali)' },
  { value: 'fr-CM', label: 'Français (Cameroun)' },
  { value: 'fr-FR', label: 'Français (France)' },
  { value: 'en-GB', label: 'English' },
];
const TIMEZONES = [
  'Africa/Dakar', 'Africa/Abidjan', 'Africa/Bamako', 'Africa/Ouagadougou', 'Africa/Conakry', 'Africa/Lome',
  'Africa/Porto-Novo', 'Africa/Niamey', 'Africa/Lagos', 'Africa/Douala', 'Africa/Libreville', 'Africa/Casablanca', 'Europe/Paris',
];

const regional = reactive({ currency: 'XOF', locale: 'fr-SN', timezone: 'Africa/Dakar' });
// Pourcentages saisis ; l'API stocke des points de base (18 % = 1800).
const tax = reactive({ taxEnabled: false, taxRate: 18, pricesIncludeTax: true, serviceFee: 0 });

watch(
  details,
  (d) => {
    if (!d) return;
    Object.assign(regional, { currency: d.currency, locale: d.locale, timezone: d.timezone });
    Object.assign(tax, {
      taxEnabled: d.taxEnabled,
      taxRate: d.taxEnabled || d.taxRateBp ? d.taxRateBp / 100 : 18,
      pricesIncludeTax: d.pricesIncludeTax,
      serviceFee: d.serviceFeeBp / 100,
    });
  },
  { immediate: true },
);

const currencyChanged = computed(() => !!details.value && regional.currency !== details.value.currency);

// Exemple chiffré pour un plat à 10 000 (unité principale) — calcul indicatif.
const example = computed(() => {
  const base = 10_000 * 10 ** fractionDigits(regional.currency);
  const rate = tax.taxEnabled ? tax.taxRate / 100 : 0;
  const service = Math.round(base * (tax.serviceFee / 100));
  const vat = tax.pricesIncludeTax ? Math.round(base - base / (1 + rate)) : Math.round(base * rate);
  const total = (tax.pricesIncludeTax ? base : base + vat) + service;
  return { base, vat, service, total };
});

function saveRegional() {
  return save('/regional', { ...regional }, 'Paramètres régionaux enregistrés');
}
function saveTax() {
  return save(
    '/tax',
    {
      taxEnabled: tax.taxEnabled,
      taxRateBp: Math.round(tax.taxRate * 100),
      pricesIncludeTax: tax.pricesIncludeTax,
      serviceFeeBp: Math.round(tax.serviceFee * 100),
    },
    'Taxes enregistrées',
  );
}
</script>

<template>
  <div class="space-y-6">
    <UPageCard title="Région" description="Devise des prix, format des dates et des montants, heure locale du restaurant." variant="subtle">
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Devise">
          <USelectMenu v-model="regional.currency" :items="CURRENCIES" value-key="value" :disabled="!canSettings" class="w-full" />
        </UFormField>
        <UFormField label="Langue et format">
          <USelectMenu v-model="regional.locale" :items="LOCALES" value-key="value" :disabled="!canSettings" class="w-full" />
        </UFormField>
        <UFormField label="Fuseau horaire">
          <USelectMenu v-model="regional.timezone" :items="TIMEZONES" :disabled="!canSettings" class="w-full" />
        </UFormField>
      </div>
      <UAlert
        v-if="currencyChanged"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Les prix ne sont pas convertis"
        description="Changer de devise ne recalcule pas les prix du menu : vérifiez-les après l'enregistrement."
      />
      <div v-if="canSettings" class="flex justify-end">
        <UButton label="Enregistrer" icon="i-lucide-save" :loading="saving" @click="saveRegional" />
      </div>
    </UPageCard>

    <UPageCard title="TVA et frais de service" description="Appliqués à chaque commande et détaillés sur le reçu." variant="subtle">
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <USwitch v-model="tax.taxEnabled" :disabled="!canSettings" label="Appliquer la TVA" />
          <template v-if="tax.taxEnabled">
            <UFormField label="Taux de TVA" hint="%">
              <UInputNumber v-model="tax.taxRate" :min="0" :max="100" :step="0.5" :disabled="!canSettings" class="w-32" />
            </UFormField>
            <URadioGroup
              v-model="tax.pricesIncludeTax"
              :disabled="!canSettings"
              :items="[
                { label: 'Prix TTC', description: 'Les prix du menu incluent déjà la TVA', value: true },
                { label: 'Prix HT', description: 'La TVA s\'ajoute au prix du menu', value: false },
              ]"
            />
          </template>
          <UFormField label="Frais de service" hint="%" help="0 pour ne pas en appliquer.">
            <UInputNumber v-model="tax.serviceFee" :min="0" :max="100" :step="0.5" :disabled="!canSettings" class="w-32" />
          </UFormField>
        </div>

        <div class="h-fit space-y-1 rounded-lg border border-default p-4 text-sm">
          <p class="mb-2 text-xs text-muted">Exemple pour un plat à {{ money(example.base, regional.currency) }}</p>
          <div class="flex justify-between"><span class="text-muted">Prix du menu</span><span class="tabular">{{ money(example.base, regional.currency) }}</span></div>
          <div v-if="example.service" class="flex justify-between"><span class="text-muted">Service ({{ tax.serviceFee }} %)</span><span class="tabular">{{ money(example.service, regional.currency) }}</span></div>
          <div v-if="tax.taxEnabled" class="flex justify-between">
            <span class="text-muted">{{ tax.pricesIncludeTax ? 'dont TVA' : 'TVA' }} ({{ tax.taxRate }} %)</span>
            <span class="tabular">{{ money(example.vat, regional.currency) }}</span>
          </div>
          <div class="flex justify-between border-t border-default pt-2 font-semibold text-highlighted">
            <span>Payé par le client</span><span class="tabular">{{ money(example.total, regional.currency) }}</span>
          </div>
        </div>
      </div>
      <div v-if="canSettings" class="flex justify-end">
        <UButton label="Enregistrer" icon="i-lucide-save" :loading="saving" @click="saveTax" />
      </div>
    </UPageCard>
  </div>
</template>
