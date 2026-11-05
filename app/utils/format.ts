/**
 * Montants : l'API les stocke en plus petite unité de la devise
 * (XOF : 0 décimale, EUR : centimes). Le nombre de décimales vient d'Intl.
 */
export function fractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function formatMoney(amount: number, currency = 'XOF', locale = 'fr-SN'): string {
  const digits = fractionDigits(currency);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
      amount / 10 ** digits,
    );
  } catch {
    return `${amount} ${currency}`;
  }
}

/** Saisie en unités (ex. 12,50 €) → plus petite unité (1250). */
export function toMinorUnits(value: number, currency = 'XOF'): number {
  return Math.round(value * 10 ** fractionDigits(currency));
}

export function fromMinorUnits(value: number, currency = 'XOF'): number {
  return value / 10 ** fractionDigits(currency);
}

export function formatDateTime(
  date: string | Date,
  timeZone = 'Africa/Dakar',
  options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' },
): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, ...options }).format(new Date(date));
}

/** Ancienneté lisible : « à l'instant », « 7 min », « 1 h 05 ». */
export function formatAge(from: string | Date, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60_000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** Variation en % (déjà calculée par l'API) → libellé signé. */
export function formatChange(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return `${value > 0 ? '+' : ''}${value.toLocaleString('fr-FR')} %`;
}
