import { describe, expect, it } from 'vitest';
import { AA_CONTRAST, contrastRatio, generatePalette, parseHex, rgbToOklch, SHADES } from '~/utils/palette';

describe('generatePalette', () => {
  it('rejette une couleur invalide', () => {
    expect(generatePalette('rouge')).toBeNull();
    expect(generatePalette('#12')).toBeNull();
  });

  it('produit les 11 nuances en hexadécimal', () => {
    const palette = generatePalette('#1d4ed8')!;
    expect(Object.keys(palette).map(Number)).toEqual([...SHADES]);
    for (const value of Object.values(palette)) expect(value).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('va du plus clair au plus foncé', () => {
    const palette = generatePalette('#2f9e44')!;
    const lightness = SHADES.map((s) => rgbToOklch(parseHex(palette[s])!)[0]);
    for (let i = 1; i < lightness.length; i++) expect(lightness[i]).toBeLessThan(lightness[i - 1]!);
  });

  it.each(['#ffd43b', '#fab005', '#69db7c', '#e64980', '#cc4a12', '#000000', '#ffffff'])(
    'la nuance 500 de %s reste lisible avec du texte blanc (WCAG AA)',
    (hex) => {
      const palette = generatePalette(hex)!;
      expect(contrastRatio(palette[500], '#ffffff')).toBeGreaterThanOrEqual(AA_CONTRAST);
    },
  );

  it('garde la teinte de la couleur de marque', () => {
    const brand = rgbToOklch(parseHex('#1d4ed8')!)[2];
    const shade = rgbToOklch(parseHex(generatePalette('#1d4ed8')![500])!)[2];
    expect(Math.abs(brand - shade)).toBeLessThan(8);
  });
});

describe('contrastRatio', () => {
  it('vaut 21 entre noir et blanc et 1 pour une même couleur', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#cc4a12', '#cc4a12')).toBeCloseTo(1, 5);
  });
});
