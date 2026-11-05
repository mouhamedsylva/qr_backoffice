<script setup lang="ts">
/** Groupes d'options d'un article : tailles, accompagnements, suppléments (MEN-03). */
import { draftKey, type OptionDraft, type OptionGroupDraft } from '~/types/menu-form';

const groups = defineModel<OptionGroupDraft[]>({ required: true });
defineProps<{ currency: string }>();

const newOption = (): OptionDraft => ({ key: draftKey(), name: '', priceDelta: 0, isAvailable: true });

function addGroup(preset?: 'size' | 'extras') {
  groups.value.push({
    key: draftKey(),
    name: preset === 'size' ? 'Taille' : preset === 'extras' ? 'Suppléments' : '',
    isRequired: preset === 'size',
    minSelect: preset === 'size' ? 1 : 0,
    maxSelect: preset === 'extras' ? 5 : 1,
    options: preset === 'size'
      ? [{ ...newOption(), name: 'Normale' }, { ...newOption(), name: 'Grande' }]
      : [newOption()],
  });
}

function setRequired(group: OptionGroupDraft, value: boolean) {
  group.isRequired = value;
  if (value && group.minSelect < 1) group.minSelect = 1;
  if (!value) group.minSelect = 0;
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(group, gi) in groups"
      :key="group.key"
      class="space-y-3 rounded-lg border border-default p-3"
    >
      <div class="flex items-start gap-2">
        <UFormField label="Nom du groupe" class="flex-1" :error="!group.name.trim() ? 'Obligatoire' : undefined">
          <UInput v-model="group.name" class="w-full" placeholder="Ex. Accompagnement" />
        </UFormField>
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          class="mt-6"
          aria-label="Supprimer le groupe"
          @click="groups.splice(gi, 1)"
        />
      </div>

      <div class="flex flex-wrap items-end gap-4">
        <USwitch :model-value="group.isRequired" label="Choix obligatoire" @update:model-value="setRequired(group, $event)" />
        <UFormField label="Min." size="xs">
          <UInputNumber v-model="group.minSelect" :min="0" :max="group.maxSelect" size="xs" class="w-24" />
        </UFormField>
        <UFormField label="Max." size="xs">
          <UInputNumber v-model="group.maxSelect" :min="Math.max(1, group.minSelect)" :max="group.options.length || 1" size="xs" class="w-24" />
        </UFormField>
        <p class="text-xs text-muted">
          {{ group.maxSelect === 1 ? 'Le client choisit une option.' : `Jusqu'à ${group.maxSelect} options.` }}
        </p>
      </div>

      <ul class="space-y-2">
        <li v-for="(option, oi) in group.options" :key="option.key" class="flex items-center gap-2">
          <UInput v-model="option.name" size="sm" class="flex-1" placeholder="Nom de l'option" />
          <UInputNumber
            v-model="option.priceDelta"
            :min="0"
            size="sm"
            class="w-36"
            :format-options="{ style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: fractionDigits(currency) }"
          />
          <UTooltip :text="option.isAvailable ? 'Disponible' : 'Épuisée'">
            <USwitch v-model="option.isAvailable" size="sm" aria-label="Option disponible" />
          </UTooltip>
          <UButton
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="group.options.length === 1"
            aria-label="Retirer l'option"
            @click="group.options.splice(oi, 1)"
          />
        </li>
      </ul>
      <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-plus" label="Option" @click="group.options.push(newOption())" />
    </div>

    <div class="flex flex-wrap gap-2">
      <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-plus" label="Groupe d'options" @click="addGroup()" />
      <UButton size="sm" color="neutral" variant="ghost" label="+ Tailles" @click="addGroup('size')" />
      <UButton size="sm" color="neutral" variant="ghost" label="+ Suppléments" @click="addGroup('extras')" />
    </div>
  </div>
</template>
