<script setup lang="ts">
/** Acceptation d'une invitation à rejoindre une équipe (EQP-01). */
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';
import type { Role, TokenPair } from '~/types/api';
import { ROLE_LABEL } from '~/utils/permissions';

definePageMeta({ layout: 'auth', public: true, allowAuthenticated: true });
useHead({ title: 'Invitation · QR-Order' });

const route = useRoute();
const api = useApi();
const auth = useAuthStore();
const restaurant = useRestaurantStore();
const orders = useOrdersStore();
const token = computed(() => String(route.params.token));

interface Preview {
  restaurant: { name: string };
  role: Role;
  email: string | null;
  expiresAt: string;
  accountExists: boolean;
}

const { data: invitation, error } = useAsyncData('invitation', () =>
  api<Preview>(`/invitations/${token.value}`, { silent: true }),
);

async function enter(restaurantId: string) {
  orders.reset();
  await restaurant.select(restaurantId);
  await navigateTo('/', { replace: true });
}

// Déjà connecté : un clic suffit.
const joining = ref(false);
async function join() {
  joining.value = true;
  try {
    const res = await api<{ restaurantId: string }>(`/invitations/${token.value}/accept`, { method: 'POST' });
    await auth.fetchMe();
    await enter(res.restaurantId);
  } catch {
    joining.value = false;
  }
}

// Nouveau compte.
const schema = z.object({
  firstName: z.string().trim().min(1, 'Prénom obligatoire').max(100),
  lastName: z.string().trim().min(1, 'Nom obligatoire').max(100),
  email: z.union([z.literal(''), z.email('Email invalide')]),
  password: z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/, '8 caractères minimum, avec au moins une lettre et un chiffre'),
  acceptTerms: z.literal(true, { error: 'Vous devez accepter les conditions' }),
});
type Schema = z.output<typeof schema>;
const state = reactive<Partial<Schema>>({ firstName: '', lastName: '', email: '', password: '', acceptTerms: undefined });
const showPassword = ref(false);
const creating = ref(false);

async function register({ data }: FormSubmitEvent<Schema>) {
  if (!invitation.value?.email && !data.email) return;
  creating.value = true;
  try {
    const res = await api<{ restaurantId: string; tokens: TokenPair }>(`/invitations/${token.value}/register`, {
      method: 'POST',
      body: {
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        acceptTerms: true,
        ...(!invitation.value?.email && { email: data.email }),
      },
    });
    await auth.startSession(res.tokens);
    await enter(res.restaurantId);
  } catch {
    creating.value = false;
  }
}

const loginLink = computed(() => ({ path: '/login', query: { redirect: route.fullPath } }));
</script>

<template>
  <div class="space-y-6">
    <UEmpty
      v-if="error"
      icon="i-lucide-link-2-off"
      title="Invitation invalide"
      description="Ce lien a expiré, a déjà été utilisé ou a été annulé. Demandez une nouvelle invitation au responsable du restaurant."
      :actions="[{ label: 'Aller à la connexion', to: '/login', color: 'neutral', variant: 'outline' }]"
    />

    <div v-else-if="!invitation" class="space-y-3">
      <USkeleton class="h-8 w-3/4" />
      <USkeleton class="h-4 w-1/2" />
      <USkeleton class="h-40 w-full" />
    </div>

    <template v-else>
      <div>
        <UBadge color="primary" variant="subtle" icon="i-lucide-mail-open" label="Invitation" class="mb-3" />
        <h1 class="font-display text-3xl font-semibold text-highlighted">Rejoindre {{ invitation.restaurant.name }}</h1>
        <p class="mt-1 text-muted">
          Vous êtes invité(e) en tant que <strong>{{ ROLE_LABEL[invitation.role].toLowerCase() }}</strong>.
        </p>
      </div>

      <!-- Déjà connecté -->
      <div v-if="auth.isLoggedIn" class="space-y-3">
        <p class="text-sm">Connecté(e) en tant que <strong>{{ auth.user?.email }}</strong>.</p>
        <UButton block size="lg" icon="i-lucide-log-in" label="Rejoindre l'équipe" :loading="joining" @click="join" />
      </div>

      <!-- Compte existant -->
      <div v-else-if="invitation.accountExists" class="space-y-3">
        <p class="text-sm">Un compte existe déjà pour <strong>{{ invitation.email }}</strong> : connectez-vous pour accepter.</p>
        <UButton block size="lg" icon="i-lucide-log-in" label="Se connecter" :to="loginLink" />
      </div>

      <!-- Création de compte -->
      <UForm v-else :schema="schema" :state="state" class="space-y-4" @submit="register">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Prénom" name="firstName" required>
            <UInput v-model="state.firstName" autocomplete="given-name" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Nom" name="lastName" required>
            <UInput v-model="state.lastName" autocomplete="family-name" class="w-full" />
          </UFormField>
        </div>
        <UFormField v-if="invitation.email" label="Email">
          <UInput :model-value="invitation.email" disabled class="w-full" />
        </UFormField>
        <UFormField v-else label="Email" name="email" required>
          <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
        </UFormField>
        <UFormField label="Mot de passe" name="password" required>
          <UInput v-model="state.password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" class="w-full">
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="showPassword ? 'Masquer' : 'Afficher'"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>
        <UFormField name="acceptTerms">
          <UCheckbox v-model="state.acceptTerms" label="J'accepte les conditions d'utilisation et la politique de confidentialité" />
        </UFormField>
        <UButton type="submit" block size="lg" label="Créer mon compte et rejoindre" :loading="creating" />
        <p class="text-center text-sm text-muted">
          Déjà un compte ? <ULink :to="loginLink" class="font-medium text-primary">Se connecter</ULink>
        </p>
      </UForm>
    </template>
  </div>
</template>
