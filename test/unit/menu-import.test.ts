import { describe, expect, it } from 'vitest';
import type { Category } from '~/types/api';
import {
  buildPlan,
  fileKey,
  matchImageFiles,
  parseAvailable,
  parseCodes,
  parseCsv,
  parsePrice,
  parseSheet,
  templateCsv,
} from '~/utils/menu-import';
import { ALLERGENS } from '~/utils/menu';

describe('lecture CSV', () => {
  it('détecte le « ; » d’Excel et gère guillemets et BOM', () => {
    const rows = parseCsv('﻿nom;description;prix\r\nYassa;"Poulet; oignons ""maison""";3 000\r\n\r\n');
    expect(rows).toEqual([
      ['nom', 'description', 'prix'],
      ['Yassa', 'Poulet; oignons "maison"', '3 000'],
    ]);
  });

  it('accepte la virgule et les retours à la ligne dans une cellule', () => {
    expect(parseCsv('a,b\n"ligne 1\nligne 2",x')).toEqual([['a', 'b'], ['ligne 1\nligne 2', 'x']]);
  });
});

describe('valeurs', () => {
  it('lit les prix en francs CFA et en euros', () => {
    expect(parsePrice('3 500', 'XOF')).toBe(3500);
    expect(parsePrice('3500 FCFA', 'XOF')).toBe(3500);
    expect(parsePrice(2500, 'XOF')).toBe(2500);
    expect(parsePrice('12,50 €', 'EUR')).toBe(1250);
    expect(parsePrice('gratuit', 'XOF')).toBeNull();
    expect(parsePrice('', 'XOF')).toBeNull();
  });

  it('lit la disponibilité', () => {
    expect(parseAvailable('')).toBe(true);
    expect(parseAvailable('Oui')).toBe(true);
    expect(parseAvailable('épuisé')).toBe(false);
    expect(parseAvailable(false)).toBe(false);
    expect(parseAvailable('peut-être')).toBeNull();
  });

  it('reconnaît les allergènes par libellé ou code, au pluriel', () => {
    expect(parseCodes('Lait, gluten ; Arachide | Fromage', ALLERGENS)).toEqual({
      codes: ['MILK', 'GLUTEN', 'PEANUTS'],
      unknown: ['Fromage'],
    });
  });
});

describe('feuille', () => {
  it('reconnaît les en-têtes avec accents et variantes', () => {
    const sheet = parseSheet(
      [
        ['Catégorie', 'Sous-catégorie', 'Nom du plat', 'Prix', 'Couleur'],
        ['Plats', 'Grillades', 'Dibi', '5000', 'rouge'],
      ],
      'XOF',
    );
    // « Nom du plat » n'est pas un intitulé connu : colonne obligatoire manquante.
    expect(sheet.missingColumns).toEqual(['nom']);
  });

  it('valide chaque ligne', () => {
    const sheet = parseSheet(
      [
        ['categorie', 'sous_categorie', 'nom', 'prix', 'disponible', 'allergenes', 'temps_preparation', 'image', 'couleur'],
        ['Plats', '', 'Thiéb', '3 500', 'oui', 'Poisson', '25 min', '', 'x'],
        ['Plats', 'Grillades', 'Dibi', '5000', 'non', '', '', 'www.exemple.com/dibi.jpg', ''],
        ['', '', 'Sans catégorie', '1000', '', '', '', '', ''],
        ['Boissons', '', 'Bissap', 'cher', '', 'Fromage', '', '', ''],
        ['Plats', '', 'thieb', '3500', '', '', '', '', ''],
      ],
      'XOF',
    );
    expect(sheet.ignoredColumns).toEqual(['couleur']);
    const [thieb, dibi, noCat, bissap, dup] = sheet.lines;
    expect(thieb).toMatchObject({ row: 2, priceAmount: 3500, isAvailable: true, allergens: ['FISH'], prepTimeMinutes: 25, errors: [] });
    expect(dibi).toMatchObject({ subcategory: 'Grillades', isAvailable: false, image: null });
    expect(dibi!.warnings[0]).toMatch(/image/);
    expect(noCat!.errors).toEqual(['Catégorie manquante']);
    expect(bissap!.errors).toEqual(['Prix illisible : « cher »']);
    expect(bissap!.warnings[0]).toMatch(/Fromage/);
    expect(dup!.errors).toEqual(['Doublon dans le fichier']);
  });

  it('le modèle téléchargeable est lu sans erreur', () => {
    const sheet = parseSheet(parseCsv(templateCsv()), 'XOF');
    expect(sheet.missingColumns).toEqual([]);
    expect(sheet.lines.every((l) => !l.errors.length && !l.warnings.length)).toBe(true);
    expect(sheet.lines.map((l) => l.name)).toEqual(['Thiéboudienne', 'Dibi agneau', 'Bissap', 'Thiakry']);
  });
});

describe('plan d’import', () => {
  const existing: Category[] = [
    {
      id: 'c-plats', parentId: null, name: 'Plats Principaux', description: null, isActive: true, position: 0, itemsCount: 1,
      children: [{ id: 'c-grill', parentId: 'c-plats', name: 'Grillades', description: null, isActive: true, position: 0, itemsCount: 0 }],
    },
  ];

  it('crée seulement les catégories manquantes et repère les plats déjà au menu', () => {
    const { lines } = parseSheet(parseCsv(templateCsv()), 'XOF');
    const plan = buildPlan(lines, existing, new Map([['c-plats', [{ id: 'i-1', name: 'THIEBOUDIENNE' }]]]));
    expect(plan.categories).toEqual([
      { name: 'Boissons', parent: null },
      { name: 'Desserts', parent: null },
    ]);
    expect(plan.existing.map((l) => [l.name, l.itemId])).toEqual([['Thiéboudienne', 'i-1']]);
    expect(plan.items.map((l) => l.name)).toEqual(['Dibi agneau', 'Bissap', 'Thiakry']);
  });

  it('crée une sous-catégorie sous une nouvelle catégorie, parent d’abord', () => {
    const { lines } = parseSheet([['categorie', 'sous_categorie', 'nom', 'prix'], ['Boissons', 'Jus', 'Bissap', '1000']], 'XOF');
    expect(buildPlan(lines, existing, new Map()).categories).toEqual([
      { name: 'Boissons', parent: null },
      { name: 'Jus', parent: 'Boissons' },
    ]);
  });
});

describe('photos', () => {
  const sheet = parseSheet(
    [
      ['categorie', 'nom', 'prix', 'image'],
      ['Plats', 'Yassa', '3000', 'https://exemple.com/yassa.jpg'],
      ['Plats', 'Thiéb', '3500', 'Thiéb Rouge.JPG'],
      ['Plats', 'Mafé', '3500', 'mafe'],
      ['Plats', 'Dibi', '5000', 'dibi.png'],
      ['Plats', 'Bissap', '1000', ''],
    ],
    'XOF',
  );

  it('distingue lien et nom de fichier', () => {
    expect(sheet.lines.map((l) => l.image)).toEqual([
      { kind: 'url', url: 'https://exemple.com/yassa.jpg' },
      { kind: 'file', name: 'Thiéb Rouge.JPG' },
      { kind: 'file', name: 'mafe' },
      { kind: 'file', name: 'dibi.png' },
      null,
    ]);
  });

  it('associe les fichiers sans tenir compte de la casse, des accents ni de l’extension', () => {
    expect(fileKey('C:/photos/Thiéb_Rouge.jpeg')).toBe('thieb rouge');
    const match = matchImageFiles(sheet.lines, ['thieb-rouge.jpg', 'Mafé.webp', 'inutile.png']);
    expect(Object.fromEntries(match.byRow)).toEqual({ 3: 'thieb-rouge.jpg', 4: 'Mafé.webp' });
    expect(match.missing).toEqual([{ row: 5, name: 'dibi.png' }]);
    expect(match.unused).toEqual(['inutile.png']);
  });

  it('ajoute une photo aux plats existants qui n’en ont pas', () => {
    const cats: Category[] = [{ id: 'c', parentId: null, name: 'Plats', description: null, isActive: true, position: 0, itemsCount: 2 }];
    const plan = buildPlan(
      sheet.lines,
      cats,
      new Map([
        [
          'c',
          [
            { id: 'i-yassa', name: 'Yassa', hasImage: false },
            { id: 'i-thieb', name: 'Thiéb', hasImage: true },
            { id: 'i-bissap', name: 'Bissap', hasImage: false },
          ],
        ],
      ]),
    );
    expect(plan.existing.map((l) => l.itemId)).toEqual(['i-yassa', 'i-thieb', 'i-bissap']);
    // Thiéb a déjà une photo, Bissap n'en a pas dans le fichier.
    expect(plan.photosToAdd.map((l) => l.itemId)).toEqual(['i-yassa']);
  });
});
