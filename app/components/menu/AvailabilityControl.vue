<script setup lang="ts">
/** Disponibilité d'un article : épuisé immédiat, stock, retour programmé (MEN-04). */
import type { MenuItem } from '~/types/api';

const props = defineProps<{ item: MenuItem }>();
const emit = defineEmits<{ updated: [item: MenuItem] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();
const { dateTime } = useMoney();
const canEdit = computed(() => restaurant.can('menu.availability'));

const saving = ref(false);
async function update(body: { isAvailable?: boolean; stockQuantity?: number | null; availableAgainAt?: string | null }) {
  saving.value = true;
  try {
    const updated = await api<MenuItem>(`${restaurant.base}/menu/items/${props.item.id}/availability`, {
      method: 'PATCH',
      body,
    });
    emit('updated', updated);
    toast.add({
      title: updated.available ? `« ${updated.name} » disponible` : `« ${updated.name} » épuisé`,
      color: updated.available ? 'success' : 'warning',
      icon: updated.available ? 'i-lucide-check' : 'i-lucide-package-x',
    });
  } catch {
    // erreur déjà notifiée
  } finally {
    saving.value = false;
  }
}

const stock = ref<number | null>(props.item.stockQuantity);
watch(() => props.item.stockQuantity, (v) => (stock.value = v));

/** Épuisé jusqu'à demain matin (heure locale du navigateur). */
function untilTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return update({ isAvailable: false, availableAgainAt: d.toISOString() });
}

const label = computed(() => {
  const i = props.item;
  if (!i.isAvailable) return i.availableAgainAt ? `Retour ${dateTime(i.availableAgainAt, { dateStyle: 'short', timeStyle: 'short' })}` : 'Épuisé';
  if (i.stockQuantity === 0) return 'Stock épuisé';
  if (i.stockQuantity !== null) return `${i.stockQuantity} en stock`;
  return 'Disponible';
});
</script>

<template>
  <div class="flex items-center gap-2">
    <USwitch
      :model-value="item.isAvailable"
      :disabled="!canEdit"
      :loading="saving"
      size="sm"
      :aria-label="item.isAvailable ? 'Marquer épuisé' : 'Remettre en vente'"
      @update:model-value="(v) => update(v ? { isAvailable: true, availableAgainAt: null } : { isAvailable: false })"
    />
    <UPopover v-if="canEdit" :content="{ align: 'start' }">
      <UButton
        size="xs"
        variant="link"
        :color="item.available ? 'neutral' : 'warning'"
        :label="label"
        trailing-icon="i-lucide-chevron-down"
        class="px-0"
      />
      <template #content>
        <div class="w-64 space-y-3 p-3">
          <UFormField label="Stock du jour" help="Vide = illimité. Passé à 0, l'article devient épuisé.">
            <div class="flex gap-2">
              <UInputNumber v-model="stock" :min="0" size="sm" class="flex-1" placeholder="Illimité" />
              <UButton size="sm" label="OK" :loading="saving" @click="update({ stockQuantity: stock })" />
            </div>
          </UFormField>
          <USeparator />
          <UButton
            block
            size="sm"
            color="warning"
            variant="soft"
            icon="i-lucide-alarm-clock"
            label="Épuisé jusqu'à demain 8 h"
            @click="untilTomorrow"
          />
          <UButton
            v-if="item.stockQuantity !== null"
            block
            size="sm"
            color="neutral"
            variant="ghost"
            label="Stock illimité"
            @click="update({ stockQuantity: null })"
          />
        </div>
      </template>
    </UPopover>
    <span v-else class="text-xs text-muted">{{ label }}</span>
  </div>
</template>
