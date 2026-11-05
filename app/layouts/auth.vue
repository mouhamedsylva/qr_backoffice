<template>
  <div class="min-h-dvh grid lg:grid-cols-2 bg-default">
    <!-- Panneau de marque -->
    <aside
      class="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white bg-[linear-gradient(135deg,var(--color-terracotta-600),var(--color-terracotta-800)_60%,var(--color-pierre-950))]"
    >
      <div
        class="absolute -right-24 -top-24 size-96 rounded-full bg-[var(--color-safran-500)]/20 blur-3xl"
        aria-hidden="true"
      />
      <div class="relative flex items-center gap-3">
        <img src="/favicon.svg" alt="" class="size-10" >
        <span class="font-display text-2xl font-semibold tracking-tight">QR-Order</span>
      </div>

      <div class="relative max-w-md space-y-6">
        <h2 class="font-display text-4xl leading-tight font-semibold">
          Vos commandes, en temps réel, de la table à la cuisine.
        </h2>
        <ul class="space-y-3 text-white/85">
          <li class="flex items-center gap-3">
            <UIcon name="i-lucide-qr-code" class="size-5 text-[var(--color-safran-300)]" />
            Vos clients commandent et paient depuis leur table
          </li>
          <li class="flex items-center gap-3">
            <UIcon name="i-lucide-bell-ring" class="size-5 text-[var(--color-safran-300)]" />
            Chaque nouvelle commande vous est signalée instantanément
          </li>
          <li class="flex items-center gap-3">
            <UIcon name="i-lucide-chart-line" class="size-5 text-[var(--color-safran-300)]" />
            Votre activité du jour en un coup d'œil
          </li>
        </ul>
      </div>

      <p class="relative text-sm text-white/60">© {{ new Date().getFullYear() }} QR-Order</p>
    </aside>

    <!-- Formulaire -->
    <main class="flex items-center justify-center p-6 sm:p-12">
      <div class="w-full max-w-md">
        <div class="mb-8 flex items-center gap-3 lg:hidden">
          <img src="/favicon.svg" alt="" class="size-9" >
          <span class="font-display text-xl font-semibold">QR-Order</span>
        </div>
        <slot />
      </div>
    </main>
  </div>
</template>
