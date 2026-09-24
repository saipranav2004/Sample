import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { bandFor, PILLAR_STATUS } from '../../lib/posture';
import { Meter } from '../../ui/Meter';
import { Tag } from '../../ui/Tag';
import { cn, TONE_VAR } from '../../ui/cn';

/**
 * A score out of 100 as a ring, coloured by its band. The number is the
 * reading; the ring is how much of 100 is left, so two rings side by side
 * compare at a glance without reading either number.
 */
export function ScoreRing({ score, size = 44, stroke, grade, label, className }) {
  const band = bandFor(score);
  const width = stroke ?? Math.max(3, Math.round(size / 11));
  const radius = (size - width) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const large = size >= 96;
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Posture score ${score} of 100, ${band.label}${grade ? `, grade ${grade}` : ''}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--t-track)" strokeWidth={width} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE_VAR[band.tone]}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className="transition-[stroke-dasharray] duration-[900ms] ease-[var(--ease-out-quint)]"
        />
      </svg>
      <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-center leading-none">
        <span>
          <span
            data-numeric=""
            className={cn(
              'block font-display font-extrabold tracking-[-0.03em] text-ink',
              large ? 'text-[34px]' : size >= 56 ? 'text-[17px]' : 'text-[12.5px]',
            )}
          >
            {score}
          </span>
          {large && <span className="mt-1 block text-[11px] font-medium text-ink-3">of 100{grade ? ` · ${grade}` : ''}</span>}
        </span>
      </span>
    </span>
  );
}

export function BandTag({ score, size = 'sm' }) {
  const band = bandFor(score);
  return (
    <Tag tone={band.tone} size={size} dot>
      {band.label}
    </Tag>
  );
}

/** A change in score. Up is better here, the reverse of a risk score. */
export function Delta({ value, suffix = '', className }) {
  if (value === null || value === undefined) return <span className={cn('text-[12px] text-ink-3', className)}>New</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const tone = value > 0 ? 'text-low' : value < 0 ? 'text-critical' : 'text-ink-3';
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[12px] font-semibold', tone, className)} data-numeric="">
      <Icon aria-hidden="true" className="size-3.5" />
      {value > 0 ? `+${value}` : value}
      {suffix}
      <span className="sr-only">{value > 0 ? ' better' : value < 0 ? ' worse' : ' unchanged'}</span>
    </span>
  );
}

export function PillarStatusTag({ status }) {
  const meta = PILLAR_STATUS[status] ?? PILLAR_STATUS.pass;
  return (
    <Tag tone={meta.tone} size="sm">
      {meta.label}
    </Tag>
  );
}

/** One row per pillar: name, a meter of its score, the score and its status. */
export function PillarBars({ pillars, detail }) {
  return (
    <ul className="flex flex-col gap-3">
      {pillars.map((pillar) => (
        <li key={pillar.key} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_2.25rem_3.25rem] items-center gap-3">
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-medium text-ink" title={pillar.summary}>
              {pillar.label}
            </span>
            {detail && <span className="block truncate text-[11px] text-ink-3">{detail(pillar)}</span>}
          </span>
          <Meter value={pillar.score} tone={PILLAR_STATUS[pillar.status]?.tone ?? 'brand'} label={`${pillar.label} ${pillar.score} of 100`} />
          <span data-numeric="" className="text-right text-[12.5px] font-semibold text-ink">
            {pillar.score}
          </span>
          <span className="justify-self-end">
            <PillarStatusTag status={pillar.status} />
          </span>
        </li>
      ))}
    </ul>
  );
}
