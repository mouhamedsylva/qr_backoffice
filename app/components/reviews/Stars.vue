<script setup lang="ts">
/** Note sur 5 en étoiles pleines / vides (lecture seule). */
const props = withDefaults(defineProps<{ rating: number; size?: string }>(), { size: 'size-4' });
const full = computed(() => Math.round(props.rating));
const STAR = 'M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z';
</script>

<template>
  <span class="inline-flex items-center gap-0.5" :aria-label="`${rating} sur 5`" role="img">
    <svg
      v-for="n in 5"
      :key="n"
      viewBox="0 0 24 24"
      :class="[size, n <= full ? 'text-safran-500' : 'text-dimmed']"
      aria-hidden="true"
    >
      <path :d="STAR" :fill="n <= full ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
    </svg>
  </span>
</template>
