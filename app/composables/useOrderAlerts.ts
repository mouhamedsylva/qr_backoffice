import { useLocalStorage } from '@vueuse/core';

/**
 * Alerte des nouvelles commandes (NOT-01) : carillon généré par Web Audio
 * (aucun fichier son), notification visuelle et compteur non lu.
 */
const unread = ref(0);

export function useOrderAlerts() {
  const soundEnabled = useLocalStorage('qro.sound', true);

  function chime() {
    if (!soundEnabled.value) return;
    try {
      const ctx = new AudioContext();
      const notes = [880, 1174.66]; // la5, ré6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.5);
      });
      setTimeout(() => void ctx.close(), 1200);
    } catch {
      // Navigateur sans Web Audio ou son bloqué avant interaction : ignoré.
    }
  }

  return {
    soundEnabled,
    unread,
    chime,
    markRead: () => (unread.value = 0),
  };
}
