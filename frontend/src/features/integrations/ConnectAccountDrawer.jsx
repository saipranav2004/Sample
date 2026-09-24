import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Download, PlugZap, ShieldCheck } from 'lucide-react';
import { connectAwsAccount } from '../../lib/api/endpoints';
import { downloadText } from '../../lib/csv';
import { Button } from '../../ui/Button';
import { CopyButton, CopyableValue } from '../../ui/Copyable';
import { Field, Input, Select } from '../../ui/Field';
import { Drawer } from '../../ui/Overlay';
import { SectionLabel } from '../../ui/Panel';
import { Tabs } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { cn } from '../../ui/cn';
import { DEPLOY_FORMATS, ROLE_NAME } from './catalog';

const STEPS = [
  { key: 'account', label: 'Account' },
  { key: 'deploy', label: 'Deploy the role' },
  { key: 'verify', label: 'Verify' },
];

const ENVIRONMENTS = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'development', label: 'Development' },
];

const ACCOUNT_ID = /^\d{12}$/;

/**
 * Connect one AWS account, in the order the work actually happens.
 *
 * Which account, then the role deployed into it, then proof that the role
 * works. Each step is only reachable once the one before is complete, and
 * the last step does what a real connector does before it trusts a role:
 * assume it with the tenant's external id. Nothing is saved until that
 * passes, so an abandoned wizard leaves no half-connected account behind.
 *
 * `preset` fills the account in when the wizard is opened from an
 * organisation account that has no role yet. The parent mounts this only
 * while it is open, so every opening starts clean: a wizard that reopened on
 * the last step of a previous account would connect the wrong one.
 */
export function ConnectAccountDrawer({ onClose, data, selectedKeys, preset, onConnected }) {
  const { notify } = useToast();
  const [step, setStep] = useState(0);
  const [accountId, setAccountId] = useState(preset?.id ?? '');
  const [name, setName] = useState('');
  const [env, setEnv] = useState('');
  const [format, setFormat] = useState('cloudformation');
  const [roleArn, setRoleArn] = useState('');
  const [touched, setTouched] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);


  const id = accountId.trim();
  const known = useMemo(
    () => (data?.accounts ?? []).find((account) => account.id === id) ?? null,
    [data, id],
  );
  const alreadyConnected = known && known.state !== 'missing';

  const accountError = !ACCOUNT_ID.test(id)
    ? 'An AWS account id is exactly 12 digits.'
    : alreadyConnected
      ? `${known.name} is already connected.`
      : !known && !name.trim()
        ? 'Give the account a name.'
        : !known && !env
          ? 'Choose an environment.'
          : '';

  const active = DEPLOY_FORMATS.find((entry) => entry.value === format) ?? DEPLOY_FORMATS[0];
  const template = useMemo(
    () =>
      data
        ? active.build({
            consoleAccountId: data.tenant.consoleAccountId,
            externalId: data.tenant.externalId,
            selectedKeys,
          })
        : '',
    [active, data, selectedKeys],
  );
  const expectedArn = `arn:aws:iam::${id}:role/${ROLE_NAME}`;
  const label = known?.name ?? name.trim();

  const verify = async () => {
    setVerifying(true);
    setError('');
    try {
      const outcome = await connectAwsAccount({ accountId: id, name: name.trim(), env, roleArn });
      setResult(outcome);
      setStep(3);
      onConnected?.(outcome.account);
      notify({
        variant: 'success',
        title: `${outcome.account.name} connected`,
        description: 'Discovery runs in this account on the next cycle.',
      });
    } catch (failure) {
      setError(failure?.message ?? 'The role could not be verified.');
    } finally {
      setVerifying(false);
    }
  };

  const footer =
    step === 3 ? (
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    ) : (
      <>
        {step > 0 && (
          <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)} disabled={verifying}>
            Back
          </Button>
        )}
        {step === 0 && (
          <Button
            variant="primary"
            iconRight={ArrowRight}
            onClick={() => {
              setTouched(true);
              if (!accountError) setStep(1);
            }}
          >
            Continue
          </Button>
        )}
        {step === 1 && (
          <Button
            variant="primary"
            iconRight={ArrowRight}
            onClick={() => {
              if (!roleArn) setRoleArn(expectedArn);
              setStep(2);
            }}
          >
            I have deployed it
          </Button>
        )}
        {step === 2 && (
          <Button variant="primary" icon={ShieldCheck} loading={verifying} onClick={verify} disabled={!roleArn.trim()}>
            Verify and connect
          </Button>
        )}
      </>
    );

  return (
    <Drawer
      open
      onClose={verifying ? () => {} : onClose}
      eyebrow="Amazon Web Services"
      title="Connect an AWS account"
      subtitle="Deploy one read-only role, then prove it works. Nothing is saved until the check passes."
      width="lg"
      footer={footer}
    >
      <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
        <ol className="grid grid-cols-3 gap-2" aria-label="Progress">
          {STEPS.map((entry, index) => {
            const done = step > index;
            const current = step === index;
            return (
              <li key={entry.key} aria-current={current ? 'step' : undefined} className="min-w-0">
                <span
                  className={cn(
                    'block h-1 rounded-full',
                    done ? 'bg-low' : current ? 'bg-brand' : 'bg-surface-3',
                  )}
                />
                <span
                  className={cn(
                    'mt-1.5 block truncate text-[11.5px]',
                    current ? 'font-semibold text-ink' : done ? 'text-ink-2' : 'text-ink-3',
                  )}
                >
                  {index + 1}. {entry.label}
                </span>
              </li>
            );
          })}
        </ol>

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Field
              label="AWS account id"
              htmlFor="connect-account-id"
              required
              error={touched && accountError && !ACCOUNT_ID.test(id) ? accountError : undefined}
              hint="The 12-digit id of the account you are connecting, not this console's."
            >
              <Input
                id="connect-account-id"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                value={accountId}
                onChange={(event) => setAccountId(event.target.value.replace(/\D/g, ''))}
                invalid={touched && !ACCOUNT_ID.test(id)}
                className="font-mono"
                placeholder="123456789012"
              />
            </Field>

            {ACCOUNT_ID.test(id) && known && (
              <div
                className={cn(
                  'rounded-[var(--radius-control)] border px-3.5 py-3',
                  alreadyConnected ? 'border-medium/40 bg-medium-soft' : 'border-line bg-surface-2',
                )}
              >
                <p className="text-[12.5px] text-ink">
                  <span className="font-semibold">{known.name}</span>{' '}
                  <span className="text-ink-3">- found in your organisation, {known.env}</span>
                </p>
                <p className="mt-0.5 text-[12px] text-ink-2">
                  {alreadyConnected
                    ? 'This account already has the discovery role. There is nothing to connect.'
                    : 'No discovery role is deployed here yet, so nothing in it is discovered.'}
                </p>
              </div>
            )}

            {ACCOUNT_ID.test(id) && !known && (
              <div className="grid gap-4 @min-[30rem]:grid-cols-2">
                <Field
                  label="Account name"
                  htmlFor="connect-account-name"
                  required
                  error={touched && !name.trim() ? 'Give the account a name.' : undefined}
                >
                  <Input
                    id="connect-account-name"
                    value={name}
                    maxLength={50}
                    onChange={(event) => setName(event.target.value)}
                    invalid={touched && !name.trim()}
                    placeholder="e.g. analytics-prod"
                  />
                </Field>
                <Field
                  label="Environment"
                  htmlFor="connect-account-env"
                  required
                  error={touched && !env ? 'Choose an environment.' : undefined}
                >
                  <Select
                    id="connect-account-env"
                    value={env}
                    onChange={(event) => setEnv(event.target.value)}
                    placeholder="Choose…"
                    options={ENVIRONMENTS}
                    invalid={touched && !env}
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              Deploy this in <span className="font-semibold text-ink">{label}</span>{' '}
              <span className="font-mono text-ink-3">{id}</span>, signed in to that account. It
              creates <span className="font-mono">{ROLE_NAME}</span>, trusted only by this console
              and only with your external id.
            </p>
            <dl className="grid gap-2 @min-[34rem]:grid-cols-2">
              <div className="min-w-0 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2">
                <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Trusted account (ours)</dt>
                <dd className="mt-1">
                  <CopyableValue value={data?.tenant.consoleAccountId ?? ''} />
                </dd>
              </div>
              <div className="min-w-0 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2">
                <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Your external id</dt>
                <dd className="mt-1">
                  <CopyableValue value={data?.tenant.externalId ?? ''} />
                </dd>
              </div>
            </dl>
            <Tabs size="sm" value={format} onChange={setFormat} tabs={DEPLOY_FORMATS} />
            <p className="text-[12px] leading-relaxed text-ink-2">{active.how}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                onClick={() => downloadText(template, active.filename, active.type)}
              >
                {active.filename}
              </Button>
              <CopyButton value={template} label={`Copy the ${active.label} version`} />
            </div>
            <pre className="max-h-64 overflow-auto rounded-[var(--radius-control)] border border-line bg-inset p-3 font-mono text-[11px] leading-relaxed text-ink-2">
              {template}
            </pre>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Field
              label="Role ARN"
              htmlFor="connect-role-arn"
              required
              error={error || undefined}
              hint="The role_arn output of the stack or module, or the ARN on the role's IAM console page."
            >
              <Input
                id="connect-role-arn"
                autoComplete="off"
                spellCheck={false}
                value={roleArn}
                onChange={(event) => {
                  setRoleArn(event.target.value);
                  setError('');
                }}
                invalid={Boolean(error)}
                className="font-mono text-[12px]"
              />
            </Field>
            <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-3.5 py-3">
              <SectionLabel>What verifying does</SectionLabel>
              <ol className="mt-1.5 flex list-decimal flex-col gap-1 pl-4 text-[12px] leading-relaxed text-ink-2">
                <li>Assumes the role with your external id, exactly as discovery will.</li>
                <li>Confirms the trust policy refuses the call without the external id.</li>
                <li>Makes one read call to prove the permissions are attached.</li>
              </ol>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-low/40 bg-low-soft px-3.5 py-3">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-low" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">{result.account.name} is connected</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">
                  Its identities appear on every screen after the first discovery run. Until then
                  it is listed as awaiting discovery, with no counts - not as empty.
                </p>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {result.checks.map((check) => (
                <li key={check.key} className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2.5">
                  <PlugZap aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-low" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[11.5px] text-ink">{check.label}</span>
                    <span className="block text-[11.5px] text-ink-3">{check.note}</span>
                  </span>
                  <Tag tone="low" size="sm">
                    Passed
                  </Tag>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  );
}
