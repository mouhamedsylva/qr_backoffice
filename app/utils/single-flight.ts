/**
 * Une seule exécution à la fois : les appels concurrents partagent la même
 * promesse ; un nouvel appel après la fin relance la fonction.
 * Sert au rafraîchissement du jeton (plusieurs 401 simultanés → un refresh).
 */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= fn().finally(() => {
      pending = null;
    });
    return pending;
  };
}
