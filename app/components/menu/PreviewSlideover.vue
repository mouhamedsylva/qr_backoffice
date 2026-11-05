<script setup lang="ts">
/** Aperçu du menu tel que le client le voit en scannant le QR (MEN-06). */
import { DIETARY_TAGS } from '~/utils/menu';

interface PublicItem {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  images: string[] | null;
  dietaryTags: string[] | null;
  available: boolean;
  optionGroups: { id: string }[];
}
interface PublicCategory {
  id: string;
  name: string;
  description: string | null;
  items: PublicItem[];
  children: PublicCategory[];
}

const open = defineModel<boolean>('open', { default: false });

const api = useApi();
const restaurant = useRestaurantStore();
const { money } = useMoney();

const menu = ref<{ currency: string; categories: PublicCategory[] } | null>(null);
const loading = ref(false);
const active = ref<string | null>(null);

watch(open, async (isOpen) => {
  if (!isOpen || !restaurant.membership) return;
  loading.value = true;
  try {
    menu.value = await api(`/public/restaurants/${restaurant.membership.slug}/menu`);
    active.value = menu.value?.categories[0]?.id ?? null;
  } finally {
    loading.value = false;
  }
});

const sections = computed(() =>
  (menu.value?.categories ?? []).flatMap((c) => [
    { id: c.id, name: c.name, items: c.items, sub: false },
    ...c.children.map((s) => ({ id: s.id, name: s.name, items: s.items, sub: true })),
  ]).filter((s) => s.items.length),
);
</script>

<template>
  <USlideover v-model:open="open" title="Aperçu du menu client" description="Ce que voient vos clients après avoir scanné le QR code.">
    <template #body>
      <div class="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border-8 border-neutral-900 bg-default shadow-xl">
        <div class="bg-primary px-5 pt-6 pb-4 text-inverted">
          <p class="font-display text-2xl font-semibold">{{ restaurant.details?.name ?? restaurant.membership?.name }}</p>
          <p v-if="restaurant.details?.description" class="mt-1 line-clamp-2 text-sm opacity-90">{{ restaurant.details.description }}</p>
        </div>

        <div v-if="loading" class="space-y-3 p-4">
          <USkeleton v-for="n in 4" :key="n" class="h-16 w-full" />
        </div>
        <UEmpty
          v-else-if="!sections.length"
          icon="i-lucide-book-open"
          title="Menu vide"
          description="Ajoutez des articles actifs dans des catégories visibles."
          variant="naked"
          class="py-12"
        />
        <template v-else>
          <div class="flex gap-2 overflow-x-auto border-b border-default px-4 py-2">
            <a
              v-for="c in menu!.categories.filter((x) => x.items.length || x.children.some((s) => s.items.length))"
              :key="c.id"
              :href="`#preview-${c.id}`"
              class="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition"
              :class="active === c.id ? 'bg-primary text-inverted' : 'bg-elevated text-default'"
              @click="active = c.id"
            >
              {{ c.name }}
            </a>
          </div>
          <div class="max-h-[60vh] space-y-5 overflow-y-auto p-4">
            <section v-for="s in sections" :id="`preview-${s.id}`" :key="s.id">
              <h3 :class="s.sub ? 'text-sm font-semibold text-muted' : 'font-display text-lg font-semibold text-highlighted'">
                {{ s.name }}
              </h3>
              <ul class="mt-2 space-y-3">
                <li v-for="item in s.items" :key="item.id" class="flex gap-3" :class="!item.available && 'opacity-50'">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium">
                      {{ item.name }}
                      <UIcon
                        v-for="t in item.dietaryTags ?? []"
                        :key="t"
                        :name="DIETARY_TAGS[t]?.icon ?? 'i-lucide-tag'"
                        class="ms-1 size-3.5 align-middle text-success"
                      />
                    </p>
                    <p v-if="item.description" class="line-clamp-2 text-xs text-muted">{{ item.description }}</p>
                    <p class="tabular mt-1 text-sm font-semibold text-primary">
                      {{ money(item.priceAmount, menu!.currency) }}
                      <span v-if="!item.available" class="ms-1 text-xs font-normal text-error">Épuisé</span>
                    </p>
                  </div>
                  <img v-if="item.images?.[0]" :src="item.images[0]" alt="" class="size-16 shrink-0 rounded-lg object-cover" >
                </li>
              </ul>
            </section>
          </div>
        </template>
      </div>
    </template>
  </USlideover>
</template>
