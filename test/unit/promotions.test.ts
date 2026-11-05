import { describe, expect, it } from 'vitest';
import type { Promotion } from '~/types/api';
import { benefitLabel, promotionState, randomCode } from '~/utils/promotions';

const plain = (s: string) => s.replace(new RegExp(`[${String.fromCharCode(0xa0, 0x202f)}]`, 'g'), ' ');
const promo = (over: Partial<Promotion> = {}): Promotion => ({
  id: '1', code: 'TEST', name: 'Test', description: null, type: 'PERCENT', value: 1000, buyQuantity: null,
  freeQuantity: null, menuItemId: null, minSubtotal: null, maxDiscount: null, startsAt: null, endsAt: null,
  usageLimit: null, perCustomerLimit: null, usageCount: 0, isActive: true, createdAt: '2026-01-01', ...over,
});

describe('benefitLabel', () => {
  it('décrit chaque type d\'avantage', () => {
    expect(benefitLabel(promo(), 'XOF')).toBe('−10 %');
    expect(benefitLabel(promo({ value: 1250 }), 'XOF')).toBe('−12,5 %');
    expect(plain(benefitLabel(promo({ type: 'AMOUNT', value: 1000 }), 'XOF', 'fr-SN'))).toBe('−1 000 F CFA');
    expect(benefitLabel(promo({ type: 'BUY_X_GET_Y', buyQuantity: 2, freeQuantity: 1 }), 'XOF', undefined, 'Bissap')).toBe('2 achetés = 1 offert · Bissap');
    expect(benefitLabel(promo({ type: 'FREE_ITEM' }), 'XOF', undefined, 'Thiakry')).toBe('Thiakry offert');
  });
});

describe('promotionState', () => {
  const now = new Date('2026-06-15T12:00:00Z').getTime();
  it.each([
    [{}, 'active'],
    [{ isActive: false }, 'paused'],
    [{ endsAt: '2026-06-01T00:00:00Z' }, 'expired'],
    [{ startsAt: '2026-07-01T00:00:00Z' }, 'scheduled'],
    [{ usageLimit: 5, usageCount: 5 }, 'exhausted'],
    [{ usageLimit: 5, usageCount: 4 }, 'active'],
  ] as [Partial<Promotion>, string][])('%o → %s', (over, expected) => {
    expect(promotionState(promo(over), now)).toBe(expected);
  });
});

describe('randomCode', () => {
  it('produit un code valide pour l\'API, sans caractères ambigus', () => {
    for (let i = 0; i < 50; i++) {
      const code = randomCode();
      expect(code).toMatch(/^[A-Z0-9_-]{3,40}$/);
      expect(code.slice(5)).not.toMatch(/[01IO]/);
    }
  });
});
