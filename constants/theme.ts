export const BRAND = {
  primary: '#14B8A6',
  primaryContainer: '#115E59',
  secondary: '#94A3B8',
  surface: '#F4F7F6',
  surfaceDark: '#071018',
};

/** Shared Discipline AI visual language (auth + app). */
export const AUTH = {
  ink: '#071018',
  inkMid: '#0B1C24',
  tealDeep: '#0A3D3A',
  teal: '#14B8A6',
  tealSoft: '#2DD4BF',
  mist: '#A7C0BB',
  mistBright: '#D2E4DF',
  cream: '#F3F7F5',
  /** Semi-transparent glass panel */
  panel: 'rgba(10, 24, 30, 0.78)',
  /** Solid panel color — required so outlined input labels don't get struck by the border */
  panelSolid: '#0E1A20',
  panelBorder: 'rgba(167, 192, 187, 0.18)',
  field: 'rgba(243, 247, 245, 0.06)',
  fieldSolid: '#122229',
  danger: '#FCA5A5',
  warn: '#FCD34D',
};

export const APP = {
  background: AUTH.ink,
  backgroundMid: AUTH.inkMid,
  /** Slightly lifted teal-ink surface so cards read clearly against the canvas */
  card: '#132A2F',
  cardAlt: '#16343A',
  cardBorder: 'rgba(45, 212, 191, 0.22)',
  cardHighlight: 'rgba(20, 184, 166, 0.14)',
  text: AUTH.cream,
  textMuted: AUTH.mist,
  accent: AUTH.teal,
  accentSoft: AUTH.tealSoft,
};

export interface BrandPalette {
  /** Screen background gradient stops */
  canvas: [string, string, string];
  orbPrimary: string;
  orbSecondary: string;
  orbPrimaryOpacity: number;
  orbSecondaryOpacity: number;
  /** Card surface gradient stops */
  card: [string, string];
  cardFeatured: [string, string];
  cardBorder: string;
  cardBorderFeatured: string;
  accentBar: string;
  accentBarFeatured: string;
  /** Actions */
  accent: string;
  onAccent: string;
  accentText: string;
  divider: string;
  textMuted: string;
  success: string;
  danger: string;
  warn: string;
  /** Cards need a lift on the light canvas; the dark canvas separates by contrast alone. */
  cardShadowOpacity: number;
}

export const DARK_PALETTE: BrandPalette = {
  canvas: [AUTH.ink, AUTH.inkMid, '#08221F'],
  orbPrimary: AUTH.teal,
  orbSecondary: AUTH.tealSoft,
  orbPrimaryOpacity: 0.12,
  orbSecondaryOpacity: 0.08,
  card: ['rgba(22, 52, 58, 0.95)', '#132A2F'],
  cardFeatured: ['rgba(20, 184, 166, 0.18)', 'rgba(19, 42, 47, 0.96)'],
  cardBorder: 'rgba(45, 212, 191, 0.22)',
  cardBorderFeatured: 'rgba(45, 212, 191, 0.35)',
  accentBar: 'rgba(45, 212, 191, 0.45)',
  accentBarFeatured: AUTH.tealSoft,
  accent: AUTH.teal,
  onAccent: AUTH.ink,
  accentText: AUTH.tealSoft,
  divider: AUTH.panelBorder,
  textMuted: AUTH.mist,
  success: AUTH.tealSoft,
  danger: AUTH.danger,
  warn: AUTH.warn,
  cardShadowOpacity: 0,
};

export const LIGHT_PALETTE: BrandPalette = {
  canvas: ['#F6FAF9', '#EDF5F3', '#E4F1EE'],
  orbPrimary: '#0F766E',
  orbSecondary: '#14B8A6',
  orbPrimaryOpacity: 0.07,
  orbSecondaryOpacity: 0.06,
  card: ['#FFFFFF', '#F7FBFA'],
  cardFeatured: ['rgba(20, 184, 166, 0.16)', '#FFFFFF'],
  cardBorder: 'rgba(15, 118, 110, 0.18)',
  cardBorderFeatured: 'rgba(15, 118, 110, 0.34)',
  accentBar: 'rgba(15, 118, 110, 0.32)',
  accentBarFeatured: '#0F766E',
  accent: '#0F766E',
  onAccent: '#FFFFFF',
  accentText: '#0F766E',
  divider: 'rgba(11, 28, 36, 0.12)',
  textMuted: '#4A6360',
  success: '#0F766E',
  danger: '#B3261E',
  warn: '#B45309',
  cardShadowOpacity: 0.08,
};
