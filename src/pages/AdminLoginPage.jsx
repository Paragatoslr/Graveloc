import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { wait } from "../lib/format";
import { Button, Field, LanguageSwitch, Logo, Modal } from "../components/ui";

const ROLES = [
  ["super_admin", "Continue as Super Administrator"],
  ["cemetery_admin", "Continue as Cemetery Administrator"],
  ["cemetery_staff", "Continue as Cemetery Staff"],
];

export function AdminLoginPage() {
  const { t } = useI18n();
  const { currentStaff, signIn, signInWithRole } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    document.title = `${t("Staff sign in")} · GRAVELOC`;
  }, [t]);

  if (currentStaff) return <Navigate to="/admin/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!email.trim()) {
      setError(t("Enter the email address for your staff account."));
      return;
    }
    if (!password) {
      setError(t("Enter your password."));
      return;
    }
    setBusy(true);
    await wait(600);
    const result = signIn(email, password, remember);
    setBusy(false);
    if (!result.ok) {
      setError(t(result.error));
      return;
    }
    navigate("/admin/dashboard");
  }

  async function demo(role) {
    setError("");
    setBusy(true);
    await wait(500);
    const result = signInWithRole(role);
    setBusy(false);
    if (!result.ok) {
      setError(t(result.error));
      return;
    }
    navigate("/admin/dashboard");
  }

  return (
    <div className="login-shell">
      <section className="login-brand">
        <div className="stack">
          <Logo />
          <h1>{t("Staff sign in")}</h1>
          <p>{t("Manage records, plots, and family access codes for the cemetery.")}</p>
        </div>
        <Link to="/">{t("Return to Family Portal")}</Link>
      </section>
      <section className="login-panel">
        <div className="narrow stack">
          <div className="spread">
            <h2>{t("GRAVELOC Admin")}</h2>
            <LanguageSwitch />
          </div>
          <form className="card card-pad stack" onSubmit={submit} noValidate>
            {error ? <p className="form-alert" role="alert">{error}</p> : null}
            <Field label={t("Email")} required error="">
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label={t("Password")} required>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Button variant="ghost" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword}>
              {showPassword ? t("Hide password") : t("Show password")}
            </Button>
            <label className="check">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              {t("Remember me")}
            </label>
            <Button type="submit" disabled={busy}>{busy ? t("Signing in…") : t("Sign in")}</Button>
            <button type="button" className="text-link" onClick={() => setForgot(true)}>{t("Forgot password")}</button>
          </form>
          <div className="card card-pad stack">
            <h2>{t("Demonstration access")}</h2>
            <p>{t("Choose a role to enter the prototype. Passwords are not shown.")}</p>
            {ROLES.map(([role, label]) => (
              <Button key={role} variant="secondary" onClick={() => demo(role)} disabled={busy}>
                {t(label)}
              </Button>
            ))}
          </div>
        </div>
      </section>
      <Modal
        open={forgot}
        title={t("Forgot password")}
        description={t("Password reset is simulated in this prototype. Use a demonstration role to sign in.")}
        onClose={() => setForgot(false)}
      >
        <Button onClick={() => setForgot(false)}>{t("Back to sign in")}</Button>
      </Modal>
    </div>
  );
}
