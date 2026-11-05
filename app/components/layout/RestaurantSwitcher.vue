<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

defineProps<{ collapsed?: boolean }>();

const restaurant = useRestaurantStore();
const orders = useOrdersStore();

const ROLE_LABEL = { OWNER: 'Propriétaire', MANAGER: 'Manager', STAFF: 'Équipe' } as const;

const items = computed<DropdownMenuItem[][]>(() => [
  restaurant.memberships.map((m) => ({
    label: m.name,
    avatar: m.logoUrl ? { src: m.logoUrl, alt: m.name } : { text: m.name.slice(0, 1) },
    description: ROLE_LABEL[m.role],
    type: 'checkbox' as const,
    checked: m.id === restaurant.id,
    onSelect: async () => {
      orders.reset();
      await restaurant.select(m.id);
      await orders.load(true);
    },
  })),
]);
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-60' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated py-2"
      :class="[!collapsed && 'justify-start']"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      :ui="{ trailingIcon: 'text-dimmed ms-auto' }"
    >
      <UAvatar
        :src="restaurant.membership?.logoUrl ?? undefined"
        :text="restaurant.membership?.name.slice(0, 1)"
        size="sm"
        class="bg-primary text-inverted font-display"
      />
      <span v-if="!collapsed" class="min-w-0 text-start">
        <span class="block truncate font-semibold text-highlighted">{{ restaurant.membership?.name }}</span>
        <span class="block truncate text-xs text-muted">
          {{ restaurant.membership ? ROLE_LABEL[restaurant.membership.role] : '' }}
        </span>
      </span>
    </UButton>
  </UDropdownMenu>
</template>
