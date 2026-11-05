import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { accessErrorText } from "../lib/records";
import { wait } from "../lib/format";
import { Button, PageHeading } from "../components/ui";

export function HomePage() {
  const { t } = useI18n();
  const { db, verifyAndEnter } = useApp();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState("idle");
  const [reason, setReason] = useState("");

  async function goToCode(event) {
    event.preventDefault();
    setPhase("loading");
    setReason("");
    await wait(350);
    let result;
    try {
      result = verifyAndEnter(code);
    } catch {
      result = { ok: false, reason: "storage" };
    }
    if (!result.ok) {
      setPhase("error");
      setReason(result.reason);
      return;
    }
    navigate(`/memorial/${result.record.id}`);
  }

  return (
    <>
      <section className="wrap hero">
        <div>
          <p className="eyebrow">{db.cemetery.name}</p>
          <PageHeading
            title={t("Find Your Loved Ones. Remember Every Moment.")}
            lede={t("Navigate the cemetery with ease and find the resting place of your loved ones through our digital cemetery directory.")}
          />
          <div className="btn-row">
            <Button to="/access">{t("Find a Loved One")}</Button>
            <Button variant="secondary" to="/#how-it-works">{t("How It Works")}</Button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <svg viewBox="0 0 520 340" role="img">
            <title>{t("A simple illustrated cemetery plan")}</title>
            <rect width="520" height="340" rx="18" fill="#e7f2e8" />
            <rect x="36" y="36" width="448" height="268" rx="16" fill="none" stroke="#245B48" strokeWidth="3" />
            <rect x="246" y="48" width="28" height="230" rx="14" fill="#f7f4ee" />
            <rect x="48" y="150" width="424" height="24" rx="12" fill="#f7f4ee" />
            <rect x="58" y="58" width="170" height="78" rx="10" fill="#ffffff" stroke="#c5d1c4" />
            <rect x="292" y="58" width="170" height="78" rx="10" fill="#ffffff" stroke="#c5d1c4" />
            <rect x="58" y="190" width="170" height="78" rx="10" fill="#ffffff" stroke="#c5d1c4" />
            <rect x="292" y="190" width="170" height="78" rx="10" fill="#ffffff" stroke="#c5d1c4" />
            <circle cx="92" cy="92" r="8" fill="#7f9a78" />
            <circle cx="430" cy="86" r="8" fill="#7f9a78" />
            <rect x="118" y="78" width="18" height="14" rx="2" fill="#245B48" />
            <rect x="142" y="78" width="18" height="14" rx="2" fill="#f7fbf8" stroke="#7d9a84" />
            <rect x="166" y="78" width="18" height="14" rx="2" fill="#e7d3a1" stroke="#7a5e2a" />
            <rect x="330" y="214" width="22" height="16" rx="3" fill="#c7a66a" stroke="#245B48" strokeWidth="2" />
            <circle cx="341" cy="222" r="16" fill="none" stroke="#c7a66a" strokeWidth="3" />
            <text x="260" y="318" textAnchor="middle" fill="#245B48" fontSize="16" fontFamily="Inter, sans-serif" fontWeight="700">
              {t("Section A · Block 03 · Lot 018")}
            </text>
          </svg>
        </div>
      </section>

      <section className="wrap section" id="find">
        <h2>{t("Quick access")}</h2>
        <p className="lede">{t("Use the private code on your family card. Names cannot be searched from the public site.")}</p>
        <div className="quick-grid" style={{ marginTop: 16 }}>
          <form className="card card-pad stack" onSubmit={goToCode}>
            <h3>{t("Enter Access Code")}</h3>
            <p>{t("Type the code exactly as it appears on your family card.")}</p>
            <label htmlFor="home-code">{t("Access code")}</label>
            <input
              id="home-code"
              value={code}
              placeholder="GRV-8K29-XP41"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck="false"
              aria-invalid={phase === "error"}
              aria-describedby={phase === "error" ? "home-code-error" : undefined}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            {phase === "error" ? (
              <p id="home-code-error" className="form-alert" role="alert">{t(accessErrorText(reason))}</p>
            ) : null}
            <Button type="submit" disabled={phase === "loading"} aria-busy={phase === "loading"}>
              {phase === "loading" ? t("Checking the access code…") : t("Continue")}
            </Button>
          </form>
          <div className="card card-pad stack">
            <h3>{t("Scan QR Code")}</h3>
            <p>{t("If your family card has a QR code, you can scan it on the next screen.")}</p>
            <Button variant="secondary" to="/access?method=qr">{t("Scan QR Code")}</Button>
          </div>
        </div>
      </section>

      <section className="wrap section" id="how-it-works" tabIndex={-1}>
        <h2>{t("How It Works")}</h2>
        <p className="lede">{t("Three calm steps. No account is required for a family visit.")}</p>
        <div className="step-grid" style={{ marginTop: 16 }}>
          <article className="card step-card">
            <div className="step-num">1</div>
            <div>
              <h3>{t("Enter your code")}</h3>
              <p>{t("Enter your family access code or scan your QR code.")}</p>
            </div>
          </article>
          <article className="card step-card">
            <div className="step-num">2</div>
            <div>
              <h3>{t("View the memorial")}</h3>
              <p>{t("View your loved one's memorial information.")}</p>
            </div>
          </article>
          <article className="card step-card">
            <div className="step-num">3</div>
            <div>
              <h3>{t("Follow the map")}</h3>
              <p>{t("Follow the cemetery map to their resting place.")}</p>
            </div>
          </article>
        </div>
      </section>

      <section className="wrap section" id="about" tabIndex={-1}>
        <div className="card card-pad stack">
          <h2>{t("About GRAVELOC")}</h2>
          <p>
            {t("{name} uses GRAVELOC so families can find a resting place without wandering the grounds. The same records help staff keep plots, access codes, and registrations in one place.", { name: db.cemetery.name })}
          </p>
          <p>{db.cemetery.description}</p>
        </div>
      </section>

      <section className="wrap section" id="assistance" tabIndex={-1}>
        <div className="grid-2">
          <article className="card card-pad stack">
            <h2>{t("Visitor assistance")}</h2>
            <p>{t("The cemetery office can replace a lost card or check an access code for you.")}</p>
            <p><a href={`tel:${db.cemetery.phone.replace(/\s/g, "")}`}>{db.cemetery.phone}</a></p>
            <p><a href={`mailto:${db.cemetery.email}`}>{db.cemetery.email}</a></p>
            <p>{db.cemetery.hours}</p>
            <p>{db.cemetery.address}, {db.cemetery.city}</p>
          </article>
          <article className="card card-pad stack" id="privacy" tabIndex={-1}>
            <h2>{t("Privacy")}</h2>
            <p>{t("Memorial pages open only after a valid family access code. There is no public search by name.")}</p>
            <p>{t("Staff can revoke a code at any time. A code is separate from the permanent record number.")}</p>
            <p>{t("This demonstration keeps changes in this browser. It is not a production database.")}</p>
          </article>
        </div>
      </section>
      </>
  );
}
