export function cn(...parts) {
  return parts.flat(Infinity).filter(Boolean).join(' ');
}

/** Shared tone palette: risk language stays identical across every surface. */
export const TONE_CLASSES = {
  critical: 'text-critical bg-critical-soft border-critical/25',
  high: 'text-high bg-high-soft border-high/25',
  medium: 'text-medium bg-medium-soft border-medium/25',
  low: 'text-low bg-low-soft border-low/25',
  info: 'text-info bg-info-soft border-info/25',
  brand: 'text-brand bg-info-soft border-brand/25',
  neutral: 'text-ink-2 bg-neutral-soft border-line-strong/60',
};

export const TONE_FG = {
  critical: 'text-critical',
  high: 'text-high',
  medium: 'text-medium',
  low: 'text-low',
  info: 'text-info',
  brand: 'text-brand',
  neutral: 'text-ink-3',
};

export const TONE_BG = {
  critical: 'bg-critical',
  high: 'bg-high',
  medium: 'bg-medium',
  low: 'bg-low',
  info: 'bg-info',
  brand: 'bg-brand',
  neutral: 'bg-neutral',
};

export const TONE_VAR = {
  critical: 'var(--t-critical)',
  high: 'var(--t-high)',
  medium: 'var(--t-medium)',
  low: 'var(--t-low)',
  info: 'var(--t-info)',
  brand: 'var(--t-brand)',
  neutral: 'var(--t-neutral)',
};
