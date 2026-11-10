/**
 * Import du menu depuis un fichier CSV ou Excel : une ligne par plat.
 * Lecture et validation entièrement côté navigateur ; la création passe
 * ensuite par les routes habituelles du menu.
 */
import type { Category } from '~/types/api';
import { toMinorUnits } from '~/utils/format';
import { ALLERGENS, DIETARY_TAGS } from '~/utils/menu';

export type Cell = string | number | boolean | Date | null | undefined;

export const MAX_IMPORT_ROWS = 500;

/** Colonnes reconnues, avec les intitulés acceptés (casse, accents et séparateurs ignorés). */
export const COLUMNS = {
  category: { label: 'categorie', aliases: ['categorie', 'category', 'rubrique', 'section'], required: true },
  subcategory: { label: 'sous_categorie', aliases: ['souscategorie', 'subcategory', 'sousrubrique'], required: false },
  name: { label: 'nom', aliases: ['nom', 'name', 'plat', 'article', 'produit', 'intitule'], required: true },
  description: { label: 'description', aliases: ['description', 'desc', 'details'], required: false },
  price: { label: 'prix', aliases: ['prix', 'price', 'tarif', 'prixdevente'], required: true },
  available: { label: 'disponible', aliases: ['disponible', 'available', 'dispo', 'enstock'], required: false },
  prepTime: { label: 'temps_preparation', aliases: ['tempspreparation', 'preparation', 'tempsdepreparation', 'preptime', 'duree'], required: false },
  calories: { label: 'calories', aliases: ['calories', 'kcal'], required: false },
  allergens: { label: 'allergenes', aliases: ['allergenes', 'allergens', 'allergene'], required: false },
  dietary: { label: 'regimes', aliases: ['regimes', 'regime', 'tags', 'dietary', 'labels'], required: false },
  image: { label: 'image', aliases: ['image', 'photo', 'imageurl', 'urlimage', 'urlphoto', 'fichierimage', 'fichierphoto'], required: false },
} as const;
export type ColumnKey = keyof typeof COLUMNS;

/** « Sous-catégorie » → « souscategorie ». */
export function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Comparaison de noms : casse, accents et espaces multiples ignorés. */
export function sameName(a: string, b: string): boolean {
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return n(a) === n(b);
}

// ───────────────────────── Lecture CSV ─────────────────────────

/** Séparateur le plus probable de la 1re ligne : « ; » (Excel en français), « , » ou tabulation. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = [';', ',', '\t'].map((d) => ({ d, n: first.split(d).length - 1 }));
  return counts.sort((a, b) => b.n - a.n)[0]!.n > 0 ? counts[0]!.d : ';';
}

/** CSV RFC 4180 : guillemets, guillemets doublés, retours à la ligne dans une cellule. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"' && cell === '') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

// ───────────────────────── Valeurs ─────────────────────────

const text = (v: Cell) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v)).trim();

/** « 3 500 F », « 12,50 € », 3500 → montant en plus petite unité ; null si illisible. */
export function parsePrice(value: Cell, currency: string): number | null {
  if (typeof value === 'number') return value >= 0 ? toMinorUnits(value, currency) : null;
  const raw = text(value)
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/(fcfa|cfa|xof|eur|€|f)$/i, '')
    .replace(',', '.');
  if (!raw) return null;
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  return toMinorUnits(Number(raw), currency);
}

/** Entier positif facultatif (minutes, calories). undefined si vide, NaN si illisible. */
function parseCount(value: Cell): number | undefined {
  const raw = text(value).replace(/\s*(min|minutes|mn|kcal)$/i, '');
  if (!raw) return undefined;
  return /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
}

/** « oui », « non », « épuisé », vrai/faux, 1/0 ; vide = disponible. */
export function parseAvailable(value: Cell): boolean | null {
  if (typeof value === 'boolean') return value;
  const v = normalizeKey(text(value));
  if (!v) return true;
  if (['oui', 'o', 'yes', 'y', 'vrai', 'true', '1', 'disponible', 'dispo', 'x'].includes(v)) return true;
  if (['non', 'n', 'no', 'faux', 'false', '0', 'epuise', 'indisponible', 'rupture'].includes(v)) return false;
  return null;
}

/** Liste séparée par « , ; | / » → codes connus, et valeurs non reconnues. */
export function parseCodes(value: Cell, labels: Record<string, string>): { codes: string[]; unknown: string[] } {
  // Singulier ou pluriel indifférent : « Arachide » trouve « Arachides ».
  const singular = (k: string) => k.replace(/s$/, '');
  const byKey = new Map<string, string>();
  for (const [code, label] of Object.entries(labels)) {
    byKey.set(normalizeKey(code), code);
    byKey.set(normalizeKey(label), code);
    byKey.set(singular(normalizeKey(label)), code);
  }
  const codes = new Set<string>();
  const unknown: string[] = [];
  for (const part of text(value).split(/[,;|/]+/)) {
    const p = part.trim();
    if (!p) continue;
    const code = byKey.get(normalizeKey(p)) ?? byKey.get(singular(normalizeKey(p)));
    if (code) codes.add(code);
    else unknown.push(p);
  }
  return { codes: [...codes], unknown };
}

const DIETARY_LABELS = Object.fromEntries(Object.entries(DIETARY_TAGS).map(([k, v]) => [k, v.label]));

// ───────────────────────── Lignes ─────────────────────────

/** Photo d'un plat dans le fichier : lien (https, Google Drive, Dropbox) ou nom d'un fichier déposé avec le tableau. */
export type ImageRef = { kind: 'url'; url: string } | { kind: 'file'; name: string };

export interface ImportLine {
  /** Numéro de ligne dans le fichier (en-tête = 1). */
  row: number;
  category: string;
  subcategory: string;
  name: string;
  description: string;
  priceAmount: number;
  isAvailable: boolean;
  prepTimeMinutes?: number;
  calories?: number;
  allergens: string[];
  dietaryTags: string[];
  image: ImageRef | null;
  /** Bloquant : la ligne ne sera pas importée. */
  errors: string[];
  /** Non bloquant : la valeur concernée est ignorée. */
  warnings: string[];
}

export interface ParsedSheet {
  lines: ImportLine[];
  /** Colonnes obligatoires absentes de l'en-tête. */
  missingColumns: string[];
  /** Intitulés d'en-tête non reconnus (ignorés). */
  ignoredColumns: string[];
  truncated: boolean;
}

/** Associe chaque colonne reconnue à son index dans l'en-tête. */
export function mapHeader(header: Cell[]): { index: Partial<Record<ColumnKey, number>>; ignored: string[] } {
  const index: Partial<Record<ColumnKey, number>> = {};
  const ignored: string[] = [];
  header.forEach((cell, i) => {
    const key = normalizeKey(text(cell));
    if (!key) return;
    const match = (Object.keys(COLUMNS) as ColumnKey[]).find(
      (k) => index[k] === undefined && (COLUMNS[k].aliases as readonly string[]).includes(key),
    );
    if (match) index[match] = i;
    else ignored.push(text(cell));
  });
  return { index, ignored };
}

export function parseSheet(rows: Cell[][], currency: string): ParsedSheet {
  const [header = [], ...body] = rows;
  const { index, ignored } = mapHeader(header);
  const missingColumns = (Object.keys(COLUMNS) as ColumnKey[])
    .filter((k) => COLUMNS[k].required && index[k] === undefined)
    .map((k) => COLUMNS[k].label);
  if (missingColumns.length) return { lines: [], missingColumns, ignoredColumns: ignored, truncated: false };

  const get = (r: Cell[], k: ColumnKey) => (index[k] === undefined ? undefined : r[index[k]!]);
  const seen = new Set<string>();
  const lines: ImportLine[] = [];

  body.slice(0, MAX_IMPORT_ROWS).forEach((r, i) => {
    if (r.every((v) => text(v) === '')) return;
    const errors: string[] = [];
    const warnings: string[] = [];

    const category = text(get(r, 'category')).slice(0, 100);
    const subcategory = text(get(r, 'subcategory')).slice(0, 100);
    const name = text(get(r, 'name'));
    if (!category) errors.push('Catégorie manquante');
    if (!name) errors.push('Nom manquant');
    if (name.length > 150) errors.push('Nom trop long (150 caractères maximum)');

    const priceCell = get(r, 'price');
    const price = parsePrice(priceCell, currency);
    if (price === null) errors.push(text(priceCell) ? `Prix illisible : « ${text(priceCell)} »` : 'Prix manquant');

    let isAvailable = parseAvailable(get(r, 'available'));
    if (isAvailable === null) {
      warnings.push(`Disponibilité « ${text(get(r, 'available'))} » non reconnue : article disponible`);
      isAvailable = true;
    }

    let prepTimeMinutes = parseCount(get(r, 'prepTime'));
    if (Number.isNaN(prepTimeMinutes) || (prepTimeMinutes ?? 0) > 600) {
      warnings.push('Temps de préparation illisible, ignoré');
      prepTimeMinutes = undefined;
    }
    let calories = parseCount(get(r, 'calories'));
    if (Number.isNaN(calories)) {
      warnings.push('Calories illisibles, ignorées');
      calories = undefined;
    }

    const allergens = parseCodes(get(r, 'allergens'), ALLERGENS);
    if (allergens.unknown.length) warnings.push(`Allergène(s) non reconnu(s) : ${allergens.unknown.join(', ')}`);
    const dietary = parseCodes(get(r, 'dietary'), DIETARY_LABELS);
    if (dietary.unknown.length) warnings.push(`Régime(s) non reconnu(s) : ${dietary.unknown.join(', ')}`);

    const imageCell = text(get(r, 'image'));
    let image: ImageRef | null = null;
    if (/^https?:\/\/\S+$/i.test(imageCell)) image = { kind: 'url', url: imageCell };
    else if (/^(www\.|https?:)/i.test(imageCell)) warnings.push('Lien d’image invalide (https://… attendu), ignoré');
    else if (imageCell) image = { kind: 'file', name: imageCell.slice(0, 255) };

    // Même plat deux fois dans la même catégorie du fichier.
    const key = [category, subcategory, name].map(normalizeKey).join('|');
    if (name && category && seen.has(key)) errors.push('Doublon dans le fichier');
    seen.add(key);

    lines.push({
      row: i + 2,
      category,
      subcategory,
      name,
      description: text(get(r, 'description')).slice(0, 2000),
      priceAmount: price ?? 0,
      isAvailable,
      ...(prepTimeMinutes !== undefined && { prepTimeMinutes }),
      ...(calories !== undefined && { calories }),
      allergens: allergens.codes,
      dietaryTags: dietary.codes,
      image,
      errors,
      warnings,
    });
  });

  return { lines, missingColumns: [], ignoredColumns: ignored, truncated: body.length > MAX_IMPORT_ROWS };
}

// ───────────────────────── Photos déposées ─────────────────────────

/** « Thiéb Rouge.JPG » → « thieb rouge » : casse, accents et extension ignorés. */
export function fileKey(name: string): string {
  return name
    .split(/[\\/]/)
    .pop()!
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.(jpe?g|png|webp|avif|heic|heif|gif)$/i, '')
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

export interface FileMatch {
  /** Ligne du tableau → nom du fichier déposé correspondant. */
  byRow: Map<number, string>;
  /** Noms indiqués dans le tableau sans fichier correspondant. */
  missing: { row: number; name: string }[];
  /** Fichiers déposés qu'aucune ligne n'utilise. */
  unused: string[];
}

/** Associe la colonne image (noms de fichiers) aux photos déposées avec le tableau. */
export function matchImageFiles(lines: ImportLine[], fileNames: string[]): FileMatch {
  const byKey = new Map<string, string>();
  for (const f of fileNames) {
    const key = fileKey(f);
    if (!byKey.has(key)) byKey.set(key, f);
  }
  const used = new Set<string>();
  const byRow = new Map<number, string>();
  const missing: { row: number; name: string }[] = [];
  for (const line of lines) {
    if (line.image?.kind !== 'file') continue;
    const file = byKey.get(fileKey(line.image.name));
    if (file) {
      byRow.set(line.row, file);
      used.add(file);
    } else {
      missing.push({ row: line.row, name: line.image.name });
    }
  }
  return { byRow, missing, unused: fileNames.filter((f) => !used.has(f)) };
}

// ───────────────────────── Plan d'import ─────────────────────────

export interface CategoryToCreate {
  name: string;
  /** Nom de la catégorie parente, pour une sous-catégorie. */
  parent: string | null;
}

export interface ImportPlan {
  categories: CategoryToCreate[];
  items: ImportLine[];
  /** Plats déjà présents dans la même catégorie : ignorés, ou mis à jour sur demande. */
  existing: (ImportLine & { itemId: string })[];
  /** Plats déjà présents sans photo, pour lesquels le fichier en fournit une (ajout non destructif). */
  photosToAdd: (ImportLine & { itemId: string })[];
  invalid: ImportLine[];
}

/** Catégorie existante correspondant au nom (et au parent pour une sous-catégorie). */
export function findCategory(categories: Category[], name: string, parent: string | null): Category | undefined {
  if (!parent) return categories.find((c) => sameName(c.name, name));
  const p = categories.find((c) => sameName(c.name, parent));
  return p?.children?.find((c) => sameName(c.name, name));
}

/**
 * Ce que l'import va créer : catégories manquantes (parents d'abord) et plats.
 * `existingItems` : plats déjà au menu, par id de catégorie.
 */
export function buildPlan(
  lines: ImportLine[],
  categories: Category[],
  existingItems: Map<string, { id: string; name: string; hasImage?: boolean }[]>,
): ImportPlan {
  const plan: ImportPlan = { categories: [], items: [], existing: [], photosToAdd: [], invalid: [] };
  const planned = (name: string, parent: string | null) =>
    plan.categories.some((c) => sameName(c.name, name) && (c.parent === parent || (!!c.parent && !!parent && sameName(c.parent, parent))));

  for (const line of lines) {
    if (line.errors.length) {
      plan.invalid.push(line);
      continue;
    }
    if (!findCategory(categories, line.category, null) && !planned(line.category, null)) {
      plan.categories.push({ name: line.category, parent: null });
    }
    if (line.subcategory && !findCategory(categories, line.subcategory, line.category) && !planned(line.subcategory, line.category)) {
      plan.categories.push({ name: line.subcategory, parent: line.category });
    }
    const target = findCategory(categories, line.subcategory || line.category, line.subcategory ? line.category : null);
    const match = target ? (existingItems.get(target.id) ?? []).find((i) => sameName(i.name, line.name)) : undefined;
    if (match) {
      plan.existing.push({ ...line, itemId: match.id });
      if (line.image && !match.hasImage) plan.photosToAdd.push({ ...line, itemId: match.id });
    } else {
      plan.items.push(line);
    }
  }
  return plan;
}

// ───────────────────────── Modèle ─────────────────────────

/** Fichier modèle : séparateur « ; » et BOM pour une ouverture directe dans Excel (français). */
export function templateCsv(): string {
  const rows = [
    ['categorie', 'sous_categorie', 'nom', 'description', 'prix', 'disponible', 'temps_preparation', 'allergenes', 'regimes', 'calories', 'image'],
    ['Plats Principaux', '', 'Thiéboudienne', 'Riz au poisson et légumes', '3500', 'oui', '25', 'Poisson', 'Halal', '', ''],
    ['Plats Principaux', 'Grillades', 'Dibi agneau', 'Agneau grillé, oignons, moutarde', '5000', 'oui', '20', 'Moutarde', 'Halal, Épicé', '', ''],
    ['Boissons', '', 'Bissap', 'Jus d’hibiscus maison', '1000', 'oui', '', '', 'Végan', '120', ''],
    ['Desserts', '', 'Thiakry', 'Couscous de mil au lait caillé', '1500', 'non', '5', 'Lait', 'Végétarien', '', ''],
  ];
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return `\uFEFF${rows.map((r) => r.map(esc).join(';')).join('\r\n')}\r\n`;
}
