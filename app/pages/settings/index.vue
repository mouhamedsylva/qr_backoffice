<script setup lang="ts">
useHead({ title: 'Réglages · QR-Order' });

const route = useRoute();
const router = useRouter();
const restaurant = useRestaurantStore();

const tabs = computed(() =>
  [
    { label: 'Informations', value: 'general', icon: 'i-lucide-store', show: true },
    { label: 'Marque', value: 'brand', icon: 'i-lucide-palette', show: true },
    { label: 'Horaires', value: 'hours', icon: 'i-lucide-clock', show: true },
    { label: 'Région & taxes', value: 'regional', icon: 'i-lucide-globe', show: true },
    { label: 'Paiements', value: 'payments', icon: 'i-lucide-wallet', show: restaurant.can('billing.manage') || restaurant.can('payments.collect') },
  ].filter((t) => t.show),
);

const tab = computed({
  get: () => (tabs.value.some((t) => t.value === route.query.tab) ? String(route.query.tab) : 'general'),
  set: (value) => router.replace({ query: { tab: value === 'general' ? undefined : value } }),
});

const readOnly = computed(() => !restaurant.can('restaurant.update') && !restaurant.can('restaurant.settings'));
</script>

<template>
  <UDashboardPanel id="settings">
    <template #header>
      <UDashboardNavbar title="Réglages">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <UTabs v-model="tab" :items="tabs" :content="false" variant="link" size="sm" class="overflow-x-auto" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-4xl space-y-6">
        <UAlert
          v-if="readOnly"
          color="neutral"
          variant="subtle"
          icon="i-lucide-lock"
          title="Lecture seule"
          description="Seuls le propriétaire et les managers peuvent modifier ces réglages."
        />
        <div v-if="!restaurant.details" class="space-y-4">
          <USkeleton class="h-40 w-full" />
          <USkeleton class="h-40 w-full" />
        </div>
        <template v-else>
          <SettingsGeneralForm v-if="tab === 'general'" />
          <SettingsBrandForm v-else-if="tab === 'brand'" />
          <SettingsHoursForm v-else-if="tab === 'hours'" />
          <SettingsRegionalForm v-else-if="tab === 'regional'" />
          <SettingsPaymentsCard v-else-if="tab === 'payments'" />
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
