/** Brouillons des formulaires du menu (montants en unité principale). */
import type { OptionGroup } from '~/types/api';
import { fromMinorUnits, toMinorUnits } from '~/utils/format';

export interface OptionDraft {
  key: number;
  name: string;
  /** Supplément en unité principale (ex. 500 pour 500 F CFA). */
  priceDelta: number;
  isAvailable: boolean;
}

export interface OptionGroupDraft {
  key: number;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: OptionDraft[];
}

let seq = 1;
export const draftKey = () => seq++;

export function toGroupDrafts(groups: OptionGroup[], currency: string): OptionGroupDraft[] {
  return groups.map((g) => ({
    key: draftKey(),
    name: g.name,
    isRequired: g.isRequired,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    options: g.options.map((o) => ({
      key: draftKey(),
      name: o.name,
      priceDelta: fromMinorUnits(o.priceDelta, currency),
      isAvailable: o.isAvailable,
    })),
  }));
}

export function fromGroupDrafts(groups: OptionGroupDraft[], currency: string) {
  return groups.map((g) => ({
    name: g.name.trim(),
    isRequired: g.isRequired,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    options: g.options
      .filter((o) => o.name.trim())
      .map((o) => ({ name: o.name.trim(), priceDelta: toMinorUnits(o.priceDelta, currency), isAvailable: o.isAvailable })),
  }));
}
