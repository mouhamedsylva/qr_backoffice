import type { ApiClient } from '~/plugins/api';

/** Client de l'API (voir plugins/api.ts). */
export function useApi(): ApiClient {
  return useNuxtApp().$api;
}

/** Clé d'idempotence pour les créations (commandes, paiements) — CMD-16. */
export function idempotencyKey(): string {
  return `bo-${crypto.randomUUID()}`;
}
