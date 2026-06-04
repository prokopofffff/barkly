/**
 * ГАВ design tokens that can't live in Tailwind classes — raw hex values for
 * react-native-svg (`fill`/`stroke`) and gradient stop arrays for
 * expo-linear-gradient. Keep these in sync with tailwind.config.js so the
 * className palette and the imperative palette never drift.
 */
import type { GradientName } from '@barkly/zero';

// Re-export so app modules keep importing `GradientName` from '@/constants/gav'
// while the canonical definition lives in the shared @barkly/zero contract.
export type { GradientName };

export const COLORS = {
  bg: '#08080c',
  ink: '#050507',
  surface: '#14141d',
  surface2: '#1c1c29',
  elevated: '#262638',
  text: '#f6f6fb',
  textDim: 'rgba(246,246,251,0.62)',
  textFaint: 'rgba(246,246,251,0.34)',
  // hairline borders / dividers (design --line / --line-2)
  line: 'rgba(255,255,255,0.08)',
  line2: 'rgba(255,255,255,0.14)',
  lime: '#b6f23d',
  limeDark: '#8fd010',
  gold: '#ffd83d',
  green: '#54e08a',
  rose: '#ff6b81',
  flame: '#ff8a3d',
  violet: '#c084fc',
  cyan: '#34e3ff',
  pink: '#ff6fcf',
} as const;

/** Gradient stop arrays (left→right / top→bottom), keyed by the shared GradientName. */
export const GRADIENTS = {
  brand: ['#b6f23d', '#34e3ff'],
  reward: ['#ffd83d', '#ff8a3d'],
  fun: ['#c084fc', '#ff6fcf'],
  streak: ['#ffd83d', '#ff8a3d', '#ff5e62'],
} as const satisfies Record<GradientName, readonly string[]>;
