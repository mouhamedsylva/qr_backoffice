<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import { ConfirmModal, TeamInviteModal, TeamMemberModal } from '#components';
import type { Invitation, Member } from '~/types/api';
import { ROLE_COLOR, ROLE_LABEL, STAFF_PROFILES } from '~/utils/permissions';

useHead({ title: 'Équipe · QR-Order' });

const api = useApi();
const auth = useAuthStore();
const restaurant = useRestaurantStore();
const toast = useToast();
const overlay = useOverlay();
const { dateTime } = useMoney();

const canManage = computed(() => restaurant.can('team.manage'));
const inviteModal = overlay.create(TeamInviteModal);
const memberModal = overlay.create(TeamMemberModal);
const confirmModal = overlay.create(ConfirmModal);

const { data, status, refresh } = useAsyncData(
  'team',
  async () => {
    const [members, invitations] = await Promise.all([
      api<Member[]>(`${restaurant.base}/team/members`),
      api<Invitation[]>(`${restaurant.base}/team/invitations`),
    ]);
    return { members, invitations };
  },
  { default: () => ({ members: [] as Member[], invitations: [] as Invitation[] }), watch: [() => restaurant.id] },
);

const ROLE_ORDER = { OWNER: 0, MANAGER: 1, STAFF: 2 };
const members = computed(() => [...data.value.members].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]));
const counts = computed(() => ({
  managers: data.value.members.filter((m) => m.role === 'MANAGER').length,
  staff: data.value.members.filter((m) => m.role === 'STAFF').length,
}));

const isCustomized = (m: Member) => !!(m.permissionOverrides?.grant?.length || m.permissionOverrides?.deny?.length);
const initials = (m: Member) => `${m.user.firstName[0] ?? ''}${m.user.lastName[0] ?? ''}`.toUpperCase();

async function invite() {
  if (await inviteModal.open()) await refresh();
}

async function edit(m: Member) {
  if (await memberModal.open({ member: m })) await refresh();
}

async function remove(m: Member) {
  const ok = await confirmModal.open({
    title: `Retirer ${m.user.firstName} ${m.user.lastName} de l'équipe ?`,
    description: 'Son accès à ce restaurant est coupé immédiatement. Son compte et son historique sont conservés.',
    confirmLabel: 'Retirer',
  });
  if (!ok) return;
  try {
    await api(`${restaurant.base}/team/members/${m.id}`, { method: 'DELETE' });
    toast.add({ title: 'Membre retiré', color: 'success', icon: 'i-lucide-user-minus' });
    await refresh();
  } catch {
    // erreur déjà notifiée
  }
}

async function revoke(i: Invitation) {
  try {
    await api(`${restaurant.base}/team/invitations/${i.id}`, { method: 'DELETE' });
    toast.add({ title: 'Invitation annulée', color: 'success', icon: 'i-lucide-x' });
    await refresh();
  } catch {
    // erreur déjà notifiée
  }
}

function memberMenu(m: Member): DropdownMenuItem[][] {
  return [
    [{ label: 'Rôle et permissions', icon: 'i-lucide-shield', onSelect: () => edit(m) }],
    [{ label: 'Retirer de l\'équipe', icon: 'i-lucide-user-minus', color: 'error', onSelect: () => remove(m) }],
  ];
}
</script>

<template>
  <UDashboardPanel id="team">
    <template #header>
      <UDashboardNavbar title="Équipe">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton v-if="canManage" icon="i-lucide-user-plus" label="Inviter" @click="invite" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-5xl space-y-6">
        <div class="grid gap-4 sm:grid-cols-3">
          <DashboardKpiCard label="Membres" :value="String(data.members.length)" icon="i-lucide-users" :loading="status === 'pending' && !data.members.length" />
          <DashboardKpiCard label="Managers" :value="String(counts.managers)" icon="i-lucide-shield" :loading="status === 'pending' && !data.members.length" />
          <DashboardKpiCard label="Équipiers" :value="String(counts.staff)" icon="i-lucide-hand-platter" :loading="status === 'pending' && !data.members.length" />
        </div>

        <UPageCard title="Membres" variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0', header: 'p-4 sm:px-6 mb-0' }">
          <ul class="divide-y divide-default">
            <template v-if="status === 'pending' && !data.members.length">
              <li v-for="n in 3" :key="n" class="flex items-center gap-3 px-4 py-3 sm:px-6">
                <USkeleton class="size-10 rounded-full" /><USkeleton class="h-4 w-48" />
              </li>
            </template>
            <li v-for="m in members" :key="m.id" class="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
              <UAvatar :text="initials(m)" :alt="`${m.user.firstName} ${m.user.lastName}`" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium text-highlighted">
                  {{ m.user.firstName }} {{ m.user.lastName }}
                  <span v-if="m.user.id === auth.user?.id" class="text-xs font-normal text-muted">(vous)</span>
                </p>
                <p class="truncate text-sm text-muted">{{ m.user.email }}<template v-if="m.user.phone"> · {{ m.user.phone }}</template></p>
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                <UBadge
                  v-if="m.staffProfile"
                  color="neutral"
                  variant="outline"
                  :icon="STAFF_PROFILES[m.staffProfile].icon"
                  :label="STAFF_PROFILES[m.staffProfile].label"
                />
                <UBadge :color="ROLE_COLOR[m.role]" variant="subtle" :label="ROLE_LABEL[m.role]" />
                <UTooltip v-if="isCustomized(m)" :text="`${m.permissions.length} permissions effectives`">
                  <UBadge color="warning" variant="subtle" icon="i-lucide-sliders-horizontal" label="Personnalisé" />
                </UTooltip>
              </div>
              <UDropdownMenu
                v-if="canManage && m.role !== 'OWNER' && m.user.id !== auth.user?.id"
                :items="memberMenu(m)"
                :content="{ align: 'end' }"
              >
                <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" aria-label="Actions" />
              </UDropdownMenu>
              <span v-else class="w-8" />
            </li>
          </ul>
        </UPageCard>

        <UPageCard
          v-if="data.invitations.length"
          title="Invitations en attente"
          description="Liens valables 7 jours."
          variant="subtle"
          :ui="{ container: 'p-0 sm:p-0 gap-y-0', header: 'p-4 sm:px-6 mb-0' }"
        >
          <ul class="divide-y divide-default">
            <li v-for="i in data.invitations" :key="i.id" class="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
              <UAvatar icon="i-lucide-mail" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ i.email ?? i.phone }}</p>
                <p class="text-xs text-muted">Expire le {{ dateTime(i.expiresAt, { dateStyle: 'medium' }) }}</p>
              </div>
              <UBadge :color="ROLE_COLOR[i.role]" variant="subtle" :label="ROLE_LABEL[i.role]" />
              <UButton v-if="canManage" size="sm" color="neutral" variant="ghost" label="Annuler" @click="revoke(i)" />
            </li>
          </ul>
        </UPageCard>

        <UEmpty
          v-if="status !== 'pending' && data.members.length <= 1 && !data.invitations.length"
          icon="i-lucide-users"
          title="Travaillez en équipe"
          description="Invitez vos serveurs, cuisiniers et caissiers : chacun voit uniquement ce dont il a besoin."
          :actions="canManage ? [{ label: 'Inviter un membre', icon: 'i-lucide-user-plus', onClick: invite }] : undefined"
          variant="naked"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
