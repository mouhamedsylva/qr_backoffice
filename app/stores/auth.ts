import { defineStore } from 'pinia';
import type { Me, TokenPair } from '~/types/api';

const REFRESH_KEY = 'qro.refreshToken';

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  restaurantName: string;
  city?: string;
  acceptTerms: boolean;
}

/**
 * Session : jeton d'accès en mémoire (15 min), refresh token en
 * localStorage. Limite connue : en production, préférer un cookie httpOnly
 * via un proxy serveur.
 */
export const useAuthStore = defineStore('auth', () => {
  const config = useRuntimeConfig();
  const accessToken = ref<string | null>(null);
  const user = ref<Me | null>(null);
  const initialized = ref(false);

  const isLoggedIn = computed(() => !!accessToken.value && !!user.value);

  // Appels sans intercepteur (évite toute boucle avec le rafraîchissement).
  const raw = $fetch.create({ baseURL: config.public.apiBase });

  function storeTokens(tokens: TokenPair) {
    accessToken.value = tokens.accessToken;
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  }

  function clear() {
    accessToken.value = null;
    user.value = null;
    localStorage.removeItem(REFRESH_KEY);
  }

  async function fetchMe() {
    user.value = await raw<Me>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken.value}` },
    });
  }

  async function login(email: string, password: string) {
    const res = await raw<{ tokens: TokenPair }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    storeTokens(res.tokens);
    await fetchMe();
  }

  /** Ouvre une session à partir de jetons déjà émis (ex. acceptation d'invitation). */
  async function startSession(tokens: TokenPair) {
    storeTokens(tokens);
    await fetchMe();
  }

  async function register(payload: RegisterPayload) {
    const res = await raw<{ tokens: TokenPair }>('/auth/register', {
      method: 'POST',
      body: payload,
    });
    storeTokens(res.tokens);
    await fetchMe();
  }

  /**
   * Rafraîchit le jeton d'accès. Un seul appel à la fois : les requêtes
   * qui échouent ensemble en 401 attendent le même rafraîchissement.
   */
  const refresh = singleFlight(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return false;
    try {
      storeTokens(await raw<TokenPair>('/auth/refresh', { method: 'POST', body: { refreshToken } }));
      return true;
    } catch {
      clear();
      return false;
    }
  });

  /** Restaure la session au chargement de l'application. */
  async function init() {
    if (initialized.value) return;
    initialized.value = true;
    if (await refresh()) {
      await fetchMe().catch(() => clear());
    }
  }

  async function logout() {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      await raw('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
    }
    clear();
  }

  return {
    accessToken,
    user,
    initialized,
    isLoggedIn,
    login,
    register,
    startSession,
    refresh,
    fetchMe,
    init,
    logout,
    clear,
  };
});
