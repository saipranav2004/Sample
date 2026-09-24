import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, History, KeyRound, Lock, RotateCcw, Users, Wrench } from 'lucide-react';
import { useAccess } from '../../app/useAccess';
import { rollBackPosture } from '../../lib/api/endpoints';
import { severityMeta } from '../../lib/domain';
import { formatDate, formatDateTime, formatNumber, formatRelative } from '../../lib/format';
import { bandFor, PILLARS } from '../../lib/posture';
import { TrendChart } from '../../charts/TrendChart';
import { Button } from '../../ui/Button';
import { DataGrid } from '../../ui/DataGrid';
import { Panel, PanelHeader } from '../../ui/Panel';
import { Modal } from '../../ui/Overlay';
import { ClearState } from '../../ui/States';
import { SegmentedControl } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { TONE_VAR } from '../../ui/cn';
import { PillarBars, ScoreRing } from './parts';
import { RemediateDrawer } from './RemediateDrawer';

const CREDENTIAL_STATUS = {
  ACTIVE: { label: 'Active', tone: 'neutral' },
  UNUSED: { label: 'Unused', tone: 'medium' },
  EXPIRED: { label: 'Expired', tone: 'critical' },
};

const STATE_META = {
  fail: { label: 'Fail', tone: 'critical' },
  remediated: { label: 'Remediated', tone: 'info' },
  pass: { label: 'Pass', tone: 'low' },
};

/**
 * One identity's posture, as the Posture tab of the identity page.
 *
 * Why the score is what it is, and what each fix is worth. Overview leads
 * with the failed checks and a Remediate action on each, because that is what
 * somebody opened it to do; Checks lists every check that applies, passing
 * ones included, so a score of 100 can be read as well as a score of 6;
 * History is how it got here. A fix in force can be rolled back from Checks.
 */
export function PostureRecord({ data }) {
  const { can } = useAccess();
  const { notify } = useToast();
  const [view, setView] = useState('overview');
  const [fixing, setFixing] = useState(null);
  const [rolling, setRolling] = useState(null);
  const [busy, setBusy] = useState(false);
  const { identity, checks } = data;
  const failing = checks.filter((check) => check.state === 'fail');
  const remediated = checks.filter((check) => check.state === 'remediated');
  /* Re-read from the latest data, so a refetch while a dialog is open cannot
     leave it acting on a stale plan. */
  const fixingCheck = fixing ? failing.find((check) => check.key === fixing) : null;
  const rollingCheck = rolling ? checks.find((check) => check.key === rolling && check.canRollBack) : null;
  const editable = can('posture.remediate');

  const rollBack = async () => {
    setBusy(true);
    try {
      const result = await rollBackPosture({ identityId: identity.id, checkKey: rollingCheck.key });
      notify({
        variant: 'success',
        title: 'Fix rolled back',
        description: `${identity.name}: score ${result.before} to ${result.after}.${
          result.reopenedAlerts > 0 ? ` ${result.reopenedAlerts} ${result.reopenedAlerts === 1 ? 'alert' : 'alerts'} reopened.` : ''
        }`,
      });
      setRolling(null);
    } catch (failure) {
      notify({ variant: 'error', title: 'Not rolled back', description: failure?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ScoreSummary data={data} failing={failing} remediated={remediated} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Posture view"
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'checks', label: `Checks (${checks.length})` },
            { value: 'history', label: 'History' },
          ]}
          value={view}
          onChange={setView}
        />
        {!editable && (
          <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <Lock aria-hidden="true" className="size-3.5" />
            Read-only. Applying or rolling back a fix needs the Admin role or higher.
          </p>
        )}
      </div>

      {view === 'overview' && <Overview data={data} failing={failing} onFix={setFixing} editable={editable} />}
      {view === 'checks' && <ChecksTable checks={checks} onFix={setFixing} onRollBack={setRolling} editable={editable} />}
      {view === 'history' && <HistoryTab data={data} />}

      {fixingCheck && <RemediateDrawer identity={identity} check={fixingCheck} onClose={() => setFixing(null)} />}

      <Modal
        open={Boolean(rollingCheck)}
        onClose={() => (busy ? null : setRolling(null))}
        title="Roll back this fix?"
        description={
          rollingCheck
            ? `${rollingCheck.fix?.action}. The check fails again from now and costs ${rollingCheck.weight} points. Alerts the fix resolved are reopened if they are still resolved. Undo the change in AWS as well - rolling back here does not do that.`
            : undefined
        }
        icon={RotateCcw}
        tone="medium"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRolling(null)} disabled={busy}>
              Keep the fix
            </Button>
            <Button variant="danger" icon={RotateCcw} loading={busy} onClick={rollBack}>
              Roll back
            </Button>
          </>
        }
      />
    </div>
  );
}

function ScoreSummary({ data, failing, remediated }) {
  const { identity, projected, peers } = data;
  return (
    <Panel prominence="lead" className="animate-rise">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
        <div className="flex items-center gap-4">
          <ScoreRing score={identity.score} size={104} grade={identity.grade} />
          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Posture score</p>
            <p className="mt-1 text-[13px] text-ink-2">
              {failing.length === 0 ? 'Every applicable check passes.' : `${failing.length} failed ${failing.length === 1 ? 'check' : 'checks'} cost ${100 - identity.score} points.`}
            </p>
            {remediated.length > 0 && (
              <p className="mt-0.5 text-[12px] text-ink-3">
                {remediated.length} remediated here.
              </p>
            )}
          </div>
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 @min-[40rem]:grid-cols-4">
          <Fact label="After every fix" value={failing.length ? `${projected} (+${projected - identity.score})` : '-'} />
          <Fact label={`${peers.group} average`} value={`${peers.average} of ${formatNumber(peers.count)}`} />
          <Fact
            label="Peer standing"
            value={peers.percentile === null ? 'Only one' : peers.percentile === 0 ? 'Lowest in group' : `Above ${peers.percentile}%`}
          />
          <Fact label="Open alerts" value={formatNumber(data.openAlerts)} to={data.openAlerts ? `/identities/${encodeURIComponent(identity.id)}?tab=alerts` : null} />
        </dl>
      </div>
    </Panel>
  );
}

function Fact({ label, value, to }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">{label}</dt>
      <dd data-numeric="" className="mt-0.5 truncate text-[14px] font-semibold text-ink">
        {to ? (
          <Link to={to} className="text-brand hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function Overview({ data, failing, onFix, editable }) {
  const { identity, pillars, credentials, peers, projected } = data;
  const impact = [...failing].sort((a, b) => b.remediation.gain - a.remediation.gain);

  return (
    <div className="grid gap-4 @min-[64rem]:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel className="animate-rise">
          <PanelHeader title="Pillars" subtitle="Fail means a high or critical check fails in the pillar; Warn means a lower one does." />
          <div className="mt-4">
            <PillarBars
              pillars={pillars}
              detail={(pillar) =>
                pillar.checks === 0
                  ? 'No check here applies to it'
                  : pillar.failing
                    ? `${pillar.failing} of ${pillar.checks} checks failing`
                    : `${pillar.checks} ${pillar.checks === 1 ? 'check' : 'checks'} passing`
              }
            />
          </div>
        </Panel>

        <Panel className="animate-rise" data-stagger="" style={{ '--stagger': 1 }}>
          <PanelHeader title="Why this score" />
          {failing.length === 0 ? (
            <ClearState
              compact
              title="Nothing is costing points"
              description={`Every check that applies to ${identity.name} passes.`}
            />
          ) : (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{narrative(identity, failing)}</p>
          )}
        </Panel>

        <Panel flush className="animate-rise overflow-hidden" data-stagger="" style={{ '--stagger': 2 }}>
          <div className="px-4 pt-4 sm:px-5">
            <PanelHeader title="Failed checks" subtitle="Worst first. Each fix shows what it earns before anything is applied." />
          </div>
          {failing.length === 0 ? (
            <div className="px-4 pb-4 sm:px-5">
              <ClearState compact title="No failed checks" description="There is nothing to remediate on this identity." />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {failing.map((check) => (
                <FailedCheck key={check.key} check={check} onFix={onFix} editable={editable} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel className="animate-rise">
          <PanelHeader title="Score impact" subtitle="What each fix adds, largest first." />
          {impact.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-ink-3">Already at {identity.score}. Nothing left to fix.</p>
          ) : (
            <>
              <ul className="mt-3 flex flex-col gap-2">
                {impact.map((check) => (
                  <li key={check.key} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2" title={check.remediation.action}>
                      {check.remediation.action}
                    </span>
                    <span data-numeric="" className="shrink-0 text-[13px] font-bold text-low">
                      +{check.remediation.gain}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2.5">
                <ScoreRing score={projected} size={40} />
                <p className="text-[12.5px] leading-snug text-ink-2">
                  Projected score after every fix: <span className="font-semibold text-ink">{projected}</span>,{' '}
                  {bandFor(projected).label}.
                </p>
              </div>
            </>
          )}
        </Panel>

        <Panel className="animate-rise" data-stagger="" style={{ '--stagger': 1 }}>
          <PanelHeader icon={KeyRound} title="Bound credentials" subtitle="What this identity holds." />
          {credentials.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-ink-3">
              {identity.mfa === null ? 'No credentials recorded.' : `Console password only. MFA ${identity.mfa ? 'enabled' : 'not enabled'}.`}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {credentials.map((cred) => {
                const status = CREDENTIAL_STATUS[cred.status] ?? { label: cred.status, tone: 'neutral' };
                return (
                  <li key={cred.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[12px] text-ink" title={cred.id}>
                        {cred.id}
                      </span>
                      <span className="block truncate text-[11px] text-ink-3">
                        {cred.label} · {formatNumber(cred.ageDays)} days old
                        {cred.lastUsedDays === null || cred.lastUsedDays === undefined
                          ? ''
                          : cred.lastUsedDays === 0
                            ? ' · used today'
                            : ` · used ${formatNumber(cred.lastUsedDays)} ${cred.lastUsedDays === 1 ? 'day' : 'days'} ago`}
                      </span>
                    </span>
                    <Tag tone={status.tone} size="sm">
                      {status.label}
                    </Tag>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            to={`/identities/${encodeURIComponent(identity.id)}?tab=credentials`}
            className="mt-3 inline-block text-[12px] font-medium text-brand hover:underline"
          >
            All credentials on this identity
          </Link>
        </Panel>

        <Panel className="animate-rise" data-stagger="" style={{ '--stagger': 2 }}>
          <PanelHeader icon={Users} title="Peer group" subtitle={`The ${formatNumber(peers.count)} identities classified ${peers.group} in the estate.`} />
          <PeerBar peers={peers} score={identity.score} />
        </Panel>
      </div>
    </div>
  );
}

function narrative(identity, failing) {
  const worst = failing.slice(0, 3);
  const parts = worst.map((check) => `${check.title.charAt(0).toLowerCase()}${check.title.slice(1)} fails (${check.weight} points)`);
  const rest = failing.length - worst.length;
  const restPoints = failing.slice(3).reduce((sum, check) => sum + check.weight, 0);
  const lead = `${identity.name} scores ${identity.score} because `;
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  const tail = rest > 0 ? ` ${rest} lower-weighted ${rest === 1 ? 'check costs' : 'checks cost'} ${restPoints} more.` : '';
  const pillars = [...new Set(failing.map((check) => PILLARS[check.pillar].label))];
  return `${lead}${joined}.${tail} The weaknesses sit in ${pillars.join(', ')}.`;
}

function FailedCheck({ check, onFix, editable }) {
  const severity = severityMeta(check.severity);
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
      <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: TONE_VAR[severity.tone] }} />
      <div className="min-w-0 flex-1 basis-64">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-ink">{check.title}</span>
          <Tag tone={severity.tone} size="sm">
            {severity.label}
          </Tag>
          <Tag tone="neutral" size="sm">
            {PILLARS[check.pillar].label}
          </Tag>
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{check.detail}</p>
        <p className="mt-1 text-[11.5px] text-ink-3">
          Failing since {formatDate(check.since)}
          {check.control ? ` · ${check.control}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 self-center">
        <span data-numeric="" className="text-[12.5px] font-semibold text-low">
          +{check.remediation.gain}
        </span>
        {editable && (
          <Button variant="primary" size="sm" icon={Wrench} onClick={() => onFix(check.key)}>
            Remediate
          </Button>
        )}
      </div>
    </li>
  );
}

function PeerBar({ peers, score }) {
  const marks = [
    { key: 'you', label: 'This identity', value: score, strong: true },
    { key: 'average', label: 'Group average', value: peers.average },
    { key: 'best', label: 'Best in group', value: peers.best },
  ];
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-track">
        {marks.map((mark) => (
          <span
            key={mark.key}
            aria-hidden="true"
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
            style={{
              left: `${mark.value}%`,
              width: mark.strong ? 14 : 10,
              height: mark.strong ? 14 : 10,
              background: mark.strong ? TONE_VAR[bandFor(score).tone] : 'var(--t-ink-3)',
            }}
          />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {marks.map((mark) => (
          <div key={mark.key}>
            <dt className="text-[11px] text-ink-3">{mark.label}</dt>
            <dd data-numeric="" className="text-[14px] font-semibold text-ink">
              {mark.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
        {peers.percentile === null
          ? 'The only identity in its group.'
          : peers.percentile === 0
            ? `No other identity classified ${peers.group} scores lower.`
            : `Scores above ${peers.percentile}% of the other ${formatNumber(peers.count - 1)} identities classified ${peers.group}.`}
      </p>
    </div>
  );
}

function ChecksTable({ checks, onFix, onRollBack, editable }) {
  const columns = [
    {
      key: 'check',
      header: 'Check',
      primary: true,
      width: '30%',
      cell: (check) => (
        <span className="block min-w-0">
          <span className="block text-[12.5px] font-medium text-ink">{check.title}</span>
          {check.control && <span className="block truncate text-[11px] text-ink-3">{check.control}</span>}
        </span>
      ),
    },
    {
      key: 'pillar',
      header: 'Pillar',
      width: '13%',
      cell: (check) => <span className="text-[12.5px] text-ink-2">{PILLARS[check.pillar].label}</span>,
    },
    {
      key: 'severity',
      header: 'Severity',
      width: '10%',
      cell: (check) =>
        check.severity ? (
          <Tag tone={severityMeta(check.severity).tone} size="sm">
            {severityMeta(check.severity).label}
          </Tag>
        ) : (
          <span className="text-[12.5px] text-ink-3">-</span>
        ),
    },
    {
      key: 'result',
      header: 'Result',
      width: '11%',
      cell: (check) => (
        <Tag tone={STATE_META[check.state].tone} size="sm">
          {STATE_META[check.state].label}
        </Tag>
      ),
    },
    {
      key: 'detail',
      header: 'Detail',
      width: '24%',
      priority: 'wide',
      cell: (check) => (
        <span className="block text-[12px] leading-snug text-ink-2">
          {check.state === 'pass'
            ? 'Passing.'
            : check.state === 'remediated'
              ? check.fix
                ? `${check.fix.action}${check.fix.owner ? ` (owner ${check.fix.owner})` : ''}. ${check.fix.by}, ${formatRelative(check.fixedAt)}.`
                : `Cleared by: ${check.clearedBy}.`
              : check.detail}
        </span>
      ),
    },
    {
      key: 'fix',
      header: 'Fix',
      width: '12%',
      cell: (check) =>
        check.state === 'fail' ? (
          editable ? (
            <Button variant="secondary" size="sm" icon={Wrench} onClick={() => onFix(check.key)}>
              +{check.remediation.gain}
            </Button>
          ) : (
            <span data-numeric="" className="text-[12.5px] font-semibold text-low">
              +{check.remediation.gain}
            </span>
          )
        ) : check.state === 'remediated' ? (
          check.canRollBack && editable ? (
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => onRollBack(check.key)} title={`Applied ${formatDateTime(check.fixedAt)}`}>
              Roll back
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] text-ink-3" title={formatDateTime(check.fixedAt)}>
              <CheckCircle2 aria-hidden="true" className="size-3.5 text-low" />
              Applied
            </span>
          )
        ) : (
          <span className="text-[12.5px] text-ink-3">-</span>
        ),
    },
  ];
  return (
    <Panel flush className="animate-rise overflow-hidden">
      <div className="px-4 pt-4 pb-3 sm:px-5">
        <PanelHeader title="Every check that applies" subtitle="Checks that cannot apply - MFA on a role, say - are left out rather than counted as passes." />
      </div>
      <DataGrid caption="Posture checks" columns={columns} rows={checks} rowKey={(check) => check.key} density="compact" />
    </Panel>
  );
}

function HistoryTab({ data }) {
  const series = useMemo(
    () => data.history.map((point) => ({ ...point, label: formatDate(point.at) })),
    [data.history],
  );
  const lowest = Math.min(...series.map((point) => point.score));
  return (
    <div className="grid gap-4 @min-[64rem]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Panel className="animate-rise">
        <PanelHeader icon={History} title="Score over six months" subtitle="Monthly, then today. Each change is a check starting to fail or being fixed." />
        {series.length < 2 ? (
          <p className="mt-4 text-[12.5px] text-ink-3">Created less than a month ago, so there is no history to draw yet.</p>
        ) : (
          <TrendChart
            className="mt-4"
            data={series}
            dataKey="score"
            label="Posture score"
            height={200}
            color={TONE_VAR[bandFor(data.identity.score).tone]}
            yDomain={[Math.max(0, Math.floor((lowest - 10) / 10) * 10), 100]}
          />
        )}
      </Panel>
      <Panel flush className="animate-rise overflow-hidden" data-stagger="" style={{ '--stagger': 1 }}>
        <div className="px-4 pt-4 sm:px-5">
          <PanelHeader title="Change log" subtitle="Newest first." />
        </div>
        {data.events.length === 0 ? (
          <div className="px-4 pb-4 sm:px-5">
            <ClearState compact title="No changes" description="No check has ever failed on this identity." />
          </div>
        ) : (
          <ol className="mt-3 max-h-[28rem] divide-y divide-line overflow-y-auto border-t border-line">
            {data.events.map((event) => (
              <li key={`${event.kind}-${event.title}-${event.at}`} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <span
                  data-numeric=""
                  className={`w-9 shrink-0 text-right text-[12.5px] font-bold ${event.delta > 0 ? 'text-low' : 'text-critical'}`}
                >
                  {event.delta > 0 ? `+${event.delta}` : event.delta}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-ink">{event.title}</span>
                  <span className="block text-[11.5px] leading-snug text-ink-3">{event.detail}</span>
                </span>
                <span className="shrink-0 text-[11px] text-ink-3" title={formatDateTime(event.at)}>
                  {formatDate(event.at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
