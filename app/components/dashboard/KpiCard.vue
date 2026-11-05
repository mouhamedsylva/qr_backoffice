<script setup lang="ts">
const props = defineProps<{
  label: string;
  value: string;
  icon: string;
  /** Variation en % par rapport à la période précédente. */
  change?: number | null;
  hint?: string;
  loading?: boolean;
}>();

const changeLabel = computed(() => formatChange(props.change));
const changeColor = computed(() =>
  props.change === null || props.change === undefined || props.change === 0
    ? 'neutral'
    : props.change > 0
      ? 'success'
      : 'error',
);
</script>

<template>
  <UCard :ui="{ body: 'p-4 sm:p-5' }" class="relative overflow-hidden">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <p class="text-sm text-muted">{{ label }}</p>
        <USkeleton v-if="loading" class="h-8 w-28" />
        <p v-else class="tabular truncate text-2xl font-semibold text-highlighted">{{ value }}</p>
      </div>
      <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <UIcon :name="icon" class="size-5" />
      </span>
    </div>
    <div v-if="changeLabel || hint" class="mt-3 flex items-center gap-2 text-xs">
      <UBadge v-if="changeLabel" :color="changeColor" variant="subtle" size="sm" class="tabular">
        {{ changeLabel }}
      </UBadge>
      <span v-if="hint" class="text-muted">{{ hint }}</span>
    </div>
  </UCard>
</template>
