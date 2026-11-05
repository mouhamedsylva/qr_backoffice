<script setup lang="ts">
/** Création / modification d'une catégorie (MEN-01). */
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';
import type { Category } from '~/types/api';

const props = defineProps<{ category?: Category | null; parents: Category[]; defaultParentId?: string | null }>();
const emit = defineEmits<{ close: [saved: boolean] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();
const { stations, items: stationItems } = useStations();

const schema = z.object({
  name: z.string().trim().min(1, 'Nom obligatoire').max(100),
  description: z.string().trim().max(500).optional(),
  parentId: z.string().nullable(),
  isActive: z.boolean(),
  stationId: z.string().nullable(),
});
type Schema = z.output<typeof schema>;

const state = reactive<Schema>({
  name: props.category?.name ?? '',
  description: props.category?.description ?? '',
  parentId: props.category ? props.category.parentId : (props.defaultParentId ?? null),
  isActive: props.category?.isActive ?? true,
  stationId: props.category?.stationId ?? null,
});

// Un seul niveau de sous-catégorie ; une catégorie ne peut être son propre parent.
const parentItems = computed(() => [
  { label: 'Aucune (catégorie principale)', value: null },
  ...props.parents.filter((p) => p.id !== props.category?.id).map((p) => ({ label: p.name, value: p.id })),
]);
const hasChildren = computed(() => !!props.category?.children?.length);

const saving = ref(false);
async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true;
  const body = { ...event.data, description: event.data.description || undefined };
  try {
    if (props.category) {
      await api(`${restaurant.base}/menu/categories/${props.category.id}`, { method: 'PATCH', body });
    } else {
      await api(`${restaurant.base}/menu/categories`, {
        method: 'POST',
        body: { ...body, parentId: body.parentId ?? undefined, stationId: body.stationId ?? undefined },
      });
    }
    toast.add({ title: props.category ? 'Catégorie modifiée' : 'Catégorie créée', color: 'success', icon: 'i-lucide-check' });
    emit('close', true);
  } catch {
    // erreur déjà notifiée
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal
    :title="category ? 'Modifier la catégorie' : 'Nouvelle catégorie'"
    @update:open="(o) => !o && emit('close', false)"
  >
    <template #body>
      <UForm id="category-form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Nom" name="name" required>
          <UInput v-model="state.name" autofocus class="w-full" placeholder="Ex. Plats, Boissons, Desserts" />
        </UFormField>
        <UFormField label="Description" name="description">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>
        <UFormField
          label="Catégorie parente"
          name="parentId"
          :help="hasChildren ? 'Cette catégorie contient des sous-catégories : elle reste principale.' : undefined"
        >
          <USelect v-model="state.parentId" :items="parentItems" :disabled="hasChildren" class="w-full" />
        </UFormField>
        <UFormField v-if="stations.length" label="Poste de cuisine" name="stationId" help="Les plats de la catégorie s'affichent sur cet écran cuisine.">
          <USelect v-model="state.stationId" :items="stationItems" class="w-full" />
        </UFormField>
        <USwitch v-model="state.isActive" label="Visible sur le menu client" />
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="emit('close', false)" />
        <UButton type="submit" form="category-form" :loading="saving" :label="category ? 'Enregistrer' : 'Créer'" />
      </div>
    </template>
  </UModal>
</template>
