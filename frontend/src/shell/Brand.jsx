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
