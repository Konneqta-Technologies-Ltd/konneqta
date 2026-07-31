/**
 * Theme presets catalogue.
 *
 * Each preset defines:
 * - `id`: stored in the DB (`profiles.theme`). Constrained by CHECK.
 * - `name`: shown in the picker UI.
 * - `colors`: the palette applied via inline styles to the card.
 * - `layout`: a key that selects which JSX layout component renders.
 * - `isFree`: whether a free user can use this. Only ONE preset is free
 *   ("classic"); the rest are Pro. Exempt users (builder) bypass this.
 *
 * SECURITY
 * --------
 * Only the `id` is ever stored in the DB — never raw CSS, never user HTML.
 * The DB CHECK constraint (phase2-themes-banners.sql) rejects any value not
 * in this list. This makes theme selection XSS-proof by construction.
 *
 * To add a new preset:
 *   1. Add an object to THEME_PRESETS below.
 *   2. Add the id to the CHECK constraint in supabase/phase2-themes-banners.sql.
 *   3. Add a layout component in components/card-layouts/ that matches the
 *      `layout` key.
 */

export type ThemeLayout =
  | "standard"
  | "centered"
  | "split"
  | "minimal"
  | "banner-hero";

export type ThemeColors = {
  /** Card background. */
  bg: string;
  /** Info block background (the dark strip behind name/role in classic). */
  infoBg: string;
  /** Primary text color (name). */
  text: string;
  /** Secondary text color (job title, company). */
  subtext: string;
  /** Accent color (flip button, links accents). */
  accent: string;
  /** Decorative side-panel color (classic only). */
  panel: string;
  /** Banner overlay color (for themes that show a banner). */
  overlay: string;
};

export type ThemePreset = {
  id: string;
  name: string;
  colors: ThemeColors;
  layout: ThemeLayout;
  isFree: boolean;
  /** Custom font family (from theme_custom). Applied to name/headings. */
  fontFamily?: string;
  /** Custom avatar border-radius (from theme_custom). */
  avatarShape?: "circle" | "square" | "rounded";
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "classic",
    name: "Classic",
    isFree: true,
    layout: "standard",
    colors: {
      bg: "#101010",
      infoBg: "#201F1F",
      text: "#FAFAFA",
      subtext: "#CFCFCF",
      accent: "#FF6B2C",
      panel: "#7751b8",
      overlay: "rgba(0,0,0,0.45)",
    },
  },
  {
    id: "centered",
    name: "Centered",
    isFree: false,
    layout: "centered",
    colors: {
      bg: "#0f0f1a",
      infoBg: "transparent",
      text: "#ededed",
      subtext: "#a1a1aa",
      accent: "#8b5cf6",
      panel: "transparent",
      overlay: "rgba(0,0,0,0.5)",
    },
  },
  {
    id: "split",
    name: "Split",
    isFree: false,
    layout: "split",
    colors: {
      bg: "#094335",
      infoBg: "#f4f4f5",
      text: "#f3f3f3f3",
      subtext: "#fff",
      accent: "#FF6B2C",
      panel: "#FF6B2C",
      overlay: "rgba(0,0,0,0.4)",
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    isFree: false,
    layout: "minimal",
    colors: {
      bg: "#ffffff",
      infoBg: "transparent",
      text: "#18181b",
      subtext: "#a1a1aa",
      accent: "#18181b",
      panel: "transparent",
      overlay: "rgba(255,255,255,0.6)",
    },
  },
  {
    id: "banner-hero",
    name: "Banner Hero",
    isFree: false,
    layout: "banner-hero",
    colors: {
      bg: "#000000",
      infoBg: "transparent",
      text: "#ffffff",
      subtext: "#d4d4d8",
      accent: "#FF6B2C",
      panel: "transparent",
      overlay: "rgba(0,0,0,0.6)",
    },
  },
];

export const DEFAULT_THEME_ID = "classic";

/**
 * Look up a preset by id. Falls back to "classic" if the id is missing or
 * invalid — defensive so a bad DB value never crashes the page.
 */
export function getTheme(themeId: string | null | undefined): ThemePreset {
  if (!themeId) return THEME_PRESETS[0];
  return THEME_PRESETS.find((t) => t.id === themeId) ?? THEME_PRESETS[0];
}

export type ThemeCustomization ={
  /** Optional override for the card background. */
  bg?: string;
  accent?: string;
  text?: string;
  subtext?: string;
  infoBg?: string;
  avatarShape?: "circle" | "square" | "rounded";
  fontFamily?: "system" | "inter" | "playfair" | "henny penny" | "metamorphous" | "passero" | "birthstone";
  cardBannerUrl?: string;
}

export function resolveTheme(
  themeId: string | null | undefined,
  custom: ThemeCustomization | null | undefined
): ThemePreset {
  const preset = getTheme(themeId);
  if (!custom || Object.keys(custom).length === 0) return preset;

  // Resolve font key → CSS font-family string (e.g. "playfair" →
  // "var(--font-playfair), serif"). Lives at the preset top level so the
  // card layouts can read theme.fontFamily directly.
  const resolvedFont = custom.fontFamily
    ? resolveFontFamily(custom.fontFamily)
    : undefined;

  return {
    ...preset,
    // Colors: custom values override preset values.
    colors: {
      ...preset.colors,
      ...(custom.bg ? { bg: custom.bg } : {}),
      ...(custom.accent ? { accent: custom.accent } : {}),
      ...(custom.text ? { text: custom.text } : {}),
      ...(custom.subtext ? { subtext: custom.subtext } : {}),
      ...(custom.infoBg ? { infoBg: custom.infoBg } : {}),
    },
    // Non-color customizations live on the preset top level.
    ...(custom.avatarShape ? { avatarShape: custom.avatarShape } : {}),
    ...(resolvedFont ? { fontFamily: resolvedFont } : {}),
  };
}

/**
 * Map a customization font key → the CSS variable that the matching Google
 * Font is exposed under in app/layout.tsx. Used by the card layouts to apply
 * the user's chosen font via inline style.
 */
export const FONT_OPTIONS = {
  inter: "var(--font-inter), sans-serif",
  "henny penny": "'Henny Penny', system-ui",
  playfair: "var(--font-playfair), serif",
  metamorphous: "var(--font-metamorphous), serif",
  passero: "var(--font-passero), sans-serif",
  birthstone: "var(--font-birthstone), cursive",
} as const;

export type FontFamilyKey = keyof typeof FONT_OPTIONS;

/** Resolve a customization font key to its CSS font-family string. */
export function resolveFontFamily(
  key: ThemeCustomization["fontFamily"]
): string | undefined {
  if (!key) return undefined;
  return FONT_OPTIONS[key as FontFamilyKey] ?? FONT_OPTIONS.inter;
}
