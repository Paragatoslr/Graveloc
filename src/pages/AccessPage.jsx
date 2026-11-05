import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { accessErrorText, fullName, normalizeAccessCode } from "../lib/records";
import { wait } from "../lib/format";
import { Button, PageHeading } from "../components/ui";

const SAMPLES = [
  { code: "GRV-8K29-XP41", name: "Maria Santos", state: "Active" },
  { code: "GRV-2M61-VB90", name: "Carmen Dela Cruz", state: "Expired" },
  { code: "GRV-4H88-PS62", name: "Liza Marie Navarro", state: "Revoked" },
];

export function AccessPage() {
  const { t } = useI18n();
  const { db, verifyAndEnter } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialMethod = params.get("method") === "qr" ? "qr" : "code";
  const [method, setMethod] = useState(initialMethod);
  const [code, setCode] = useState(normalizeAccessCode(params.get("code") || ""));
  const [phase, setPhase] = useState("idle");
  const [reason, setReason] = useState("");
  const [record, setRecord] = useState(null);
  const [scanning, setScanning] = useState(false);

  const message = useMemo(() => (reason ? t(accessErrorText(reason)) : ""), [reason, t]);

  async function verify(nextCode) {
    setPhase("loading");
    setReason("");
    setRecord(null);
    await wait(700);
    let result;
    try {
      result = verifyAndEnter(nextCode);
    } catch {
      result = { ok: false, reason: "storage" };
    }
    if (!result.ok) {
      setPhase("error");
      setReason(result.reason);
      return;
    }
    setRecord(result.record);
    setPhase("success");
    navigate(`/memorial/${result.record.id}`);
  }

  const codeParam = params.get("code") || "";
  useEffect(() => {
    const next = normalizeAccessCode(codeParam);
    if (!next) return;
    setCode(next);
    verify(next);
    // Verify when a code arrives in the address. verify is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  async function startScan() {
    setScanning(true);
    setPhase("idle");
    setReason("");
    await wait(900);
    setScanning(false);
    setPhase("choose-sample");
  }

  return (
    <section className="wrap page">
      <div className="narrow stack-lg">
        <PageHeading
          title={t("Let's Find Your Loved One")}
          lede={t("Use the access code or QR code from your family card. The cemetery office can help if the card is missing.")}
        />
        <div className="tabs" role="tablist" aria-label={t("Access method")}>
          <button type="button" role="tab" aria-selected={method === "code"} onClick={() => setMethod("code")}>
            {t("Enter Access Code")}
          </button>
          <button type="button" role="tab" aria-selected={method === "qr"} onClick={() => setMethod("qr")}>
            {t("Scan QR Code")}
          </button>
        </div>

        {method === "code" ? (
          <form
            className="card card-pad stack"
            onSubmit={(event) => {
              event.preventDefault();
              verify(code);
            }}
          >
            <label htmlFor="access-code">{t("Family access code")}</label>
            <input
              id="access-code"
              value={code}
              placeholder="GRV-8K29-XP41"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck="false"
              aria-invalid={phase === "error"}
              aria-describedby="code-help code-error"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <p id="code-help" className="hint">
              {t("Families receive this code from {name}. It is not the same as the record number.", { name: db.cemetery.name })}
            </p>
            {phase === "error" ? <p id="code-error" className="form-alert" role="alert">{message}</p> : null}
            <Button type="submit" disabled={phase === "loading"} aria-busy={phase === "loading"}>
              {phase === "loading" ? t("Checking the access code…") : t("Verify Access")}
            </Button>
          </form>
        ) : (
          <div className="card card-pad stack">
            <div className="scanner" aria-live="polite">
              {scanning ? <span className="scanline" /> : null}
              <div>
                <h2>{scanning ? t("Looking at the sample card…") : t("QR scanner")}</h2>
                <p>{t("This prototype simulates a camera. It does not use your real camera.")}</p>
              </div>
            </div>
            <Button onClick={startScan} disabled={scanning}>
              {scanning ? t("Scanning…") : t("Start Scanning")}
            </Button>
            {phase === "choose-sample" ? (
              <div className="sample-list">
                <p>{t("Tap a sample card to finish the simulated scan.")}</p>
                {SAMPLES.map((sample) => (
                  <Button
                    key={sample.code}
                    variant="secondary"
                    onClick={() => {
                      setCode(sample.code);
                      verify(sample.code);
                    }}
                  >
                    {t("Scan {name}", { name: sample.name })}
                  </Button>
                ))}
              </div>
            ) : null}
            {phase === "error" ? <p className="form-alert" role="alert">{message}</p> : null}
            <Button variant="ghost" onClick={() => setMethod("code")}>{t("Enter a code instead")}</Button>
          </div>
        )}

        {phase === "success" && record ? (
          <div className="success-banner stack" role="status">
            <h2>{t("Access verified")}</h2>
            <p>{t("You can view the memorial for {name}.", { name: fullName(record) })}</p>
            <Button onClick={() => navigate(`/memorial/${record.id}`)}>{t("Continue to memorial")}</Button>
          </div>
        ) : null}

        <div className="card card-pad stack">
          <h2>{t("Prototype samples")}</h2>
          <p>{t("These fictional codes demonstrate a valid visit, an expired code, and a revoked code.")}</p>
          <div className="sample-list">
            {SAMPLES.map((sample) => (
              <Button
                key={sample.code}
                variant="secondary"
                onClick={() => {
                  setMethod("code");
                  setCode(sample.code);
                }}
              >
                {sample.code} · {t(sample.state)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
