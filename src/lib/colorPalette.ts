export type PaletteStyle = 'vibrant' | 'muted' | 'monochrome';

export interface LandingPalette {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  accentDark: string;
  background: string;
  surface: string;
  surfaceTint: string;
  text: string;
  textMuted: string;
  border: string;
  buttonBg: string;
  buttonText: string;
  buttonHover: string;
  badgeBg: string;
  badgeText: string;
  footerBg: string;
  footerText: string;
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function generatePalette(primaryHex: string, style: PaletteStyle = 'vibrant'): LandingPalette {
  const [h, s, l] = hexToHsl(primaryHex);
  const sat = style === 'muted' ? Math.min(s, 45) : style === 'monochrome' ? Math.min(s, 15) : Math.max(s, 60);
  const accentHue = style === 'monochrome' ? h : (h + 180) % 360;
  const accentSat = style === 'monochrome' ? Math.min(s, 10) : Math.max(sat, 65);

  return {
    primary: hslToHex(h, sat, Math.min(l, 55)),
    primaryLight: hslToHex(h, sat, 92),
    primaryDark: hslToHex(h, sat, 38),
    accent: hslToHex(accentHue, accentSat, 50),
    accentDark: hslToHex(accentHue, accentSat, 35),
    background: hslToHex(h, Math.min(sat, 20), 97),
    surface: hslToHex(h, Math.min(sat, 15), 99),
    surfaceTint: hslToHex(h, sat, 94),
    text: '#0F172A',
    textMuted: '#475569',
    border: hslToHex(h, sat, 85),
    buttonBg: hslToHex(h, sat, Math.min(l, 50)),
    buttonText: '#FFFFFF',
    buttonHover: hslToHex(h, sat, Math.max(l - 8, 25)),
    badgeBg: hslToHex(h, sat, 90),
    badgeText: hslToHex(h, sat, 30),
    footerBg: hslToHex(h, Math.min(sat, 20), 8),
    footerText: '#94A3B8',
  };
}

export const DEFAULT_PALETTE: LandingPalette = generatePalette('#EAB308', 'vibrant');
