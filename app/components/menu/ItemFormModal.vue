<script setup lang="ts">
/** Création / modification d'un article (MEN-02, MEN-03, MEN-05). */
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';
import type { Category, MenuItem } from '~/types/api';
import { fromGroupDrafts, toGroupDrafts, type OptionGroupDraft } from '~/types/menu-form';
import { ALLERGENS, DIETARY_TAGS, toSelectItems } from '~/utils/menu';

const props = defineProps<{ item?: MenuItem | null; categories: Category[]; defaultCategoryId?: string | null }>();
const emit = defineEmits<{ close: [saved: MenuItem | null] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();
const { money } = useMoney();
const { stations, items: stationItems } = useStations();
const currency = computed(() => restaurant.currency);

const schema = z.object({
  categoryId: z.string({ error: 'Choisissez une catégorie' }).min(1, 'Choisissez une catégorie'),
  name: z.string().trim().min(1, 'Nom obligatoire').max(150),
  description: z.string().trim().max(2000).optional(),
  price: z.number({ error: 'Prix obligatoire' }).min(0, 'Prix invalide'),
  prepTimeMinutes: z.number().int().min(0).max(600).nullable(),
  calories: z.number().int().min(0).nullable(),
  imageUrl: z.string(),
  isActive: z.boolean(),
  stationId: z.string().nullable(),
  allergens: z.array(z.string()),
  dietaryTags: z.array(z.string()),
});
type Schema = z.output<typeof schema>;

const editing = props.item ?? null;
const state = reactive<Schema>({
  categoryId: editing?.categoryId ?? props.defaultCategoryId ?? '',
  name: editing?.name ?? '',
  description: editing?.description ?? '',
  price: editing ? fromMinorUnits(editing.priceAmount, currency.value) : (undefined as unknown as number),
  prepTimeMinutes: editing?.prepTimeMinutes ?? null,
  calories: editing?.calories ?? null,
  imageUrl: editing?.images?.[0] ?? '',
  isActive: editing?.isActive ?? true,
  stationId: editing?.stationId ?? null,
  allergens: editing?.allergens ?? [],
  dietaryTags: editing?.dietaryTags ?? [],
});
const groups = ref<OptionGroupDraft[]>(editing ? toGroupDrafts(editing.optionGroups, currency.value) : []);

const categoryItems = computed(() =>
  props.categories.flatMap((c) => [
    { label: c.name, value: c.id },
    ...(c.children ?? []).map((s) => ({ label: `${c.name} › ${s.name}`, value: s.id })),
  ]),
);

const groupsValid = computed(() =>
  groups.value.every((g) => g.name.trim() && g.options.some((o) => o.name.trim()) && g.minSelect <= g.maxSelect),
);

const tab = ref('general');
const tabs = [
  { label: 'Général', value: 'general', icon: 'i-lucide-utensils' },
  { label: 'Options', value: 'options', icon: 'i-lucide-list-plus' },
  { label: 'Allergènes & régimes', value: 'diet', icon: 'i-lucide-wheat' },
];

const saving = ref(false);
async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!groupsValid.value) {
    tab.value = 'options';
    return;
  }
  const d = event.data;
  const body = {
    categoryId: d.categoryId,
    name: d.name,
    description: d.description || undefined,
    priceAmount: toMinorUnits(d.price, currency.value),
    prepTimeMinutes: d.prepTimeMinutes ?? undefined,
    calories: d.calories ?? undefined,
    images: d.imageUrl ? [d.imageUrl] : [],
    isActive: d.isActive,
    ...(editing || d.stationId ? { stationId: d.stationId } : {}),
    allergens: d.allergens,
    dietaryTags: d.dietaryTags,
    optionGroups: fromGroupDrafts(groups.value, currency.value),
  };
  saving.value = true;
  try {
    const saved = await api<MenuItem>(`${restaurant.base}/menu/items${editing ? `/${editing.id}` : ''}`, {
      method: editing ? 'PATCH' : 'POST',
      body,
    });
    toast.add({ title: editing ? 'Article modifié' : 'Article ajouté au menu', color: 'success', icon: 'i-lucide-check' });
    emit('close', saved);
  } catch {
    // erreur déjà notifiée
  } finally {
    saving.value = false;
  }
}

function onError() {
  tab.value = 'general';
}
</script>

<template>
  <UModal
    :title="editing ? `Modifier « ${editing.name} »` : 'Nouvel article'"
    :ui="{ content: 'sm:max-w-2xl' }"
    @update:open="(o) => !o && emit('close', null)"
  >
    <template #body>
      <UForm id="item-form" :schema="schema" :state="state" @submit="onSubmit" @error="onError">
        <UTabs v-model="tab" :items="tabs" :content="false" variant="link" class="mb-4" />

        <div v-show="tab === 'general'" class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Nom" name="name" required class="sm:col-span-2">
              <UInput v-model="state.name" class="w-full" placeholder="Ex. Thiéboudienne" autofocus />
            </UFormField>
            <UFormField label="Catégorie" name="categoryId" required>
              <USelectMenu v-model="state.categoryId" :items="categoryItems" value-key="value" class="w-full" placeholder="Choisir" />
            </UFormField>
            <UFormField label="Prix de vente" name="price" required>
              <UInputNumber
                v-model="state.price"
                :min="0"
                class="w-full"
                :format-options="{ style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: fractionDigits(currency) }"
              />
            </UFormField>
            <UFormField label="Temps de préparation" name="prepTimeMinutes" hint="minutes">
              <UInputNumber v-model="state.prepTimeMinutes" :min="0" :max="600" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Description" name="description">
            <UTextarea v-model="state.description" :rows="3" class="w-full" placeholder="Ingrédients, préparation…" />
          </UFormField>
          <UFormField label="Photo" name="imageUrl" help="Affichée au client sur le menu ; elle est automatiquement allégée pour un chargement rapide.">
            <ImageUpload v-model="state.imageUrl" :endpoint="`${restaurant.base}/menu/images`" />
          </UFormField>
          <UFormField v-if="stations.length" label="Poste de cuisine" name="stationId" help="Prioritaire sur le poste de la catégorie.">
            <USelect v-model="state.stationId" :items="stationItems" class="w-full sm:w-64" />
          </UFormField>
          <USwitch v-model="state.isActive" label="Affiché sur le menu client" />
        </div>

        <div v-show="tab === 'options'">
          <p class="mb-3 text-sm text-muted">
            Tailles, cuissons, accompagnements ou suppléments. Les prix sont ajoutés au prix de base
            ({{ state.price ? money(toMinorUnits(state.price, currency)) : '—' }}).
          </p>
          <MenuOptionGroupsEditor v-model="groups" :currency="currency" />
        </div>

        <div v-show="tab === 'diet'" class="space-y-5">
          <UFormField label="Allergènes" name="allergens" help="Affichés au client sur la fiche du plat.">
            <UCheckboxGroup v-model="state.allergens" :items="toSelectItems(ALLERGENS)" class="grid grid-cols-2 gap-2 sm:grid-cols-3" />
          </UFormField>
          <UFormField label="Régimes et étiquettes" name="dietaryTags">
            <UCheckboxGroup
              v-model="state.dietaryTags"
              orientation="horizontal"
              :items="Object.entries(DIETARY_TAGS).map(([value, t]) => ({ label: t.label, value }))"
              class="flex-wrap"
            />
          </UFormField>
          <UFormField label="Calories" name="calories" hint="kcal, facultatif">
            <UInputNumber v-model="state.calories" :min="0" class="w-40" />
          </UFormField>
        </div>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <p v-if="!groupsValid" class="text-sm text-error">Complétez les groupes d'options.</p>
        <span v-else />
        <div class="flex gap-2">
          <UButton color="neutral" variant="ghost" label="Annuler" @click="emit('close', null)" />
          <UButton type="submit" form="item-form" :loading="saving" :label="props.item ? 'Enregistrer' : 'Ajouter'" />
        </div>
      </div>
    </template>
  </UModal>
</template>
