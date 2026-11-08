import { describe, expect, it } from 'vitest';
import { formatSenegal, isValidPhone, toInternational, toLocalDisplay } from '~/utils/phone';

describe('téléphone', () => {
  it('ajoute l’indicatif +221 au numéro local', () => {
    expect(toInternational('78 456 98 56')).toBe('+221784569856');
    expect(toInternational('784569856')).toBe('+221784569856');
    expect(toInternational('')).toBe('');
  });

  it('accepte un numéro déjà international', () => {
    expect(toInternational('+221 78 456 98 56')).toBe('+221784569856');
    expect(toInternational('221784569856')).toBe('+221784569856');
    expect(toInternational('0033612345678')).toBe('+33612345678');
    expect(toInternational('+33 6 12 34 56 78')).toBe('+33612345678');
  });

  it('affiche le numéro local sans l’indicatif, groupé', () => {
    expect(toLocalDisplay('+221784569856')).toBe('78 456 98 56');
    expect(toLocalDisplay('+33612345678')).toBe('+33612345678');
    expect(toLocalDisplay(null)).toBe('');
    expect(formatSenegal('7845')).toBe('78 45');
  });

  it('exige 9 chiffres pour un numéro sénégalais', () => {
    expect(isValidPhone('+221784569856')).toBe(true);
    expect(isValidPhone('+22178456985')).toBe(false);
    expect(isValidPhone('+33612345678')).toBe(true);
    expect(isValidPhone('784569856')).toBe(false);
  });
});
