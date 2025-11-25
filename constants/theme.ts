/**
 * Global TGB Theme
 * Unified branding across the entire app.
 */

import { Platform } from "react-native";

/* ──────────────────────────────────────────── */
/* TGB BRAND COLORS */
/* ──────────────────────────────────────────── */
export const TGB_COLORS = {
  purple: "#5A3E8C",      // Matte purple (primary button & accents)
  navy: "#1D3D47",        // Main text, headers, strong accents
  softNavy: "#445A65",    // Muted text, secondary info
  white: "#FFFFFF",
  background: "#FFFFFF",
  grey: "#E5E5E5",
};

/* ──────────────────────────────────────────── */
/* LIGHT & DARK MODE COLORS */
/* These feed into the app-wide <ThemeContext> */
/* ──────────────────────────────────────────── */

export const Colors = {
  light: {
    text: TGB_COLORS.navy,
    textMuted: TGB_COLORS.softNavy,

    background: TGB_COLORS.background,

    tint: TGB_COLORS.purple,
    icon: TGB_COLORS.softNavy,

    tabIconDefault: TGB_COLORS.softNavy,
    tabIconSelected: TGB_COLORS.purple,

    card: TGB_COLORS.white,
    border: "#e7e7e7",
  },

  dark: {
    text: "#F2F2F7",
    textMuted: "#C7C7CC",

    background: "#0D0D0F",

    tint: TGB_COLORS.purple,
    icon: "#A1A1AA",

    tabIconDefault: "#A1A1AA",
    tabIconSelected: TGB_COLORS.purple,

    card: "#1C1C1E",
    border: "#2C2C2E",
  },
};

/* ──────────────────────────────────────────── */
/* FONTS – unchanged, system-friendly */
/* ──────────────────────────────────────────── */

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono:
      "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
