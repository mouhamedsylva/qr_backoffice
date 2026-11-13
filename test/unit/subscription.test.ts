import { describe, expect, it } from 'vitest';
import type { Plan, SubscriptionOverview } from '~/types/api';
import { subscriptionState, yearlySaving } from '~/utils/subscription';

const now = new Date('2026-11-10T12:00:00Z').getTime();
const inDays = (d: number) => new Date(now + d * 86_400_000).toISOString();
const plan = (code: string, name: string): Plan => ({
  id: code, code, name, priceMonthly: 35000, priceYearly: 350000, currency: 'XOF',
  maxRestaurants: 1, maxTables: 30, maxMembers: 10, features: [], isActive: true, position: 0,
});
const overview = (over: Partial<SubscriptionOverview> & { status?: string; trialEndsAt?: string | null }): SubscriptionOverview => {
  const { status = 'TRIALING', trialEndsAt = inDays(10), ...rest } = over;
  return {
    subscription: { id: 's', status: status as never, billingCycle: 'MONTHLY', trialEndsAt, currentPeriodEnd: null, plan: plan('PRO', 'Pro') },
    effectivePlan: plan('PRO', 'Pro'),
    isFallback: false,
    usage: { restaurants: 1, tables: 2, members: 1 },
    trial: { endsAt: trialEndsAt ?? '', daysLeft: 10, reminderDays: 3 },
    requestedPlan: null,
    ...rest,
  };
};

describe('état de l’abonnement', () => {
  it('essai en cours : jours restants, rappel selon le délai réglé', () => {
    expect(subscriptionState(overview({ trialEndsAt: inDays(10) }), now)).toMatchObject({ kind: 'trial', daysLeft: 10, remind: false });
    expect(subscriptionState(overview({ trialEndsAt: inDays(2.5) }), now)).toMatchObject({ kind: 'trial', daysLeft: 3, remind: true });
    const longReminder = overview({ trialEndsAt: inDays(6), trial: { endsAt: inDays(6), daysLeft: 6, reminderDays: 7 } });
    expect(subscriptionState(longReminder, now).remind).toBe(true);
  });

  it('essai terminé : Starter, rappel tant qu’aucun forfait n’est demandé', () => {
    const ended = overview({ trialEndsAt: inDays(-1), effectivePlan: plan('STARTER', 'Starter'), isFallback: true });
    expect(subscriptionState(ended, now)).toMatchObject({ kind: 'trialEnded', planName: 'Starter', remind: true });
    const requested = { ...ended, requestedPlan: { code: 'PRO', name: 'Pro', cycle: 'MONTHLY' as const, at: inDays(-1) } };
    expect(subscriptionState(requested, now)).toMatchObject({ kind: 'trialEnded', remind: false, requested: { code: 'PRO' } });
  });

  it('forfait actif, sans abonnement', () => {
    expect(subscriptionState(overview({ status: 'ACTIVE', trialEndsAt: null }), now).kind).toBe('active');
    expect(subscriptionState({ ...overview({}), subscription: null, isFallback: true, effectivePlan: plan('STARTER', 'Starter') }, now).kind).toBe('none');
  });

  it('calcule l’économie annuelle', () => {
    expect(yearlySaving(35000, 350000)).toBe(17);
    expect(yearlySaving(10000, 120000)).toBeNull();
  });
});
