import { cn } from '../ui/cn';

/**
 * Brand lockup. Two assets ship: the full wordmark (light-on-dark variant for
 * the navigation rail) and the standalone mark for tight spaces. Clear space
 * is enforced with padding rather than baked into the image.
 */
export function BrandLockup({ variant = 'inverse', className, height = 26 }) {
  const src = variant === 'inverse' ? '/brand/logo-lockup-inverse.png' : '/brand/logo-lockup.png';
  return (
    <img
      src={src}
      alt="Deep Algorithms"
      height={height}
      style={{ height }}
      className={cn('w-auto select-none', className)}
      draggable="false"
    />
  );
}

export function BrandMark({ className, size = 26 }) {
  return (
    <img
      src="/brand/mark.png"
      alt="Deep Algorithms"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn('select-none object-contain', className)}
      draggable="false"
    />
  );
}

/** Product name set beside the mark, used where the full lockup is too wide. */
export function ProductWordmark({ className }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <BrandMark size={24} />
      <span className="min-w-0">
        <span className="block truncate font-display text-[13.5px] leading-tight font-extrabold tracking-[-0.01em] text-rail-ink">
          NHI Console
        </span>
        <span className="block truncate text-[10px] leading-tight font-semibold tracking-[0.1em] text-rail-muted uppercase">
          Deep Algorithms
        </span>
      </span>
    </span>
  );
}
