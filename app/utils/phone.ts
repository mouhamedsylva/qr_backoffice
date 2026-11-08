/**
 * Numéros de téléphone : l'indicatif du Sénégal (+221) est pré-rempli, le
 * restaurateur ne saisit que le numéro local. Un numéro étranger reste
 * possible en commençant la saisie par « + » ou « 00 ».
 * L'API attend le format international sans espaces (+221771234567).
 */

export const DEFAULT_DIAL_CODE = '+221';
/** Numéros sénégalais : 9 chiffres (77 123 45 67, 33 823 45 67…). */
const SN_LOCAL_LENGTH = 9;

/** Saisie libre → format international, ou '' si vide. */
export function toInternational(input: string, dialCode = DEFAULT_DIAL_CODE): string {
  const raw = input.trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  const code = dialCode.slice(1);
  // Numéro collé avec l'indicatif mais sans « + » (221771234567).
  if (digits.startsWith(code) && digits.length === code.length + SN_LOCAL_LENGTH) return `+${digits}`;
  return `${dialCode}${digits.replace(/^0+/, '')}`;
}

/** Format international → texte affiché dans le champ (sans l'indicatif par défaut). */
export function toLocalDisplay(value: string | null | undefined, dialCode = DEFAULT_DIAL_CODE): string {
  if (!value) return '';
  if (!value.startsWith(dialCode)) return value; // numéro étranger : affiché tel quel
  return formatSenegal(value.slice(dialCode.length));
}

/** « 771234567 » → « 77 123 45 67 ». */
export function formatSenegal(local: string): string {
  const d = local.replace(/\D/g, '').slice(0, SN_LOCAL_LENGTH);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
}

/** Valide un numéro international ; un numéro sénégalais doit compter 9 chiffres. */
export function isValidPhone(value: string, dialCode = DEFAULT_DIAL_CODE): boolean {
  if (!/^\+\d{8,15}$/.test(value)) return false;
  if (value.startsWith(dialCode)) return value.length === dialCode.length + SN_LOCAL_LENGTH;
  return true;
}

export const PHONE_ERROR = 'Numéro invalide : 9 chiffres, ex. 77 123 45 67';
