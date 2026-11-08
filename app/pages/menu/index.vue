<script setup lang="ts">
import { refDebounced } from '@vueuse/core';
import { VueDraggable } from 'vue-draggable-plus';
import type { DropdownMenuItem } from '@nuxt/ui';
import { ConfirmModal, MenuCategoryFormModal, MenuImportModal, MenuItemFormModal } from '#components';
import type { Category, MenuItem, Paginated } from '~/types/api';
import { ALLERGENS, DIETARY_TAGS } from '~/utils/menu';

useHead({ title: 'Menu · QR-Order' });

const api = useApi();
const restaurant = useRestaurantStore();
const realtime = useRealtime();
const toast = useToast();
const overlay = useOverlay();
const { money } = useMoney();

const canManage = computed(() => restaurant.can('menu.manage'));
const categoryModal = overlay.create(MenuCategoryFormModal);
const itemModal = overlay.create(MenuItemFormModal);
const confirmModal = overlay.create(ConfirmModal);
const importModal = overlay.create(MenuImportModal);
const previewOpen = ref(false);

// --- Catégories ---
const { data: categories, status: catStatus, refresh: refreshCategories } = await useAsyncData(
  'menu-categories',
  () => api<Category[]>(`${restaurant.base}/menu/categories`),
  { default: () => [], watch: [() => restaurant.id] },
);
const allCategories = computed(() => categories.value.flatMap((c) => [c, ...(c.children ?? [])]));
const categoryName = (id: string) => allCategories.value.find((c) => c.id === id)?.name ?? '—';

const selected = ref<string | null>(null);
const selectedCategory = computed(() => allCategories.value.find((c) => c.id === selected.value) ?? null);

async function openCategory(category: Category | null, parentId: string | null = null) {
  const saved = await categoryModal.open({ category, parents: categories.value, defaultParentId: parentId });
  if (saved) await refreshCategories();
}

async function removeCategory(category: Category) {
  const ok = await confirmModal.open({
    title: `Supprimer « ${category.name} » ?`,
    description: 'La catégorie doit être vide (ni article, ni sous-catégorie).',
    confirmLabel: 'Supprimer',
  });
  if (!ok) return;
  try {
    await api(`${restaurant.base}/menu/categories/${category.id}`, { method: 'DELETE' });
    if (selected.value === category.id) selected.value = null;
    toast.add({ title: 'Catégorie supprimée', color: 'success', icon: 'i-lucide-trash-2' });
    await refreshCategories();
  } catch {
    // erreur déjà notifiée (ex. CATEGORY_NOT_EMPTY)
  }
}

async function reorderCategories(ids: string[]) {
  try {
    await api(`${restaurant.base}/menu/categories/reorder`, { method: 'PUT', body: { ids } });
  } catch {
    await refreshCategories();
  }
}

// --- Articles ---
const search = ref('');
const searchDebounced = refDebounced(search, 300);
const page = ref(1);
const limit = 50;
watch([selected, searchDebounced], () => (page.value = 1));

const { data: itemsPage, status: itemsStatus, refresh: refreshItems } = await useAsyncData(
  'menu-items',
  () =>
    api<Paginated<MenuItem>>(`${restaurant.base}/menu/items`, {
      query: {
        page: page.value,
        limit,
        ...(selected.value && { categoryId: selected.value }),
        ...(searchDebounced.value.trim() && { search: searchDebounced.value.trim() }),
      },
    }),
  { watch: [selected, searchDebounced, page, () => restaurant.id] },
);

// Liste locale pour le glisser-déposer (dans une catégorie, sans recherche).
const items = ref<MenuItem[]>([]);
watch(() => itemsPage.value?.data, (data) => (items.value = [...(data ?? [])]), { immediate: true });
const canReorder = computed(() => canManage.value && !!selected.value && !searchDebounced.value && (itemsPage.value?.meta.totalPages ?? 1) === 1);

async function reorderItems() {
  if (!selected.value) return;
  try {
    await api(`${restaurant.base}/menu/items/reorder`, {
      method: 'PUT',
      body: { categoryId: selected.value, ids: items.value.map((i) => i.id) },
    });
  } catch {
    await refreshItems();
  }
}

function replaceItem(updated: MenuItem) {
  const index = items.value.findIndex((i) => i.id === updated.id);
  if (index >= 0) items.value[index] = { ...items.value[index], ...updated };
}

/** Import CSV / Excel de tout un menu. */
async function openImport() {
  if (await importModal.open()) await Promise.all([refreshItems(), refreshCategories()]);
}

async function openItem(item: MenuItem | null) {
  if (!item && !categories.value.length) {
    toast.add({ title: 'Créez d\'abord une catégorie', color: 'warning', icon: 'i-lucide-folder-plus' });
    return;
  }
  const saved = await itemModal.open({ item, categories: categories.value, defaultCategoryId: selected.value });
  if (saved) await Promise.all([refreshItems(), refreshCategories()]);
}

async function removeItem(item: MenuItem) {
  const ok = await confirmModal.open({
    title: `Supprimer « ${item.name} » ?`,
    description: 'L\'article disparaît du menu. Les commandes passées restent dans l\'historique.',
    confirmLabel: 'Supprimer',
  });
  if (!ok) return;
  try {
    await api(`${restaurant.base}/menu/items/${item.id}`, { method: 'DELETE' });
    toast.add({ title: 'Article supprimé', color: 'success', icon: 'i-lucide-trash-2' });
    await Promise.all([refreshItems(), refreshCategories()]);
  } catch {
    // erreur déjà notifiée
  }
}

async function toggleActive(item: MenuItem) {
  try {
    const updated = await api<MenuItem>(`${restaurant.base}/menu/items/${item.id}`, {
      method: 'PATCH',
      body: { isActive: !item.isActive },
    });
    replaceItem(updated);
  } catch {
    // erreur déjà notifiée
  }
}

function itemMenu(item: MenuItem): DropdownMenuItem[][] {
  return [
    [
      { label: 'Modifier', icon: 'i-lucide-pencil', onSelect: () => openItem(item) },
      {
        label: item.isActive ? 'Masquer du menu' : 'Afficher sur le menu',
        icon: item.isActive ? 'i-lucide-eye-off' : 'i-lucide-eye',
        onSelect: () => toggleActive(item),
      },
    ],
    [{ label: 'Supprimer', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => removeItem(item) }],
  ];
}

// Disponibilités modifiées ailleurs (cuisine, autre poste) : mise à jour en direct.
realtime.on('menu.item_updated', (message) => {
  const payload = message.payload as Partial<MenuItem> & { id: string };
  if (items.value.some((i) => i.id === payload.id)) replaceItem(payload as MenuItem);
});
</script>

<template>
  <div class="flex min-w-0 flex-1">
    <UDashboardPanel id="menu-categories" :default-size="20" :min-size="16" :max-size="28" resizable class="hidden lg:flex">
      <template #header>
        <UDashboardNavbar title="Menu">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <MenuCategoryList
          v-model:selected="selected"
          :categories="categories"
          :loading="catStatus === 'pending'"
          @create="(parentId) => openCategory(null, parentId)"
          @edit="(c) => openCategory(c)"
          @remove="removeCategory"
          @reorder="reorderCategories"
        />
      </template>
    </UDashboardPanel>

    <UDashboardPanel id="menu-items">
      <template #header>
        <UDashboardNavbar :title="selectedCategory?.name ?? 'Tous les articles'">
          <template #leading>
            <UDashboardSidebarCollapse class="lg:hidden" />
          </template>
          <template #right>
            <UButton color="neutral" variant="outline" icon="i-lucide-smartphone" label="Aperçu client" class="hidden sm:inline-flex" @click="previewOpen = true" />
            <UButton v-if="canManage" color="neutral" variant="outline" icon="i-lucide-file-spreadsheet" label="Importer" @click="openImport" />
            <UButton v-if="canManage" icon="i-lucide-plus" label="Article" @click="openItem(null)" />
          </template>
        </UDashboardNavbar>
        <UDashboardToolbar>
          <template #left>
            <UInput v-model="search" icon="i-lucide-search" placeholder="Rechercher un article…" class="w-full sm:w-64" />
            <USelectMenu
              v-model="selected"
              :items="[{ label: 'Tous les articles', value: null }, ...allCategories.map((c) => ({ label: c.name, value: c.id }))]"
              value-key="value"
              class="w-44 lg:hidden"
            />
          </template>
          <template #right>
            <p v-if="canReorder && items.length > 1" class="hidden text-xs text-muted md:block">
              <UIcon name="i-lucide-grip-vertical" class="align-middle" /> Glissez pour changer l'ordre sur le menu
            </p>
          </template>
        </UDashboardToolbar>
      </template>

      <template #body>
        <div v-if="itemsStatus === 'pending' && !items.length" class="space-y-2">
          <USkeleton v-for="n in 6" :key="n" class="h-20 w-full" />
        </div>

        <UEmpty
          v-else-if="!items.length"
          icon="i-lucide-cooking-pot"
          :title="search ? 'Aucun article trouvé' : categories.length ? 'Aucun article ici' : 'Votre menu est vide'"
          :description="
            search
              ? 'Essayez un autre mot-clé.'
              : categories.length
                ? 'Ajoutez votre premier plat dans cette catégorie.'
                : 'Commencez par créer une catégorie (Entrées, Plats, Boissons…).'
          "
          :actions="
            canManage && !search
              ? [
                  categories.length
                    ? { label: 'Ajouter un article', icon: 'i-lucide-plus', onClick: () => openItem(null) }
                    : { label: 'Créer une catégorie', icon: 'i-lucide-folder-plus', onClick: () => openCategory(null) },
                  { label: 'Importer depuis Excel / CSV', icon: 'i-lucide-file-spreadsheet', color: 'neutral', variant: 'outline', onClick: openImport },
                ]
              : undefined
          "
          class="py-16"
        />

        <VueDraggable
          v-else
          v-model="items"
          :disabled="!canReorder"
          handle=".drag-handle"
          :animation="150"
          ghost-class="opacity-40"
          tag="ul"
          class="divide-y divide-default overflow-hidden rounded-lg border border-default"
          @end="reorderItems"
        >
          <li
            v-for="item in items"
            :key="item.id"
            class="group flex items-center gap-3 bg-default px-3 py-3 transition hover:bg-elevated/40 sm:gap-4 sm:px-4"
          >
            <UIcon
              v-if="canReorder"
              name="i-lucide-grip-vertical"
              class="drag-handle size-4 shrink-0 cursor-grab text-dimmed"
            />
            <div class="size-14 shrink-0 overflow-hidden rounded-lg bg-elevated">
              <img v-if="item.images?.[0]" :src="item.images[0]" :alt="item.name" class="size-full object-cover" loading="lazy" >
              <UIcon v-else name="i-lucide-utensils" class="m-4 size-6 text-dimmed" />
            </div>

            <button type="button" class="min-w-0 flex-1 text-start" :disabled="!canManage" @click="openItem(item)">
              <p class="flex flex-wrap items-center gap-1.5 font-medium" :class="!item.isActive && 'text-dimmed'">
                <span class="truncate">{{ item.name }}</span>
                <UBadge v-if="!item.isActive" size="xs" color="neutral" variant="outline" label="Masqué" />
                <UTooltip v-for="t in item.dietaryTags ?? []" :key="t" :text="DIETARY_TAGS[t]?.label ?? t">
                  <UIcon :name="DIETARY_TAGS[t]?.icon ?? 'i-lucide-tag'" class="size-3.5 text-success" />
                </UTooltip>
              </p>
              <p class="truncate text-xs text-muted">
                <template v-if="!selected">{{ categoryName(item.categoryId) }} · </template>
                <template v-if="item.optionGroups.length">{{ item.optionGroups.length }} groupe(s) d'options · </template>
                <template v-if="item.prepTimeMinutes">{{ item.prepTimeMinutes }} min · </template>
                <template v-if="item.allergens?.length">
                  Allergènes : {{ item.allergens.map((a) => ALLERGENS[a] ?? a).join(', ') }}
                </template>
                <template v-else-if="item.description">{{ item.description }}</template>
              </p>
            </button>

            <div class="hidden w-44 shrink-0 sm:block">
              <MenuAvailabilityControl :item="item" @updated="replaceItem" />
            </div>

            <div class="w-24 text-right">
              <p class="tabular font-semibold text-highlighted">{{ money(item.priceAmount) }}</p>
              <p v-if="item.costAmount && canManage" class="tabular text-xs text-muted">
                marge {{ Math.round(((item.priceAmount - item.costAmount) / item.priceAmount) * 100) }} %
              </p>
            </div>

            <UDropdownMenu v-if="canManage" :items="itemMenu(item)" :content="{ align: 'end' }">
              <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" aria-label="Actions" />
            </UDropdownMenu>
          </li>
        </VueDraggable>

        <div v-if="itemsPage && itemsPage.meta.totalPages > 1" class="mt-4 flex justify-end">
          <UPagination v-model:page="page" :total="itemsPage.meta.total" :items-per-page="limit" />
        </div>
      </template>
    </UDashboardPanel>

    <MenuPreviewSlideover v-model:open="previewOpen" />
  </div>
</template>
