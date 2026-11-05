<script setup lang="ts">
/** Postes de cuisine (grill, froid, bar…) : chaque catégorie ou plat peut y être rattaché. */
import type { Station } from '~/types/api';

const props = defineProps<{ stations: Station[] }>();
const emit = defineEmits<{ close: [changed: boolean] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];

const list = ref<Station[]>(props.stations.map((s) => ({ ...s })));
const name = ref('');
const color = ref(COLORS[list.value.length % COLORS.length]!);
const changed = ref(false);
const busy = ref(false);

async function add() {
  if (!name.value.trim()) return;
  busy.value = true;
  try {
    const station = await api<Station>(`${restaurant.base}/kitchen/stations`, {
      method: 'POST',
      body: { name: name.value.trim(), color: color.value, position: list.value.length },
    });
    list.value.push(station);
    name.value = '';
    color.value = COLORS[list.value.length % COLORS.length]!;
    changed.value = true;
  } catch {
    // erreur déjà notifiée
  } finally {
    busy.value = false;
  }
}

async function update(station: Station, body: Partial<Station>) {
  try {
    Object.assign(station, await api<Station>(`${restaurant.base}/kitchen/stations/${station.id}`, { method: 'PATCH', body }));
    changed.value = true;
  } catch {
    // erreur déjà notifiée
  }
}

async function remove(station: Station) {
  try {
    await api(`${restaurant.base}/kitchen/stations/${station.id}`, { method: 'DELETE' });
    list.value = list.value.filter((s) => s.id !== station.id);
    changed.value = true;
  } catch {
    // erreur déjà notifiée
  }
}
</script>

<template>
  <UModal
    title="Postes de cuisine"
    description="Rattachez ensuite vos catégories ou plats à un poste (Menu) : chaque écran n'affiche que ses plats."
    @update:open="(o) => !o && emit('close', changed)"
  >
    <template #body>
      <div class="space-y-4">
        <ul v-if="list.length" class="divide-y divide-default rounded-lg border border-default">
          <li v-for="s in list" :key="s.id" class="flex items-center gap-3 px-3 py-2">
            <UPopover>
              <button type="button" class="size-6 rounded-full" :style="{ backgroundColor: s.color ?? '#a8a29e' }" :aria-label="`Couleur de ${s.name}`" />
              <template #content>
                <div class="flex gap-1.5 p-2">
                  <button
                    v-for="c in COLORS"
                    :key="c"
                    type="button"
                    class="size-6 rounded-full"
                    :style="{ backgroundColor: c }"
                    :aria-label="c"
                    @click="update(s, { color: c })"
                  />
                </div>
              </template>
            </UPopover>
            <UInput
              :model-value="s.name"
              variant="ghost"
              class="flex-1"
              @change="(e: Event) => update(s, { name: (e.target as HTMLInputElement).value })"
            />
            <USwitch :model-value="s.isActive" size="sm" aria-label="Actif" @update:model-value="update(s, { isActive: $event })" />
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" aria-label="Supprimer" @click="remove(s)" />
          </li>
        </ul>
        <form class="flex items-center gap-2" @submit.prevent="add">
          <span class="size-6 shrink-0 rounded-full" :style="{ backgroundColor: color }" />
          <UInput v-model="name" class="flex-1" placeholder="Ex. Grill, Froid, Bar, Pâtisserie" autofocus />
          <UButton type="submit" icon="i-lucide-plus" label="Ajouter" :disabled="!name.trim()" :loading="busy" />
        </form>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton label="Terminé" @click="emit('close', changed)" />
      </div>
    </template>
  </UModal>
</template>
