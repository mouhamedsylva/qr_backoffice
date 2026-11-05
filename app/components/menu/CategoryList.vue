<script setup lang="ts">
/** Arborescence des catégories, réordonnable par glisser-déposer (MEN-01). */
import type { DropdownMenuItem } from '@nuxt/ui';
import { VueDraggable } from 'vue-draggable-plus';
import type { Category } from '~/types/api';

const props = defineProps<{ categories: Category[]; loading?: boolean }>();
const selected = defineModel<string | null>('selected', { default: null });
const emit = defineEmits<{ edit: [category: Category]; create: [parentId: string | null]; remove: [category: Category]; reorder: [ids: string[]] }>();

const restaurant = useRestaurantStore();
const canManage = computed(() => restaurant.can('menu.manage'));

// Copies locales manipulées par le glisser-déposer.
const roots = ref<Category[]>([]);
watch(
  () => props.categories,
  (cats) => (roots.value = cats.map((c) => ({ ...c, children: [...(c.children ?? [])] }))),
  { immediate: true },
);

const total = computed(() =>
  props.categories.reduce((s, c) => s + c.itemsCount + (c.children ?? []).reduce((a, x) => a + x.itemsCount, 0), 0),
);

function menuFor(category: Category): DropdownMenuItem[][] {
  return [
    [
      { label: 'Modifier', icon: 'i-lucide-pencil', onSelect: () => emit('edit', category) },
      ...(!category.parentId
        ? [{ label: 'Ajouter une sous-catégorie', icon: 'i-lucide-folder-plus', onSelect: () => emit('create', category.id) }]
        : []),
    ],
    [{ label: 'Supprimer', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => emit('remove', category) }],
  ];
}
</script>

<template>
  <nav class="space-y-1" aria-label="Catégories">
    <button
      type="button"
      class="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition"
      :class="selected === null ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-elevated'"
      @click="selected = null"
    >
      <span class="flex items-center gap-2"><UIcon name="i-lucide-layout-grid" class="size-4" /> Tous les articles</span>
      <span class="tabular text-xs text-muted">{{ total }}</span>
    </button>

    <template v-if="loading && !categories.length">
      <USkeleton v-for="n in 5" :key="n" class="h-9 w-full" />
    </template>

    <VueDraggable
      v-model="roots"
      :disabled="!canManage"
      handle=".drag-handle"
      :animation="150"
      ghost-class="opacity-40"
      @end="emit('reorder', roots.map((c) => c.id))"
    >
      <div v-for="cat in roots" :key="cat.id">
        <div
          class="group flex items-center gap-1 rounded-md pe-1 transition"
          :class="selected === cat.id ? 'bg-primary/10 text-primary' : 'hover:bg-elevated'"
        >
          <UIcon
            v-if="canManage"
            name="i-lucide-grip-vertical"
            class="drag-handle size-4 shrink-0 cursor-grab text-dimmed opacity-0 group-hover:opacity-100"
          />
          <button type="button" class="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 ps-1 text-sm" @click="selected = cat.id">
            <span class="truncate" :class="[selected === cat.id && 'font-medium', !cat.isActive && 'text-dimmed line-through']">
              {{ cat.name }}
            </span>
            <span class="tabular text-xs text-muted">{{ cat.itemsCount }}</span>
          </button>
          <UDropdownMenu v-if="canManage" :items="menuFor(cat)" :content="{ align: 'end' }">
            <UButton icon="i-lucide-ellipsis" size="xs" color="neutral" variant="ghost" class="opacity-0 group-hover:opacity-100" aria-label="Actions" />
          </UDropdownMenu>
        </div>

        <!-- Sous-catégories -->
        <VueDraggable
          v-if="cat.children?.length"
          v-model="cat.children"
          :disabled="!canManage"
          handle=".drag-handle"
          :animation="150"
          class="ms-5 border-s border-default ps-1"
          @end="emit('reorder', cat.children!.map((c) => c.id))"
        >
          <div
            v-for="child in cat.children"
            :key="child.id"
            class="group flex items-center gap-1 rounded-md pe-1 transition"
            :class="selected === child.id ? 'bg-primary/10 text-primary' : 'hover:bg-elevated'"
          >
            <UIcon
              v-if="canManage"
              name="i-lucide-grip-vertical"
              class="drag-handle size-4 shrink-0 cursor-grab text-dimmed opacity-0 group-hover:opacity-100"
            />
            <button type="button" class="flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5 ps-1 text-sm" @click="selected = child.id">
              <span class="truncate" :class="!child.isActive && 'text-dimmed line-through'">{{ child.name }}</span>
              <span class="tabular text-xs text-muted">{{ child.itemsCount }}</span>
            </button>
            <UDropdownMenu v-if="canManage" :items="menuFor(child)" :content="{ align: 'end' }">
              <UButton icon="i-lucide-ellipsis" size="xs" color="neutral" variant="ghost" class="opacity-0 group-hover:opacity-100" aria-label="Actions" />
            </UDropdownMenu>
          </div>
        </VueDraggable>
      </div>
    </VueDraggable>

    <UButton
      v-if="canManage"
      block
      color="neutral"
      variant="ghost"
      icon="i-lucide-plus"
      label="Nouvelle catégorie"
      class="mt-2 justify-start"
      @click="emit('create', null)"
    />
  </nav>
</template>
