<script setup lang="ts">
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';

definePageMeta({ layout: 'auth', public: true });
useHead({ title: 'Connexion · QR-Order' });

const auth = useAuthStore();
const restaurant = useRestaurantStore();
const route = useRoute();

const schema = z.object({
  email: z.email('Adresse email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});
type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({ email: '', password: '' });
const showPassword = ref(false);
const error = ref<string | null>(null);
const loading = ref(false);

async function onSubmit(event: FormSubmitEvent<Schema>) {
  error.value = null;
  loading.value = true;
  try {
    await auth.login(event.data.email, event.data.password);
    restaurant.restore();
    await restaurant.load();
    await navigateTo((route.query.redirect as string) || '/');
  } catch (err) {
    error.value =
      apiErrorCode(err) === 'ACCOUNT_LOCKED'
        ? 'Compte temporairement verrouillé après plusieurs essais. Réessayez dans 15 minutes.'
        : apiErrorMessage(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-2">
      <h1 class="font-display text-3xl font-semibold text-highlighted">Bon retour parmi nous</h1>
      <p class="text-muted">Connectez-vous pour gérer votre établissement.</p>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />

    <UForm :schema="schema" :state="state" class="space-y-5" @submit="onSubmit">
      <UFormField label="Email" name="email" required>
        <UInput v-model="state.email" type="email" autocomplete="email" placeholder="vous@restaurant.sn" class="w-full" size="lg" />
      </UFormField>

      <UFormField label="Mot de passe" name="password" required>
        <template #hint>
          <ULink to="/forgot-password" class="text-sm text-primary">Mot de passe oublié ?</ULink>
        </template>
        <UInput
          v-model="state.password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          class="w-full"
          size="lg"
        >
          <template #trailing>
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
              @click="showPassword = !showPassword"
            />
          </template>
        </UInput>
      </UFormField>

      <UButton type="submit" block size="lg" :loading="loading">Se connecter</UButton>
    </UForm>

    <p class="text-center text-sm text-muted">
      Nouveau sur QR-Order ?
      <ULink to="/register" class="font-medium text-primary">Créer mon restaurant</ULink>
    </p>
  </div>
</template>
