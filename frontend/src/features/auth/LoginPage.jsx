import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Clock3,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { BrandLockup } from '../../shell/Brand';
import { Button } from '../../ui/Button';
import { Field, Input, PasswordInput } from '../../ui/Field';

const TRUST_MARKS = [
  { icon: ShieldCheck, label: 'SOC 2 Type II Certified' },
  { icon: BadgeCheck, label: 'ISO 27001 Compliant' },
  { icon: Clock3, label: '24/7 Monitoring' },
];

/**
 * Sign-in, matching the supplied design: the navy canvas runs edge to edge and
 * the credential card floats on top of it at the right — not a split layout.
 *
 * The field is labelled "Username" per that design and submitted as the
 * `email` property `POST /api/auth/login` defines. There is no password-reset
 * link, no "remember me" and no SSO button, because no endpoint backs any of
 * them; a dead control on a sign-in screen is worse than its absence.
 */
export default function LoginPage() {
  const { signIn, isAuthenticated, expired, clearExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const usernameRef = useRef(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  if (isAuthenticated) {
    return <Navigate to={location.state?.from?.pathname || '/posture'} replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);

    const errors = {};
    if (!values.email.trim()) errors.email = 'Enter your username.';
    if (!values.password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      clearExpired();
      await signIn({ email: values.email.trim(), password: values.password });
      navigate(location.state?.from?.pathname || '/posture', { replace: true });
    } catch (error) {
      setFormError(error?.message || 'Sign-in failed.');
      setValues((current) => ({ ...current, password: '' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-canvas relative min-h-dvh overflow-hidden">
      {/* Brand slash, echoing the mark's diagonal. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-28 h-[560px] w-[560px] rotate-[24deg] bg-[linear-gradient(115deg,transparent_46%,rgba(18,176,240,0.13)_48%,rgba(18,176,240,0.13)_52%,transparent_54%)]"
      />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-[1500px] items-center gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16 lg:px-14 xl:gap-24">
        {/* Brand statement */}
        <section className="order-2 max-w-xl lg:order-1">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-3.5 py-1.5 text-[10.5px] font-semibold tracking-[0.16em] text-[#9fd8f7] uppercase">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
            Enterprise Security Platform
          </p>

          <h1 className="mt-8 font-display text-[40px] leading-[1.04] font-extrabold tracking-[-0.035em] text-white sm:text-[48px] xl:text-[56px]">
            Non-Human
            <br />
            Identity
            <br />
            <span className="text-accent">Discovery</span>
          </h1>

          <p className="mt-6 max-w-lg text-balance text-[14.5px] leading-relaxed text-[#aec6df] sm:text-[15px]">
            Inventory every role, service principal and key across your AWS accounts, trace what
            they can reach, and catch credentials the moment they leak into source control.
          </p>

          <ul className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-3">
            {TRUST_MARKS.map((mark) => (
              <li key={mark.label} className="flex items-center gap-2 text-[13px] text-[#cfe0ef]">
                <mark.icon aria-hidden="true" className="size-4 shrink-0 text-accent" />
                {mark.label}
              </li>
            ))}
          </ul>

          <p className="mt-12 text-[12.5px] text-[#7d97b3] lg:absolute lg:bottom-8 lg:left-14 lg:mt-0">
            © {new Date().getFullYear()} Deep Algorithms · Fostering AI. Connecting Minds.
          </p>
        </section>

        {/* Credential card — floats on the navy, never on its own panel */}
        <section className="order-1 w-full justify-self-center lg:order-2 lg:justify-self-end">
          <div className="animate-rise rounded-[18px] bg-white p-6 shadow-[0_34px_80px_-28px_rgba(2,10,20,0.62)] sm:p-8">
            <BrandLockup variant="default" height={30} />

            <h2 className="mt-7 font-display text-[25px] leading-tight font-extrabold tracking-[-0.025em] text-[#0b1b2e]">
              Welcome
            </h2>
            <p className="mt-1.5 text-[13.5px] text-[#7c8da3]">Sign in to access the platform</p>

            {expired && !formError && (
              <p
                role="status"
                className="mt-5 flex items-start gap-2 rounded-[var(--radius-control)] border border-[#a06a02]/25 bg-[#fdf6e3] px-3 py-2.5 text-[12.5px] text-[#4a5b70]"
              >
                <AlertTriangle aria-hidden="true" className="mt-px size-4 shrink-0 text-[#a06a02]" />
                Your session expired. Sign in again to continue where you left off.
              </p>
            )}

            {formError && (
              <p
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-[var(--radius-control)] border border-[#b42318]/25 bg-[#fdeceb] px-3 py-2.5 text-[12.5px] text-[#4a5b70]"
              >
                <AlertTriangle aria-hidden="true" className="mt-px size-4 shrink-0 text-[#b42318]" />
                {formError}
              </p>
            )}

            {/* The card is always light, so its controls opt out of theme inversion. */}
            <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-5" data-theme="light">
              <Field
                label={
                  <span className="inline-flex items-center gap-2">
                    <Mail aria-hidden="true" className="size-3.5 text-ink-3" />
                    Username
                  </span>
                }
                htmlFor="login-username"
                error={fieldErrors.email}
              >
                <Input
                  id="login-username"
                  ref={usernameRef}
                  size="lg"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck="false"
                  placeholder="das_admin"
                  value={values.email}
                  invalid={Boolean(fieldErrors.email)}
                  onChange={(event) => setValues((v) => ({ ...v, email: event.target.value }))}
                />
              </Field>

              <Field
                label={
                  <span className="inline-flex items-center gap-2">
                    <Lock aria-hidden="true" className="size-3.5 text-ink-3" />
                    Password
                  </span>
                }
                htmlFor="login-password"
                error={fieldErrors.password}
              >
                <PasswordInput
                  id="login-password"
                  size="lg"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={values.password}
                  invalid={Boolean(fieldErrors.password)}
                  onChange={(event) => setValues((v) => ({ ...v, password: event.target.value }))}
                />
              </Field>

              <Button type="submit" variant="accent" size="lg" loading={submitting} iconRight={ArrowRight}>
                {submitting ? 'Signing in…' : 'Sign in securely'}
              </Button>
            </form>

            <p className="mt-6 text-center text-[11.5px] leading-relaxed text-[#7c8da3]">
              Authorized use only. Every access attempt is logged and monitored.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
