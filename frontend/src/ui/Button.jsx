import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] ' +
  'font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ' +
  'active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-55';

const VARIANTS = {
  primary:
    'bg-brand text-white border border-brand-strong/70 shadow-sm hover:bg-brand-strong ' +
    'dark:text-ink-inverse',
  accent:
    'text-white border border-transparent shadow-sm ' +
    'bg-[linear-gradient(135deg,var(--t-accent)_0%,var(--t-brand)_100%)] hover:brightness-[1.06]',
  secondary:
    'bg-surface text-ink border border-line-strong hover:bg-surface-2 hover:border-ink-3/50 shadow-sm',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-surface-3 hover:text-ink',
  danger: 'bg-critical text-white border border-critical/60 shadow-sm hover:brightness-110',
  link: 'bg-transparent border-0 text-brand hover:underline underline-offset-4 px-0',
};

const SIZES = {
  sm: 'h-8 px-3 text-[12.5px]',
  md: 'h-9.5 px-3.5 text-[13.5px]',
  lg: 'h-11 px-5 text-[14.5px]',
};

export const Button = forwardRef(function Button(
  {
    as: Tag = 'button',
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cn(BASE, VARIANTS[variant], variant !== 'link' && SIZES[size], className)}
      disabled={Tag === 'button' ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />
      )}
      {children}
      {IconRight && !loading && <IconRight aria-hidden="true" className="size-4 shrink-0" />}
    </Tag>
  );
});

export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'md', className, ...rest },
  ref,
) {
  const dimension = size === 'sm' ? 'size-8' : 'size-9.5';
  return (
    <Button
      ref={ref}
      variant={variant}
      className={cn(dimension, 'px-0', className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon aria-hidden="true" className="size-4" />
    </Button>
  );
});
