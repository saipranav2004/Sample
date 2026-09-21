import { useId } from 'react';
import { formatNumber } from '../../lib/format';
import { FINGERPRINT_AXES } from '../../lib/demo/genome';
import { cn } from '../../ui/cn';

/**
 * The four purpose-built visuals the Genome screens need. Each one exists
 * because a generic chart would say less:
 *
 *   Fingerprint    six axes at once, baseline against observed. A bar chart
 *                  would lose the shape, which is the thing being compared.
 *   ScheduleGrid   7 x 24 of activity. "Off-hours" is only meaningful next to
 *                  the hours that are normal for this identity.
 *   VolumeBand     the value inside the band it is judged against, so a spike
 *                  is self-evidencing rather than asserted.
 *   ApiShareList   ranked call mix, with never-before-seen calls called out.
 *
 * All four draw marks in the data hue (`--t-series-1`, the same blue
 * `TrendChart` defaults to) and reserve the severity tiers for severity, so a
 * red mark on any of them always means the same thing.
 */

/* ── Behavioural fingerprint ──────────────────────────────────────────────── */

const SIZE = 210;
const CENTRE = SIZE / 2;
const RADIUS = 74;

function axisPoint(index, count, value) {
  /* Start at twelve o'clock so the first axis is where the eye lands. */
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const distance = (Math.max(0, Math.min(100, value)) / 100) * RADIUS;
  return [CENTRE + Math.cos(angle) * distance, CENTRE + Math.sin(angle) * distance];
}

function polygon(values, axes) {
  return axes
    .map((axis, index) => axisPoint(index, axes.length, values[axis.key] ?? 0).map((n) => n.toFixed(1)).join(','))
    .join(' ');
}

/**
 * `series` is `[{ key, label, values, tone }]`. Two series is the useful
 * maximum: three overlapping polygons stop being readable, which is why the
 * peer view compares against one average rather than every member.
 */
export function Fingerprint({ series, axes = FINGERPRINT_AXES, className }) {
  const titleId = useId();

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby={titleId}
        className="w-full max-w-[240px]"
      >
        <title id={titleId}>
          {series.map((entry) => `${entry.label}: ${axes.map((axis) => `${axis.label} ${entry.values[axis.key]}`).join(', ')}`).join('. ')}
        </title>

        {/* Rings at 25% steps, so a reader can estimate a value without a scale. */}
        {[0.25, 0.5, 0.75, 1].map((step) => (
          <polygon
            key={step}
            points={polygon(
              Object.fromEntries(axes.map((axis) => [axis.key, step * 100])),
              axes,
            )}
            fill="none"
            stroke="var(--t-line)"
            strokeWidth="1"
          />
        ))}

        {axes.map((axis, index) => {
          const [x, y] = axisPoint(index, axes.length, 100);
          return <line key={axis.key} x1={CENTRE} y1={CENTRE} x2={x} y2={y} stroke="var(--t-line)" strokeWidth="1" />;
        })}

        {series.map((entry) => (
          <polygon
            key={entry.key}
            points={polygon(entry.values, axes)}
            fill={entry.tone}
            fillOpacity={entry.fillOpacity ?? 0.16}
            stroke={entry.tone}
            strokeWidth="1.75"
            strokeDasharray={entry.dashed ? '4 3' : undefined}
          />
        ))}
      </svg>

      <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-1">
        {axes.map((axis) => (
          <div key={axis.key} className="flex items-baseline justify-between gap-2">
            <dt className="truncate text-[11.5px] text-ink-3" title={axis.label}>
              {axis.label}
            </dt>
            <dd className="flex shrink-0 items-baseline gap-1.5">
              {series.map((entry) => (
                <span
                  key={entry.key}
                  data-numeric=""
                  className="text-[11.5px] font-semibold"
                  style={{ color: entry.tone }}
                  title={entry.label}
                >
                  {entry.values[axis.key]}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {series.map((entry) => (
          <li key={entry.key} className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
            <span
              aria-hidden="true"
              className="h-0.5 w-4 rounded-full"
              style={{ background: entry.tone }}
            />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Activity schedule ────────────────────────────────────────────────────── */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LEVEL_OPACITY = [0.06, 0.28, 0.58, 1];

/**
 * `weeks` is 7 arrays of 24 levels, 0-3. `anomalyCells` marks the hours an
 * anomaly landed in, drawn in the critical tone so an off-hours call is visible
 * against the schedule that makes it abnormal.
 */
export function ScheduleGrid({ weeks, anomalyCells = [], className }) {
  const marked = new Set(anomalyCells.map(([day, hour]) => `${day}-${hour}`));

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex gap-1.5">
        <div className="flex shrink-0 flex-col gap-[3px] pt-[15px]">
          {DAYS.map((day) => (
            <span key={day} className="h-3 text-[10px] leading-3 text-ink-3">
              {day}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex justify-between text-[10px] text-ink-3">
            {['00', '06', '12', '18', '23'].map((hour) => (
              <span key={hour}>{hour}:00</span>
            ))}
          </div>
          <div className="flex flex-col gap-[3px]">
            {weeks.map((hours, dayIndex) => (
              <div key={DAYS[dayIndex]} className="flex gap-[3px]">
                {hours.map((level, hourIndex) => {
                  const isAnomaly = marked.has(`${dayIndex}-${hourIndex}`);
                  return (
                    <span
                      key={hourIndex}
                      title={`${DAYS[dayIndex]} ${String(hourIndex).padStart(2, '0')}:00 - ${isAnomaly ? 'anomaly' : `activity level ${level} of 3`}`}
                      className="h-3 min-w-0 flex-1 rounded-[2px]"
                      style={{
                        background: isAnomaly ? 'var(--t-critical)' : 'var(--t-series-1)',
                        opacity: isAnomaly ? 1 : LEVEL_OPACITY[level],
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          Quiet
          {LEVEL_OPACITY.map((opacity) => (
            <span
              key={opacity}
              aria-hidden="true"
              className="size-2.5 rounded-[2px]"
              style={{ background: 'var(--t-series-1)', opacity }}
            />
          ))}
          Busy
        </span>
        {anomalyCells.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-critical" />
            Anomaly
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Volume against the baseline band ─────────────────────────────────────── */

/**
 * `points` is `[{ hour, value, min, max }]`. The band is the identity's own
 * observed range, so a bar leaving it is evidence rather than an assertion.
 */
export function VolumeBand({ points, className }) {
  const titleId = useId();
  const peak = Math.max(...points.map((point) => Math.max(point.value, point.max))) || 1;
  const width = 100 / points.length;

  return (
    <div className={cn('min-w-0', className)}>
      <svg viewBox="0 0 100 44" preserveAspectRatio="none" role="img" aria-labelledby={titleId} className="h-28 w-full">
        <title id={titleId}>
          Hourly call volume against the baseline band. Peak {formatNumber(peak)} per hour.
        </title>
        {points.map((point, index) => {
          const x = index * width;
          const bandTop = 44 - (point.max / peak) * 40;
          const bandBottom = 44 - (point.min / peak) * 40;
          const valueTop = 44 - (point.value / peak) * 40;
          const outside = point.value > point.max;
          return (
            <g key={point.hour}>
              <rect
                x={x + width * 0.08}
                y={bandTop}
                width={width * 0.84}
                height={Math.max(1, bandBottom - bandTop)}
                fill="var(--t-series-1)"
                fillOpacity="0.14"
              />
              <rect
                x={x + width * 0.28}
                y={valueTop}
                width={width * 0.44}
                height={Math.max(0.6, 44 - valueTop)}
                fill={outside ? 'var(--t-critical)' : 'var(--t-series-1)'}
                fillOpacity={outside ? 0.95 : 0.8}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-ink-3">
        {['00:00', '06:00', '12:00', '18:00', '23:00'].map((hour) => (
          <span key={hour}>{hour}</span>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-ink-3">
        Shaded band is this identity's own baseline range. A bar above it is what a volume spike
        means.
      </p>
    </div>
  );
}

/* ── Ranked API share ─────────────────────────────────────────────────────── */

export function ApiShareList({ actions, newApis = [], className }) {
  return (
    <ul className={cn('flex flex-col', className)}>
      {actions.map((action) => (
        <li key={action.api} className="border-b border-line py-2 last:border-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-mono text-[12px] text-ink-2" title={action.api}>
              {action.api}
            </span>
            <span data-numeric="" className="shrink-0 text-[12px] font-semibold text-ink">
              {action.share}%
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-track">
              <span
                className="block h-full rounded-full"
                style={{ width: `${action.share}%`, background: 'var(--t-series-1)' }}
              />
            </span>
            <span data-numeric="" className="shrink-0 text-[11px] text-ink-3">
              {formatNumber(action.calls)} calls
            </span>
          </div>
        </li>
      ))}

      {newApis.map((api) => (
        <li key={api.api} className="mt-2 rounded-[var(--radius-control)] border border-critical/35 bg-critical-soft px-2.5 py-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-mono text-[12px] font-semibold text-critical" title={api.api}>
              {api.api}
            </span>
            <span className="shrink-0 text-[10px] font-bold tracking-[0.08em] text-critical uppercase">
              Never seen
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-ink-2">{api.detail}</p>
        </li>
      ))}
    </ul>
  );
}
