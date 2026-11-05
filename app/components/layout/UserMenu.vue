<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

defineProps<{ collapsed?: boolean }>();

const auth = useAuthStore();
const colorMode = useColorMode();
const { soundEnabled } = useOrderAlerts();
const realtime = useRealtime();

const fullName = computed(() =>
  auth.user ? `${auth.user.firstName} ${auth.user.lastName}` : '',
);

async function logout() {
  realtime.disconnect();
  await auth.logout();
  await navigateTo('/login');
}

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: fullName.value, description: auth.user?.email }],
  [
    {
      label: 'Thème',
      icon: colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun',
      children: [
        {
          label: 'Clair',
          icon: 'i-lucide-sun',
          type: 'checkbox',
          checked: colorMode.preference === 'light',
          onSelect: () => (colorMode.preference = 'light'),
        },
        {
          label: 'Sombre',
          icon: 'i-lucide-moon',
          type: 'checkbox',
          checked: colorMode.preference === 'dark',
          onSelect: () => (colorMode.preference = 'dark'),
        },
        {
          label: 'Système',
          icon: 'i-lucide-monitor',
          type: 'checkbox',
          checked: colorMode.preference === 'system',
          onSelect: () => (colorMode.preference = 'system'),
        },
      ],
    },
    {
      label: 'Son des nouvelles commandes',
      icon: soundEnabled.value ? 'i-lucide-volume-2' : 'i-lucide-volume-x',
      type: 'checkbox',
      checked: soundEnabled.value,
      onUpdateChecked: (v: boolean) => (soundEnabled.value = v),
      onSelect: (e: Event) => e.preventDefault(),
    },
  ],
  [{ label: 'Se déconnecter', icon: 'i-lucide-log-out', color: 'error', onSelect: logout }],
]);
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-56' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :class="[!collapsed && 'justify-start']"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      :ui="{ trailingIcon: 'text-dimmed ms-auto' }"
    >
      <UAvatar :text="auth.user?.firstName.slice(0, 1)" size="sm" />
      <span v-if="!collapsed" class="truncate">{{ fullName }}</span>
    </UButton>
  </UDropdownMenu>
</template>
