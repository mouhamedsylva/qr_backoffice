import { io, type Socket } from 'socket.io-client';
import type { RealtimeMessage } from '~/types/api';

export const REALTIME_EVENTS = [
  'order.created',
  'order.status_changed',
  'order.items_added',
  'order.payment_updated',
  'table.updated',
  'menu.item_updated',
  'kitchen.item_updated',
] as const;
export type RealtimeEventType = (typeof REALTIME_EVENTS)[number];

type Handler = (message: RealtimeMessage) => void;

// État partagé par toute l'application (une seule connexion).
const handlers = new Map<string, Set<Handler>>();
const connected = ref(false);
let socket: Socket | null = null;
let restaurantId: string | null = null;
let lastSeq = 0;

function dispatch(message: RealtimeMessage) {
  if (message.seq <= lastSeq) return; // déjà reçu (rattrapage + direct)
  lastSeq = message.seq;
  handlers.get(message.type)?.forEach((h) => h(message));
  handlers.get('*')?.forEach((h) => h(message));
}

/**
 * Temps réel (NOT-01, NOT-06) : connexion Socket.IO au namespace /realtime,
 * abonnement au restaurant actif, rattrapage des événements manqués à la
 * reconnexion, puis diffusion aux composants abonnés via `on()`.
 */
export function useRealtime() {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const nuxtApp = useNuxtApp();

  async function catchUp() {
    if (!restaurantId) return;
    const missed = await nuxtApp
      .$api<RealtimeMessage[]>(`/restaurants/${restaurantId}/events`, {
        query: { after: lastSeq, limit: 200 },
        silent: true,
      })
      .catch(() => []);
    missed.forEach(dispatch);
  }

  async function subscribe() {
    if (!socket || !restaurantId) return;
    const ack = (await socket.timeout(5000).emitWithAck('subscribe', { restaurantId }).catch(() => null)) as
      | { ok: boolean; lastSeq?: number }
      | null;
    if (!ack?.ok) return;
    if (lastSeq === 0) lastSeq = ack.lastSeq ?? 0;
    else await catchUp();
  }

  function connect(id: string) {
    if (socket && restaurantId === id) return;
    disconnect();
    restaurantId = id;
    lastSeq = 0;
    socket = io(`${config.public.socketUrl}/realtime`, {
      // Jeton relu à chaque (re)connexion : il change à chaque rafraîchissement.
      auth: (cb) => cb({ token: auth.accessToken }),
      transports: ['websocket'],
    });
    socket.on('connect', () => {
      connected.value = true;
      void subscribe();
    });
    socket.on('disconnect', () => (connected.value = false));
    socket.on('connect_error', async () => {
      connected.value = false;
      // Jeton expiré : on le rafraîchit, Socket.IO retente seul.
      await auth.refresh();
    });
    for (const type of REALTIME_EVENTS) {
      socket.on(type, (message: RealtimeMessage) => dispatch(message));
    }
  }

  function disconnect() {
    socket?.disconnect();
    socket = null;
    restaurantId = null;
    connected.value = false;
  }

  /** Abonnement d'un composant ; désabonnement automatique au démontage. */
  function on(type: RealtimeEventType | '*', handler: Handler) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type)!.add(handler);
    const off = () => handlers.get(type)?.delete(handler);
    if (getCurrentInstance()) onBeforeUnmount(off);
    return off;
  }

  return { connect, disconnect, on, connected: readonly(connected) };
}
