/** État de l'abonnement du propriétaire, pour la page Abonnement et le rappel d'essai. */
import type { SubscriptionOverview } from '~/types/api';

export type SubscriptionKind = 'trial' | 'trialEnded' | 'active' | 'pastDue' | 'suspended' | 'none';

export interface SubscriptionState {
  kind: SubscriptionKind;
  /** Forfait dont les fonctionnalités s'appliquent (Starter après l'essai). */
  planName: string;
  planCode: string;
  /** Pendant l'essai : jours restants et durée totale. */
  daysLeft: number | null;
  trialEndsAt: string | null;
  periodEnd: string | null;
  /** Forfait demandé en attente d'activation par QR-Order. */
  requested: { code: string; name: string; at: string | null } | null;
  /** Le rappel de fin d'essai doit s'afficher (délai réglé dans Vigie). */
  remind: boolean;
}

const DAY_MS = 86_400_000;

export function subscriptionState(o: SubscriptionOverview, now: number = Date.now()): SubscriptionState {
  const sub = o.subscription;
  const requested = o.requestedPlan ? { code: o.requestedPlan.code, name: o.requestedPlan.name, at: o.requestedPlan.at } : null;
  const base = {
    planName: o.effectivePlan.name,
    planCode: o.effectivePlan.code,
    daysLeft: null,
    trialEndsAt: sub?.trialEndsAt ?? null,
    periodEnd: sub?.currentPeriodEnd ?? null,
    requested,
    remind: false,
  };
  if (!sub) return { ...base, kind: 'none' };

  if (sub.status === 'TRIALING') {
    const end = sub.trialEndsAt ? new Date(sub.trialEndsAt).getTime() : 0;
    if (end > now) {
      const daysLeft = Math.max(1, Math.ceil((end - now) / DAY_MS));
      const reminderDays = o.trial?.reminderDays ?? 3;
      return { ...base, kind: 'trial', daysLeft, remind: reminderDays > 0 && daysLeft <= reminderDays };
    }
    return { ...base, kind: 'trialEnded', remind: !requested };
  }
  if (sub.status === 'ACTIVE' && !o.isFallback) return { ...base, kind: 'active' };
  if (sub.status === 'PAST_DUE') return { ...base, kind: 'pastDue', remind: true };
  if (sub.status === 'SUSPENDED') return { ...base, kind: 'suspended', remind: true };
  return { ...base, kind: o.isFallback ? 'trialEnded' : 'active', remind: o.isFallback && !requested };
}

/** Économie annuelle par rapport à 12 mensualités, en %. null si aucune. */
export function yearlySaving(priceMonthly: number, priceYearly: number): number | null {
  const full = priceMonthly * 12;
  if (!full || priceYearly >= full) return null;
  return Math.round(((full - priceYearly) / full) * 100);
}
