<script setup lang="ts">
definePageMeta({ layout: 'auth', public: true });
useHead({ title: 'Mot de passe oublié · QR-Order' });

const config = useRuntimeConfig();
const toast = useToast();

const step = ref<'email' | 'reset'>('email');
const email = ref('');
const code = ref<string[]>([]);
const newPassword = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const api = $fetch.create({ baseURL: config.public.apiBase });

async function sendCode() {
  error.value = null;
  loading.value = true;
  try {
    await api('/auth/password/forgot', { method: 'POST', body: { email: email.value } });
    step.value = 'reset';
  } catch (err) {
    error.value = apiErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

async function reset() {
  error.value = null;
  loading.value = true;
  try {
    await api('/auth/password/reset', {
      method: 'POST',
      body: { email: email.value, code: code.value.join(''), newPassword: newPassword.value },
    });
    toast.add({ title: 'Mot de passe modifié', description: 'Vous pouvez vous connecter.', color: 'success' });
    await navigateTo('/login');
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
      <h1 class="font-display text-3xl font-semibold text-highlighted">Mot de passe oublié</h1>
      <p class="text-muted">
        {{
          step === 'email'
            ? 'Indiquez votre email : nous vous envoyons un code à 6 chiffres.'
            : `Saisissez le code reçu à ${email} et votre nouveau mot de passe.`
        }}
      </p>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />

    <form v-if="step === 'email'" class="space-y-5" @submit.prevent="sendCode">
      <UFormField label="Email" required>
        <UInput v-model="email" type="email" autocomplete="email" class="w-full" size="lg" />
      </UFormField>
      <UButton type="submit" block size="lg" :loading="loading" :disabled="!email">Recevoir un code</UButton>
    </form>

    <form v-else class="space-y-5" @submit.prevent="reset">
      <UFormField label="Code reçu par email" required>
        <UPinInput v-model="code" :length="6" otp size="lg" placeholder="○" />
      </UFormField>
      <UFormField label="Nouveau mot de passe" help="8 caractères minimum, avec une lettre et un chiffre." required>
        <UInput v-model="newPassword" type="password" autocomplete="new-password" class="w-full" size="lg" />
      </UFormField>
      <UButton type="submit" block size="lg" :loading="loading">Changer mon mot de passe</UButton>
      <UButton variant="link" color="neutral" block @click="step = 'email'">Renvoyer un code</UButton>
    </form>

    <p class="text-center text-sm">
      <ULink to="/login" class="text-muted hover:text-default">← Retour à la connexion</ULink>
    </p>
  </div>
</template>
