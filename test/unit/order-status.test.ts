import { describe, expect, it } from 'vitest';
import { canTransition, LIVE_COLUMNS, NEXT_ACTION, ORDER_STATUS, REASON_REQUIRED, TRANSITIONS, type OrderStatus } from '~/utils/order-status';

const ALL = Object.keys(ORDER_STATUS) as OrderStatus[];

describe('workflow des commandes', () => {
  it('suit le parcours nominal', () => {
    expect(canTransition('PENDING', 'ACCEPTED')).toBe(true);
    expect(canTransition('ACCEPTED', 'PREPARING')).toBe(true);
    expect(canTransition('PREPARING', 'READY')).toBe(true);
    expect(canTransition('READY', 'SERVED')).toBe(true);
    expect(canTransition('SERVED', 'COMPLETED')).toBe(true);
  });

  it('interdit les retours en arrière et les sauts', () => {
    expect(canTransition('READY', 'PREPARING')).toBe(false);
    expect(canTransition('PENDING', 'READY')).toBe(false);
    expect(canTransition('SERVED', 'CANCELLED')).toBe(false);
  });

  it('ne refuse qu\'une commande en attente', () => {
    expect(ALL.filter((s) => canTransition(s, 'REJECTED'))).toEqual(['PENDING']);
  });

  it('fige les statuts terminaux', () => {
    for (const s of ['COMPLETED', 'CANCELLED', 'REJECTED'] as OrderStatus[]) expect(TRANSITIONS[s]).toEqual([]);
  });

  it('propose toujours une action principale autorisée', () => {
    for (const [from, action] of Object.entries(NEXT_ACTION)) {
      expect(canTransition(from as OrderStatus, action!.to)).toBe(true);
    }
    for (const s of LIVE_COLUMNS) expect(NEXT_ACTION[s]).toBeDefined();
  });

  it('exige un motif pour annuler ou refuser', () => {
    expect([...REASON_REQUIRED].sort()).toEqual(['CANCELLED', 'REJECTED']);
  });
});
