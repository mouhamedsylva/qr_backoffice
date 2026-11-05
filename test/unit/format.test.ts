import { describe, expect, it } from 'vitest';
import { formatAge, formatChange, formatMoney, fractionDigits, fromMinorUnits, toMinorUnits } from '~/utils/format';

// Intl insère des espaces insécables : on les normalise pour comparer.
const NBSP = new RegExp(`[${String.fromCharCode(0xa0, 0x202f)}]`, 'g');
const plain = (s: string) => s.replace(NBSP, ' ');

describe('montants', () => {
  it('connaît les décimales des devises', () => {
    expect(fractionDigits('XOF')).toBe(0);
    expect(fractionDigits('EUR')).toBe(2);
  });

  it('formate le franc CFA sans décimale', () => {
    expect(plain(formatMoney(2500, 'XOF', 'fr-SN'))).toBe('2 500 F CFA');
  });

  it('formate l\'euro depuis les centimes', () => {
    expect(plain(formatMoney(1250, 'EUR', 'fr-FR'))).toBe('12,50 €');
  });

  it('convertit aller-retour vers la plus petite unité', () => {
    expect(toMinorUnits(12.5, 'EUR')).toBe(1250);
    expect(toMinorUnits(0.1 + 0.2, 'EUR')).toBe(30);
    expect(toMinorUnits(2500, 'XOF')).toBe(2500);
    expect(fromMinorUnits(1250, 'EUR')).toBe(12.5);
  });
});

describe('formatAge', () => {
  const t0 = new Date('2026-01-01T12:00:00Z');
  it.each([
    [20_000, "à l'instant"],
    [7 * 60_000, '7 min'],
    [65 * 60_000, '1 h 05'],
    [-60_000, "à l'instant"],
  ])('après %i ms → %s', (elapsed, expected) => {
    expect(formatAge(t0, t0.getTime() + elapsed)).toBe(expected);
  });
});

describe('formatChange', () => {
  it('signe les variations', () => {
    expect(formatChange(12.5)).toBe('+12,5 %');
    expect(formatChange(-3)).toBe('-3 %');
    expect(formatChange(null)).toBeNull();
  });
});
