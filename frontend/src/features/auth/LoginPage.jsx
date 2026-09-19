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
 * Sign-in follows the supplied brand template: brand panel on the left,
 * credential card on the right.
 *
 * The field is labelled "Username" per that template and is submitted as the
 * `email` property the `POST /api/auth/login` contract defines — no second
 * field is invented, and no client-side format is imposed the API does not
 * enforce.
 */
export default function LoginPage() {
  const { signIn, isAuthenticated, expired, clearExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetHintOpen, setResetHintOpen] = useState(false);
  const usernameRef = useRef(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  if (isAuthenticated) {
    const target = location.state?.from?.pathname || '/posture';
    return <Navigate to={target} replace />;
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
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
      {/* Brand panel */}
      <section className="auth-canvas relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-20 h-[420px] w-[420px] rotate-[24deg] bg-[linear-gradient(115deg,transparent_46%,rgba(18,176,240,0.14)_48%,rgba(18,176,240,0.14)_52%,transparent_54%)]"
        />

        <p className="relative inline-flex w-fit items-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-3.5 py-1.5 text-[10.5px] font-semibold tracking-[0.16em] text-[#9fd8f7] uppercase">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
          Enterprise Security Platform
        </p>

        <div className="relative max-w-xl">
          <h1 className="font-display text-[46px] leading-[1.03] font-extrabold tracking-[-0.035em] text-white xl:text-[58px]">
            Non-Human
            <br />
            Identity
            <br />
            <span className="text-accent">Discovery</span>
          </h1>
          <p className="mt-7 max-w-lg text-balance text-[15px] leading-relaxed text-[#aec6df]">
            Inventory every role, service principal and key across your AWS accounts, trace what
            they can reach, and catch credentials the moment they leak into source control.
          </p>

          <ul className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
            {TRUST_MARKS.map((mark) => (
              <li key={mark.label} className="flex items-center gap-2 text-[13px] text-[#cfe0ef]">
                <mark.icon aria-hidden="true" className="size-4 text-accent" />
                {mark.label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12.5px] text-[#7d97b3]">
          © {new Date().getFullYear()} Deep Algorithms · Fostering AI. Connecting Minds.
        </p>
      </section>

      {/* Credential card */}
      <section className="flex items-center justify-center bg-canvas px-4 py-10 sm:px-8">
        <div className="w-full max-w-[26rem]">
          <div className="animate-rise rounded-[18px] border border-line bg-surface p-6 shadow-md sm:p-8">
            <div className="flex justify-center lg:justify-start">
              <BrandLockup variant="default" height={30} />
            </div>

            <h2 className="mt-7 text-[25px] leading-tight font-extrabold tracking-[-0.025em] text-ink">
              Welcome
            </h2>
            <p className="mt-1.5 text-[13.5px] text-ink-3">Sign in to access the platform</p>

            {expired && !formError && (
              <p
                role="status"
                className="mt-5 flex items-start gap-2 rounded-[var(--radius-control)] border border-medium/25 bg-medium-soft px-3 py-2.5 text-[12.5px] text-ink-2"
              >
                <AlertTriangle aria-hidden="true" className="mt-px size-4 shrink-0 text-medium" />
                Your session expired. Sign in again to continue where you left off.
              </p>
            )}

            {formError && (
              <p
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-[var(--radius-control)] border border-critical/25 bg-critical-soft px-3 py-2.5 text-[12.5px] text-ink-2"
              >
                <AlertTriangle aria-hidden="true" className="mt-px size-4 shrink-0 text-critical" />
                {formError}
              </p>
            )}

            <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-5">
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

              <div>
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

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setResetHintOpen((value) => !value)}
                    aria-expanded={resetHintOpen}
                    className="text-[12.5px] font-medium text-brand hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                {resetHintOpen && (
                  <p className="animate-fade mt-2 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
                    Credentials are issued by your platform administrator. Self-service reset is not
                    enabled on this deployment — contact your administrator to have it reset.
                  </p>
                )}
              </div>

              <Button type="submit" variant="accent" size="lg" loading={submitting} iconRight={ArrowRight}>
                {submitting ? 'Signing in…' : 'Sign in securely'}
              </Button>
            </form>

            <p className="mt-6 text-center text-[11.5px] leading-relaxed text-ink-3">
              Authorized use only. Every access attempt is logged and monitored.
            </p>
          </div>

          <p className="mt-6 text-center text-[11.5px] text-ink-3 lg:hidden">
            © {new Date().getFullYear()} Deep Algorithms · Fostering AI. Connecting Minds.
          </p>
        </div>
      </section>
    </div>
  );
}
