/**
 * QueueMaster Pro — Design System Colors
 * Source: Material You / M3 color scheme
 * Matches the HTML reference design exactly.
 */

export const COLORS = {
    // === PRIMARY ===
    primary: '#00685f',
    onPrimary: '#ffffff',
    primaryContainer: '#008378',
    onPrimaryContainer: '#f4fffc',
    primaryFixed: '#89f5e7',
    primaryFixedDim: '#6bd8cb',
    onPrimaryFixed: '#00201d',
    onPrimaryFixedVariant: '#005049',
    inversePrimary: '#6bd8cb',
  
    // === SECONDARY ===
    secondary: '#565e74',
    onSecondary: '#ffffff',
    secondaryContainer: '#dae2fd',
    onSecondaryContainer: '#5c647a',
    secondaryFixed: '#dae2fd',
    secondaryFixedDim: '#bec6e0',
    onSecondaryFixed: '#131b2e',
    onSecondaryFixedVariant: '#3f465c',
  
    // === TERTIARY ===
    tertiary: '#595c5e',
    onTertiary: '#ffffff',
    tertiaryContainer: '#727577',
    onTertiaryContainer: '#fbfdff',
    tertiaryFixed: '#e0e3e5',
    tertiaryFixedDim: '#c4c7c9',
    onTertiaryFixed: '#191c1e',
    onTertiaryFixedVariant: '#444749',
  
    // === ERROR ===
    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    onErrorContainer: '#93000a',
  
    // === SURFACE ===
    surface: '#f8f9ff',
    surfaceDim: '#cbdbf5',
    surfaceBright: '#f8f9ff',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#eff4ff',
    surfaceContainer: '#e5eeff',
    surfaceContainerHigh: '#dce9ff',
    surfaceContainerHighest: '#d3e4fe',
    onSurface: '#0b1c30',
    onSurfaceVariant: '#3d4947',
    inverseSurface: '#213145',
    inverseOnSurface: '#eaf1ff',
  
    // === OUTLINE ===
    outline: '#6d7a77',
    outlineVariant: '#bcc9c6',
  
    // === SURFACE VARIANT ===
    surfaceVariant: '#d3e4fe',
  
    // === BACKGROUND ===
    background: '#f8f9ff',
    onBackground: '#0b1c30',
  
    // === SURFACE TINT ===
    surfaceTint: '#006a61',
  } as const;
  
  // Semantic aliases for quick access
  export const SEMANTIC = {
    // Text
    textPrimary: COLORS.onBackground,
    textSecondary: COLORS.onSurfaceVariant,
    textBrand: COLORS.primary,
    textError: COLORS.error,
    textOnDark: COLORS.inverseOnSurface,
  
    // Backgrounds
    bgPage: COLORS.background,
    bgCard: COLORS.surfaceContainerLowest,
    bgCardElevated: COLORS.surfaceContainerLow,
    bgHighlight: COLORS.surfaceContainerHigh,
    bgDark: COLORS.inverseSurface,
  
    // Borders
    borderDefault: COLORS.outlineVariant,
    borderSubtle: COLORS.surfaceContainerHigh,
    borderStrong: COLORS.outline,
  
    // Brand
    brand: COLORS.primary,
    brandDark: COLORS.primaryContainer,
    brandLight: COLORS.surfaceContainerLow,
    brandAccent: COLORS.primaryFixedDim,
  } as const;
  
  export type ColorKey = keyof typeof COLORS;