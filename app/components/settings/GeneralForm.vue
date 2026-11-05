<script setup lang="ts">
/** Profil public du restaurant : nom, description, coordonnées, réseaux (RES-01). */
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';

const { save, saving, details, canEdit } = useSettingsSave();

const phone = z.union([z.literal(''), z.string().regex(/^\+\d{8,15}$/, 'Format international, ex. +221771234567')]);
const url = z.union([z.literal(''), z.url('Adresse invalide (https://…)')]);
const schema = z.object({
  name: z.string().trim().min(2, 'Nom obligatoire').max(150),
  description: z.string().max(2000),
  address: z.string().max(255),
  city: z.string().max(100),
  country: z.string().length(2),
  phone,
  email: z.union([z.literal(''), z.email('Email invalide')]),
  website: url,
  facebook: url,
  instagram: url,
  tiktok: url,
  whatsapp: phone,
});
type Schema = z.output<typeof schema>;

const state = reactive<Schema>({
  name: '', description: '', address: '', city: '', country: 'SN', phone: '', email: '',
  website: '', facebook: '', instagram: '', tiktok: '', whatsapp: '',
});

watch(
  details,
  (d) => {
    if (!d) return;
    Object.assign(state, {
      name: d.name,
      description: d.description ?? '',
      address: d.address ?? '',
      city: d.city ?? '',
      country: d.country ?? 'SN',
      phone: d.phone ?? '',
      email: d.email ?? '',
      website: d.socialLinks?.website ?? '',
      facebook: d.socialLinks?.facebook ?? '',
      instagram: d.socialLinks?.instagram ?? '',
      tiktok: d.socialLinks?.tiktok ?? '',
      whatsapp: d.socialLinks?.whatsapp ?? '',
    });
  },
  { immediate: true },
);

const COUNTRIES = [
  ['SN', 'Sénégal'], ['CI', "Côte d'Ivoire"], ['ML', 'Mali'], ['BF', 'Burkina Faso'], ['GN', 'Guinée'],
  ['BJ', 'Bénin'], ['TG', 'Togo'], ['NE', 'Niger'], ['CM', 'Cameroun'], ['MR', 'Mauritanie'],
  ['GA', 'Gabon'], ['CG', 'Congo'], ['MA', 'Maroc'], ['FR', 'France'],
].map(([value, label]) => ({ value: value!, label: label! }));

// `null` efface le champ côté API (IsOptional laisse passer null).
const opt = (v: string) => v.trim() || null;

async function onSubmit({ data: d }: FormSubmitEvent<Schema>) {
  const socialLinks = Object.fromEntries(
    (['website', 'facebook', 'instagram', 'tiktok', 'whatsapp'] as const).filter((k) => d[k]).map((k) => [k, d[k]]),
  );
  await save('', {
    name: d.name.trim(),
    description: opt(d.description),
    address: opt(d.address),
    city: opt(d.city),
    country: d.country,
    phone: opt(d.phone),
    email: opt(d.email),
    socialLinks,
  });
}
// Constante : « :// » écrit en dur dans un attribut du template perturbe vue-tsc.
const URL_HINT = 'https://';
</script>

<template>
  <UForm :schema="schema" :state="state" :disabled="!canEdit" class="space-y-6" @submit="onSubmit">
    <UPageCard title="Profil" description="Affiché aux clients sur le menu et les reçus." variant="subtle">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Nom du restaurant" name="name" required class="sm:col-span-2">
          <UInput v-model="state.name" class="w-full" />
        </UFormField>
        <UFormField label="Description" name="description" class="sm:col-span-2" help="Quelques mots sur votre cuisine, visibles en tête du menu.">
          <UTextarea v-model="state.description" :rows="3" class="w-full" />
        </UFormField>
        <UFormField label="Adresse" name="address" class="sm:col-span-2">
          <UInput v-model="state.address" class="w-full" icon="i-lucide-map-pin" />
        </UFormField>
        <UFormField label="Ville" name="city">
          <UInput v-model="state.city" class="w-full" />
        </UFormField>
        <UFormField label="Pays" name="country">
          <USelectMenu v-model="state.country" :items="COUNTRIES" value-key="value" class="w-full" />
        </UFormField>
        <UFormField label="Téléphone" name="phone">
          <UInput v-model="state.phone" class="w-full" icon="i-lucide-phone" placeholder="+221771234567" />
        </UFormField>
        <UFormField label="Email" name="email">
          <UInput v-model="state.email" type="email" class="w-full" icon="i-lucide-mail" />
        </UFormField>
      </div>
    </UPageCard>

    <UPageCard title="Réseaux sociaux" description="Liens affichés en pied de menu." variant="subtle">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Site web" name="website">
          <UInput v-model="state.website" class="w-full" icon="i-lucide-globe" placeholder="https:/" />
        </UFormField>
        <UFormField label="WhatsApp" name="whatsapp">
          <UInput v-model="state.whatsapp" class="w-full" icon="i-lucide-message-circle" placeholder="+221771234567" />
        </UFormField>
        <UFormField label="Facebook" name="facebook">
          <UInput v-model="state.facebook" class="w-full" icon="i-lucide-facebook" :placeholder="`${URL_HINT}facebook.com/…`" />
        </UFormField>
        <UFormField label="Instagram" name="instagram">
          <UInput v-model="state.instagram" class="w-full" icon="i-lucide-instagram" :placeholder="`${URL_HINT}instagram.com/…`" />
        </UFormField>
        <UFormField label="TikTok" name="tiktok">
          <UInput v-model="state.tiktok" class="w-full" icon="i-lucide-music-2" :placeholder="`${URL_HINT}tiktok.com/@…`" />
        </UFormField>
      </div>
    </UPageCard>

    <div v-if="canEdit" class="flex justify-end">
      <UButton type="submit" label="Enregistrer" icon="i-lucide-save" :loading="saving" />
    </div>
  </UForm>
</template>
