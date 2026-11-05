<script setup lang="ts">
import { ORDER_STATUS, type OrderStatus } from '~/utils/order-status';

defineProps<{ status: OrderStatus; size?: 'xs' | 'sm' | 'md' }>();
</script>

<template>
  <UBadge
    :color="ORDER_STATUS[status].color"
    variant="subtle"
    :size="size ?? 'sm'"
    :icon="ORDER_STATUS[status].icon"
    :label="ORDER_STATUS[status].label"
  />
</template>
