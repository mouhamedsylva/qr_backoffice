<script setup lang="ts">
/** Rôle, poste et permissions d'un membre (EQP-02, AUT-03). */
import type { Member, Role, StaffProfile } from '~/types/api';
import { effectivePermissions, ROLE_DEFAULTS, ROLE_LABEL, STAFF_PROFILES, toOverrides } from '~/utils/permissions';

const props = defineProps<{ member: Member }>();
const emit = defineEmits<{ close: [saved: boolean] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const toast = useToast();

const role = ref<Role>(props.member.role === 'OWNER' ? 'MANAGER' : props.member.role);
const staffProfile = ref<StaffProfile | null>(props.member.staffProfile);
const selected = ref<string[]>(effectivePermissions(props.member.role, props.member.permissionOverrides));
const customize = ref(!!(props.member.permissionOverrides?.grant?.length || props.member.permissionOverrides?.deny?.length));

// Changer de rôle repart des droits par défaut du nouveau rôle.
watch(role, (r) => (selected.value = [...ROLE_DEFAULTS[r]]));
watch(customize, (on) => !on && (selected.value = [...ROLE_DEFAULTS[role.value]]));

const ROLE_ITEMS = [
  { label: ROLE_LABEL.MANAGER, value: 'MANAGER', description: 'Tout sauf l\'abonnement et la suppression du restaurant' },
  { label: ROLE_LABEL.STAFF, value: 'STAFF', description: 'Commandes, encaissement, tables et disponibilités' },
];
const PROFILE_ITEMS = [
  { label: 'Aucun', value: null },
  ...Object.entries(STAFF_PROFILES).map(([value, p]) => ({ label: p.label, value, icon: p.icon })),
];

const saving = ref(false);
async function submit() {
  saving.value = true;
  try {
    await api(`${restaurant.base}/team/members/${props.member.id}`, {
      method: 'PATCH',
      body: {
        role: role.value,
        staffProfile: staffProfile.value,
        permissions: customize.value ? toOverrides(role.value, selected.value) : { grant: [], deny: [] },
      },
    });
    toast.add({ title: 'Accès mis à jour', color: 'success', icon: 'i-lucide-check' });
    emit('close', true);
  } catch {
    // erreur déjà notifiée (ex. ROLE_HIERARCHY)
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal
    :title="`${member.user.firstName} ${member.user.lastName}`"
    :description="member.user.email"
    :ui="{ content: 'sm:max-w-2xl' }"
    @update:open="(o) => !o && emit('close', false)"
  >
    <template #body>
      <div class="space-y-5">
        <UFormField label="Rôle">
          <URadioGroup v-model="role" :items="ROLE_ITEMS" variant="card" orientation="horizontal" />
        </UFormField>
        <UFormField label="Poste" help="Oriente l'écran d'accueil (ex. Cuisine → écran cuisine).">
          <USelect v-model="staffProfile" :items="PROFILE_ITEMS" class="w-48" />
        </UFormField>
        <USwitch v-model="customize" label="Personnaliser les permissions" description="Ajouter ou retirer des droits par rapport au rôle." />
        <TeamPermissionsEditor v-if="customize" v-model="selected" :role="role" />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="emit('close', false)" />
        <UButton label="Enregistrer" :loading="saving" @click="submit" />
      </div>
    </template>
  </UModal>
</template>
