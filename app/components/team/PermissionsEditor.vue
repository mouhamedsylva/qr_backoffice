<script setup lang="ts">
/** Grille de permissions : part des droits du rôle, chaque case peut être ajoutée ou retirée (AUT-03). */
import type { Role } from '~/types/api';
import { PERMISSION_GROUPS, ROLE_DEFAULTS } from '~/utils/permissions';

const props = defineProps<{ role: Role; disabled?: boolean }>();
const selected = defineModel<string[]>({ required: true });

const defaults = computed(() => new Set(ROLE_DEFAULTS[props.role]));

function toggle(permission: string, on: boolean | 'indeterminate') {
  selected.value = on === true
    ? [...new Set([...selected.value, permission])]
    : selected.value.filter((p) => p !== permission);
}

function tag(permission: string) {
  const on = selected.value.includes(permission);
  const byDefault = defaults.value.has(permission);
  if (on && !byDefault) return { label: 'ajoutée', color: 'success' as const };
  if (!on && byDefault) return { label: 'retirée', color: 'error' as const };
  return null;
}
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <fieldset v-for="group in PERMISSION_GROUPS" :key="group.label" class="space-y-2">
      <legend class="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{{ group.label }}</legend>
      <div v-for="[permission, label] in group.items" :key="permission" class="flex items-center gap-2">
        <UCheckbox
          :model-value="selected.includes(permission)"
          :label="label"
          :disabled="disabled"
          @update:model-value="toggle(permission, $event)"
        />
        <UBadge v-if="tag(permission)" size="xs" variant="subtle" :color="tag(permission)!.color" :label="tag(permission)!.label" />
      </div>
    </fieldset>
  </div>
</template>
