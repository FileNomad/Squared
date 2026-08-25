export type ColorScheme = "light" | "dark";

export type ThemeColors = {
  primary: string;
  primaryPressed: string;
  onPrimary: string;

  success: string;
  danger: string;
  warning: string;

  background: string;
  surface: string;
  surfaceSubtle: string;

  border: string;
  borderStrong: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  successBg: string;
  successBorder: string;
  successText: string;

  dangerBg: string;
  dangerBorder: string;
  dangerText: string;
  dangerTextStrong: string;

  warningBg: string;
  warningBorder: string;
  warningText: string;

  overlay: string;
};

export const Colors: Record<
  ColorScheme,
  ThemeColors
> = {
  light: {
    primary: "#6366F1",
    primaryPressed: "#4F46E5",
    onPrimary: "#FFFFFF",

    success: "#059669",
    danger: "#DC2626",
    warning: "#92400E",

    background: "#F9FAFB",
    surface: "#FFFFFF",
    surfaceSubtle: "#F3F4F6",

    border: "#E5E7EB",
    borderStrong: "#D1D5DB",

    textPrimary: "#111827",
    textSecondary: "#6B7280",
    textTertiary: "#9CA3AF",

    successBg: "#ECFDF5",
    successBorder: "#A7F3D0",
    successText: "#059669",

    dangerBg: "#FEF2F2",
    dangerBorder: "#FCA5A5",
    dangerText: "#DC2626",
    dangerTextStrong: "#991B1B",

    warningBg: "#FFFBEB",
    warningBorder: "#FCD34D",
    warningText: "#92400E",

    overlay: "rgba(17, 24, 39, 0.4)",
  },

  dark: {
    primary: "#818CF8",
    primaryPressed: "#6366F1",
    onPrimary: "#0B1120",

    success: "#34D399",
    danger: "#F87171",
    warning: "#FBBF24",

    background: "#0B1120",
    surface: "#161B2E",
    surfaceSubtle: "#1E2540",

    border: "#2A3348",
    borderStrong: "#3A4560",

    textPrimary: "#F3F4F6",
    textSecondary: "#9CA3AF",
    textTertiary: "#6B7280",

    successBg: "#052E22",
    successBorder: "#0F5132",
    successText: "#34D399",

    dangerBg: "#3B0A0A",
    dangerBorder: "#7F1D1D",
    dangerText: "#F87171",
    dangerTextStrong: "#FCA5A5",

    warningBg: "#3D2C05",
    warningBorder: "#78350F",
    warningText: "#FBBF24",

    overlay: "rgba(0, 0, 0, 0.6)",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 20,
  pill: 999,
};

export const FontSize = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 32,
};
