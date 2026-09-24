import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, Circle, Lock, MailX } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { acceptInvite, lookupInvite } from '../../lib/api/endpoints';
import { INVITE_PROBLEMS, PASSWORD_RULES } from '../../lib/demo/users';
import { formatDateTime, formatRelative } from '../../lib/format';
import { useQuery } from '../../lib/hooks';
import { Button } from '../../ui/Button';
import { Field, Input, PasswordInput } from '../../ui/Field';
import { Skeleton } from '../../ui/Skeleton';
import { cn } from '../../ui/cn';

/**
 * Accept an invitation.
 *
 * Where an invitation link lands. Public, like sign-in: the person opening it
 * has no account yet. It resolves the link first and says plainly when it
 * cannot be used - expired, already used, replaced by a newer one, withdrawn,
 * or not a link at all - rather than showing a form that would fail on
 * submit. A usable link gets one form: choose a password, confirm it, and the
 * account is active and signed in with that password.
 *
 * The same card as sign-in, so the first screen a new user sees is the
 * product's, not a bare form.
 */
export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const query = useQuery((signal) => lookupInvite(token, signal), [token]);
  const invite = query.data;

  return (
    <div className="auth-canvas relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <section data-theme="light" className="w-full max-w-[30rem]">
        <div className="animate-auth-card rounded-[18px] border border-[var(--t-auth-card-line)] bg-[var(--t-auth-card)] p-6 shadow-[0_34px_80px_-28px_rgba(2,10,20,0.55)] sm:p-9">
          <div className="flex justify-center">
            <span className="block h-10 overflow-hidden" style={{ aspectRatio: '8000 / 2044' }}>
              <img
                src="/brand/logo-lockup-tagline.png"
                alt="Deep Algorithms"
                className="size-full object-cover"
                draggable="false"
              />
            </span>
          </div>

          {query.isLoading && !invite ? (
            <div className="mt-8 flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-7 w-56 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="mt-4 h-11 w-full rounded" />
              <Skeleton className="h-11 w-full rounded" />
              <span role="status" className="sr-only">
                Checking your invitation
              </span>
            </div>
          ) : query.isError && !invite ? (
            <Problem
              title="The invitation could not be checked"
              detail={query.error?.message ?? 'Try again in a moment.'}
              action={
                <Button variant="auth" size="lg" onClick={query.refetch}>
                  Try again
                </Button>
              }
            />
          ) : invite?.state === 'valid' ? (
            <AcceptForm token={token} invite={invite} />
          ) : (
            <Problem
              title={INVITE_PROBLEMS[invite?.state ?? 'invalid'].title}
              detail={INVITE_PROBLEMS[invite?.state ?? 'invalid'].detail}
              meta={
                invite?.state === 'expired' && invite.expiresAt
                  ? `Expired ${formatRelative(invite.expiresAt)}${invite.invitedBy ? `. Sent by ${invite.invitedBy}.` : '.'}`
                  : null
              }
              action={
                <Button as={Link} to="/login" variant="auth" size="lg" iconRight={ArrowRight}>
                  Go to sign in
                </Button>
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

function Problem({ title, detail, meta, action }) {
  return (
    <div className="mt-8 flex flex-col items-start gap-3">
      <span className="grid size-11 place-items-center rounded-full border border-medium/30 bg-medium-soft text-medium">
        <MailX aria-hidden="true" className="size-5" />
      </span>
      <h1 className="font-display text-[24px] leading-tight font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
      <p className="text-[14px] leading-relaxed text-ink-2">{detail}</p>
      {meta && <p className="text-[12.5px] text-ink-3">{meta}</p>}
      <div className="mt-2 w-full [&>*]:w-full">{action}</div>
    </div>
  );
}

function AcceptForm({ token, invite }) {
  const { signIn, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const results = PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(password, invite.username) }));
  const allOk = results.every((rule) => rule.ok);
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    setError('');
    if (!allOk || confirm !== password) return;
    setSubmitting(true);
    try {
      const { username } = await acceptInvite({ token, password, confirm });
      /* Sign in with the password just chosen, through the ordinary sign-in
         path - so the first sign-in is also the proof that it works. */
      await signIn({ email: username, password });
      navigate('/posture', { replace: true });
    } catch (failure) {
      setError(failure?.message ?? 'The invitation could not be accepted.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1 className="mt-8 font-display text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-ink">
        Set up your account
      </h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
        {invite.invitedBy} invited you to join as <span className="font-semibold text-ink">{invite.roleLabel}</span>.
        Choose a password to finish.
      </p>
      <p className="mt-1 text-[12.5px] text-ink-3" title={formatDateTime(invite.expiresAt)}>
        This link expires {formatRelative(invite.expiresAt)} and works once.
      </p>

      {isAuthenticated && user && (
        <p
          role="status"
          className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-medium/25 bg-medium-soft px-3 py-2.5 text-[12.5px] text-ink-2"
        >
          <AlertTriangle aria-hidden="true" className="mt-px size-4 shrink-0 text-medium" />
          You are signed in as {user.name}. Finishing this signs you in as {invite.name} instead.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-critical/25 bg-critical-soft px-3 py-2.5 text-[13px] text-ink-2"
        >
          <AlertTriangle aria-hidden="true" className="mt-px size-4 shrink-0 text-critical" />
          {error}
        </p>
      )}

      <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="accept-name">
            <Input id="accept-name" value={invite.name} readOnly />
          </Field>
          <Field label="Username" htmlFor="accept-username" hint="Or sign in with your email.">
            <Input id="accept-username" value={invite.username} readOnly autoComplete="username" className="font-mono" />
          </Field>
        </div>
        <Field label="Email" htmlFor="accept-email">
          <Input id="accept-email" value={invite.email} readOnly />
        </Field>
        <Field
          label={
            <span className="inline-flex items-center gap-2">
              <Lock aria-hidden="true" className="size-3.5 text-ink-3" />
              New password
            </span>
          }
          htmlFor="accept-password"
          required
          error={touched && !allOk ? 'The password does not meet every rule below.' : undefined}
        >
          <PasswordInput
            id="accept-password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            invalid={touched && !allOk}
            aria-describedby="accept-password-rules"
          />
        </Field>
        <ul id="accept-password-rules" className="-mt-1 grid gap-1 sm:grid-cols-2" aria-label="Password rules">
          {results.map((rule) => (
            <li
              key={rule.key}
              className={cn(
                'flex items-start gap-1.5 text-[12px]',
                rule.ok ? 'text-low' : 'text-ink-3',
                rule.key === 'distinct' && 'sm:col-span-2',
              )}
            >
              {rule.ok ? (
                <Check aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              ) : (
                <Circle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              )}
              <span>
                {rule.label}
                <span className="sr-only">{rule.ok ? ' - met' : ' - not met yet'}</span>
              </span>
            </li>
          ))}
        </ul>
        <Field
          label="Confirm password"
          htmlFor="accept-confirm"
          required
          error={mismatch || (touched && confirm !== password) ? 'The two passwords do not match.' : undefined}
        >
          <PasswordInput
            id="accept-confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            invalid={mismatch || (touched && confirm !== password)}
          />
        </Field>
        <Button type="submit" variant="auth" size="lg" className="mt-1" loading={submitting} iconRight={ArrowRight}>
          {submitting ? 'Setting up…' : 'Set password and sign in'}
        </Button>
      </form>
      <p className="mt-5 text-center text-[12px] text-ink-3">
        Already set up? <Link to="/login" className="font-medium text-brand hover:underline">Sign in</Link>
      </p>
    </>
  );
}
