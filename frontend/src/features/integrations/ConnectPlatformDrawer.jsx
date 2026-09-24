import { useState } from 'react';
import { CheckCircle2, Loader2, PlugZap, ShieldCheck, Unplug } from 'lucide-react';
import { useAccess } from '../../app/useAccess';
import { connectPlatform, disconnectPlatform, fetchPlatformConnection } from '../../lib/api/endpoints';
import { formatDateTime, formatRelative } from '../../lib/format';
import { useQuery } from '../../lib/hooks';
import { Button } from '../../ui/Button';
import { Field, Input, PasswordInput, Select } from '../../ui/Field';
import { Drawer } from '../../ui/Overlay';
import { SectionLabel } from '../../ui/Panel';
import { DetailSkeleton } from '../../ui/Skeleton';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { cn } from '../../ui/cn';
import { PLATFORM_CATEGORIES, PLATFORM_CONNECT } from './catalog';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connect a platform, or manage one that is connected.
 *
 * The same shape for every platform: what to grant on its side, the fields
 * it needs in its own formats, then a connection test that runs its checks
 * one by one. Secrets are sent once and kept only as their last four
 * characters. Mounted only while open, so every opening starts clean.
 */
export function ConnectPlatformDrawer({ platform, mode, onClose, onChanged }) {
  const spec = PLATFORM_CONNECT[platform.key];
  const category = PLATFORM_CATEGORIES[platform.category];
  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={category?.label ?? 'Integration'}
      title={mode === 'manage' ? platform.name : `Connect ${platform.name}`}
      subtitle={platform.summary}
      width="lg"
      footer={null}
    >
      {mode === 'manage' ? (
        <ManageBody platform={platform} spec={spec} onClose={onClose} onChanged={onChanged} />
      ) : (
        <ConnectBody platform={platform} spec={spec} onClose={onClose} onChanged={onChanged} />
      )}
    </Drawer>
  );
}

function validate(spec, values) {
  const errors = {};
  for (const field of spec.fields) {
    const value = String(values[field.key] ?? '').trim();
    if (!value) {
      if (!field.optional) errors[field.key] = `Enter the ${field.label.toLowerCase()}.`;
      continue;
    }
    if (field.pattern && !field.pattern.test(value)) errors[field.key] = field.message;
  }
  return errors;
}

function ConnectBody({ platform, spec, onClose, onChanged }) {
  const { notify } = useToast();
  const [values, setValues] = useState(() =>
    Object.fromEntries(spec.fields.map((field) => [field.key, field.initial ?? ''])),
  );
  const [touched, setTouched] = useState(false);
  /* 'form' -> 'testing' -> 'done'; a failed save drops back to 'form'. */
  const [phase, setPhase] = useState('form');
  const [passed, setPassed] = useState(0);
  const [error, setError] = useState('');

  const errors = validate(spec, values);
  const valid = Object.keys(errors).length === 0;

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    setError('');
    if (!valid) return;
    setPhase('testing');
    setPassed(0);
    /* The checks run in order, as a real connection test does: each one
       depends on the one before. */
    for (let index = 0; index < spec.checks.length; index += 1) {
      await wait(550);
      setPassed(index + 1);
    }
    const clean = Object.fromEntries(spec.fields.map((field) => [field.key, String(values[field.key] ?? '').trim()]));
    const config = Object.fromEntries(spec.fields.filter((field) => !field.secret).map((field) => [field.key, clean[field.key]]));
    const secrets = Object.fromEntries(spec.fields.filter((field) => field.secret).map((field) => [field.key, clean[field.key]]));
    try {
      await connectPlatform({ key: platform.key, config, secrets, display: spec.display(clean) });
      setPhase('done');
      onChanged?.();
      notify({ variant: 'success', title: `${platform.name} connected`, description: 'Its first sync is scheduled.' });
    } catch (failure) {
      setError(failure?.message ?? 'The connection could not be saved.');
      setPhase('form');
    }
  };

  if (phase === 'done') {
    return (
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-low/40 bg-low-soft px-3.5 py-3">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-low" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink">{platform.name} is connected</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">
              Every check passed. It shows as awaiting its first sync until data arrives for{' '}
              {platform.provides.map((entry) => entry.label).join(' and ')}.
            </p>
          </div>
        </div>
        <CheckList checks={spec.checks} passed={spec.checks.length} />
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  const testing = phase === 'testing';

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 px-4 py-4 sm:px-5">
      <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-3.5 py-3">
        <SectionLabel>Grant on {platform.short ?? platform.name}</SectionLabel>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{spec.grant}</p>
      </div>

      <fieldset disabled={testing} className="flex flex-col gap-4">
        <legend className="sr-only">Connection settings</legend>
        {spec.fields.map((field) => {
          const id = `connect-${platform.key}-${field.key}`;
          const fieldError = touched ? errors[field.key] : undefined;
          const common = {
            id,
            value: values[field.key],
            invalid: Boolean(fieldError),
            onChange: (event) => setValues((current) => ({ ...current, [field.key]: event.target.value })),
          };
          return (
            <Field
              key={field.key}
              label={field.optional ? `${field.label} (optional)` : field.label}
              htmlFor={id}
              required={!field.optional}
              error={fieldError}
              hint={field.hint ?? (field.secret ? 'Sent once to test the connection. Only its last four characters are kept.' : undefined)}
            >
              {field.type === 'select' ? (
                <Select {...common} options={field.options} />
              ) : field.secret ? (
                <PasswordInput {...common} autoComplete="off" spellCheck={false} placeholder={field.placeholder} className="font-mono text-[12.5px]" />
              ) : (
                <Input {...common} autoComplete="off" spellCheck={false} placeholder={field.placeholder} />
              )}
            </Field>
          );
        })}
      </fieldset>

      {testing && (
        <div>
          <SectionLabel>Testing the connection</SectionLabel>
          <div className="mt-2">
            <CheckList checks={spec.checks} passed={passed} running />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-[var(--radius-control)] border border-critical/30 bg-critical-soft px-3 py-2 text-[12.5px] text-critical">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={testing}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" icon={ShieldCheck} loading={testing}>
          {testing ? 'Testing…' : 'Test and connect'}
        </Button>
      </div>
    </form>
  );
}

function CheckList({ checks, passed, running = false }) {
  return (
    <ul className="flex flex-col gap-2" aria-live="polite">
      {checks.map((label, index) => {
        const done = index < passed;
        const current = running && index === passed;
        return (
          <li
            key={label}
            className={cn(
              'flex items-center gap-2.5 rounded-[var(--radius-control)] border px-3 py-2',
              done ? 'border-line bg-surface-2' : 'border-line bg-surface',
            )}
          >
            {done ? (
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-low" />
            ) : current ? (
              <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-brand" />
            ) : (
              <PlugZap aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
            )}
            <span className={cn('min-w-0 flex-1 text-[12.5px]', done ? 'text-ink' : 'text-ink-3')}>{label}</span>
            {done && (
              <Tag tone="low" size="sm">
                Passed
              </Tag>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ManageBody({ platform, spec, onClose, onChanged }) {
  const { lock } = useAccess();
  const { notify } = useToast();
  const query = useQuery((signal) => fetchPlatformConnection(platform.key, signal), [platform.key]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const connection = query.data;

  if (query.isLoading && !connection) {
    return (
      <div className="px-4 py-4 sm:px-5">
        <DetailSkeleton rows={4} />
      </div>
    );
  }
  if (!connection) {
    return <p className="px-4 py-6 text-[13px] text-ink-3 sm:px-5">{platform.name} is not connected.</p>;
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="info" size="sm">
          Awaiting first sync
        </Tag>
        <span className="text-[12px] text-ink-3" title={formatDateTime(connection.connectedAt)}>
          Connected {formatRelative(connection.connectedAt)} by {connection.connectedBy}
        </span>
      </div>

      <dl className="flex flex-col divide-y divide-line rounded-[var(--radius-control)] border border-line">
        {spec.fields.map((field) => {
          const value = field.secret ? connection.hints?.[field.key] : connection.config?.[field.key];
          const shown = field.type === 'select' ? field.options.find((option) => option.value === value)?.label ?? value : value;
          return (
            <div key={field.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2.5">
              <dt className="text-[12px] text-ink-3">{field.label}</dt>
              <dd className={cn('min-w-0 text-right text-[12.5px] break-all text-ink', field.secret && 'font-mono')}>
                {shown || <span className="text-ink-3">Not set</span>}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="text-[11.5px] leading-relaxed text-ink-3">
        Secrets are shown by their last four characters only. To change a setting, disconnect and connect again with the new values.
      </p>

      {confirming ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-critical/30 bg-critical-soft px-3.5 py-3">
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Disconnect {platform.name}? The console stops using it. Revoke the token on {platform.short ?? platform.name} as well - disconnecting here does not do that.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Unplug}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await disconnectPlatform(platform.key);
                  notify({ variant: 'success', title: `${platform.name} disconnected` });
                  onChanged?.();
                  onClose();
                } catch (failure) {
                  notify({ variant: 'error', title: 'Not disconnected', description: failure?.message });
                  setBusy(false);
                }
              }}
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" icon={Unplug} locked={lock('integrations.manage')} onClick={() => setConfirming(true)}>
            Disconnect
          </Button>
        </div>
      )}
    </div>
  );
}
