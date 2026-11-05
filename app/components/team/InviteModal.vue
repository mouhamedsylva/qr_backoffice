<script setup lang="ts">
/** Invitation d'un membre par email ou SMS (EQP-01). Le lien reste copiable si l'envoi échoue. */
import { useClipboard } from '@vueuse/core';
import type { Invitation, Role, StaffProfile } from '~/types/api';
import { ROLE_LABEL, STAFF_PROFILES } from '~/utils/permissions';

const emit = defineEmits<{ close: [sent: boolean] }>();

const api = useApi();
const restaurant = useRestaurantStore();
const { copy, copied } = useClipboard();

const channel = ref<'email' | 'phone'>('email');
const email = ref('');
const phone = ref('');
const role = ref<Role>('STAFF');
const staffProfile = ref<StaffProfile | null>(null);
const result = ref<Invitation | null>(null);
const sending = ref(false);

const emailOk = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()));
const phoneOk = computed(() => /^\+\d{8,15}$/.test(phone.value.trim()));
const valid = computed(() => (channel.value === 'email' ? emailOk.value : phoneOk.value));

const PROFILE_ITEMS = [
  { label: 'Aucun', value: null },
  ...Object.entries(STAFF_PROFILES).map(([value, p]) => ({ label: p.label, value, icon: p.icon })),
];

async function submit() {
  if (!valid.value) return;
  sending.value = true;
  try {
    result.value = await api<Invitation>(`${restaurant.base}/team/invitations`, {
      method: 'POST',
      body: {
        ...(channel.value === 'email' ? { email: email.value.trim() } : { phone: phone.value.trim() }),
        role: role.value,
        ...(staffProfile.value && { staffProfile: staffProfile.value }),
      },
    });
  } catch {
    // erreur déjà notifiée (ex. ALREADY_MEMBER)
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <UModal :title="result ? 'Invitation envoyée' : 'Inviter un membre'" @update:open="(o) => !o && emit('close', !!result)">
    <template #body>
      <div v-if="result" class="space-y-4">
        <p class="text-sm">
          <strong>{{ result.email ?? result.phone }}</strong> a reçu un lien pour rejoindre
          {{ restaurant.membership?.name }} en tant que {{ ROLE_LABEL[result.role].toLowerCase() }}. Le lien est valable 7 jours.
        </p>
        <div v-if="result.inviteUrl" class="space-y-1">
          <p class="text-xs text-muted">Vous pouvez aussi le partager vous-même (WhatsApp…) :</p>
          <div class="flex items-center gap-2 rounded-md bg-elevated px-3 py-2">
            <span class="min-w-0 flex-1 truncate font-mono text-xs">{{ result.inviteUrl }}</span>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              aria-label="Copier le lien"
              @click="copy(result.inviteUrl)"
            />
          </div>
        </div>
      </div>

      <form v-else id="invite-form" class="space-y-4" @submit.prevent="submit">
        <UTabs
          v-model="channel"
          :items="[
            { label: 'Par email', value: 'email', icon: 'i-lucide-mail' },
            { label: 'Par SMS', value: 'phone', icon: 'i-lucide-smartphone' },
          ]"
          :content="false"
          size="sm"
        />
        <UFormField v-if="channel === 'email'" label="Email" required :error="email && !emailOk ? 'Email invalide' : undefined">
          <UInput v-model="email" type="email" autofocus class="w-full" placeholder="prenom@exemple.com" />
        </UFormField>
        <UFormField v-else label="Téléphone" required :error="phone && !phoneOk ? 'Format international, ex. +221771234567' : undefined">
          <UInput v-model="phone" autofocus class="w-full" placeholder="+221771234567" />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Rôle">
            <USelect
              v-model="role"
              :items="[
                { label: ROLE_LABEL.STAFF, value: 'STAFF' },
                { label: ROLE_LABEL.MANAGER, value: 'MANAGER' },
              ]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Poste">
            <USelect v-model="staffProfile" :items="PROFILE_ITEMS" class="w-full" />
          </UFormField>
        </div>
        <p class="text-xs text-muted">Les permissions pourront être ajustées une fois l'invitation acceptée.</p>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <template v-if="result">
          <UButton label="Fermer" @click="emit('close', true)" />
        </template>
        <template v-else>
          <UButton color="neutral" variant="ghost" label="Annuler" @click="emit('close', false)" />
          <UButton type="submit" form="invite-form" icon="i-lucide-send" label="Envoyer l'invitation" :disabled="!valid" :loading="sending" />
        </template>
      </div>
    </template>
  </UModal>
</template>
