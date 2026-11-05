<script setup lang="ts">
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';

definePageMeta({ layout: 'auth', public: true });
useHead({ title: 'Créer mon restaurant · QR-Order' });

const auth = useAuthStore();
const restaurant = useRestaurantStore();

// Mêmes règles que l'API (RegisterDto).
const schema = z.object({
  restaurantName: z.string().min(2, '2 caractères minimum').max(150),
  city: z.string().max(100).optional(),
  firstName: z.string().min(1, 'Prénom requis').max(100),
  lastName: z.string().min(1, 'Nom requis').max(100),
  email: z.email('Adresse email invalide'),
  phone: z
    .string()
    .regex(/^\+\d{8,15}$/, 'Format international, ex. +221771234567')
    .optional()
    .or(z.literal('')),
  password: z
    .string()
    .regex(/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/, '8 caractères minimum, avec au moins une lettre et un chiffre'),
  acceptTerms: z.literal(true, 'Vous devez accepter les conditions générales'),
});
type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  restaurantName: '',
  city: 'Dakar',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  acceptTerms: undefined,
});
const error = ref<string | null>(null);
const loading = ref(false);

async function onSubmit(event: FormSubmitEvent<Schema>) {
  error.value = null;
  loading.value = true;
  try {
    const { phone, ...data } = event.data;
    await auth.register({ ...data, ...(phone ? { phone } : {}) });
    restaurant.restore();
    await restaurant.load();
    await navigateTo('/');
  } catch (err) {
    error.value = apiErrorMessage(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-2">
      <h1 class="font-display text-3xl font-semibold text-highlighted">Créez votre restaurant</h1>
      <p class="text-muted">14 jours d'essai du forfait Pro, sans engagement.</p>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />

    <UForm :schema="schema" :state="state" class="space-y-5" @submit="onSubmit">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Nom du restaurant" name="restaurantName" required class="sm:col-span-2">
          <UInput v-model="state.restaurantName" placeholder="Chez Awa" class="w-full" />
        </UFormField>
        <UFormField label="Prénom" name="firstName" required>
          <UInput v-model="state.firstName" autocomplete="given-name" class="w-full" />
        </UFormField>
        <UFormField label="Nom" name="lastName" required>
          <UInput v-model="state.lastName" autocomplete="family-name" class="w-full" />
        </UFormField>
        <UFormField label="Email" name="email" required class="sm:col-span-2">
          <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
        </UFormField>
        <UFormField label="Téléphone" name="phone" hint="Facultatif">
          <UInput v-model="state.phone" type="tel" placeholder="+221771234567" class="w-full" />
        </UFormField>
        <UFormField label="Ville" name="city">
          <UInput v-model="state.city" class="w-full" />
        </UFormField>
        <UFormField
          label="Mot de passe"
          name="password"
          required
          help="8 caractères minimum, avec une lettre et un chiffre."
          class="sm:col-span-2"
        >
          <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
      </div>

      <UFormField name="acceptTerms">
        <UCheckbox
          v-model="state.acceptTerms"
          label="J'accepte les conditions générales et la politique de confidentialité"
        />
      </UFormField>

      <UButton type="submit" block size="lg" :loading="loading">Créer mon restaurant</UButton>
    </UForm>

    <p class="text-center text-sm text-muted">
      Déjà inscrit ?
      <ULink to="/login" class="font-medium text-primary">Se connecter</ULink>
    </p>
  </div>
</template>
