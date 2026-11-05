import { useState } from "react";
import { useAdminTitle } from "../components/AdminShell";
import { Badge, Button, ConfirmDialog, statusTone, useToast } from "../components/ui";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { fullName, maskCode } from "../lib/records";
import { formatDate } from "../lib/format";

export function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { db, can, currentStaff, updateCemetery, updateSettings, updateAccount, revokeCredential, resetDemo } = useApp();
  const toast = useToast();
  const [cemetery, setCemetery] = useState(db.cemetery);
  const [settings, setSettings] = useState(db.settings);
  const [account, setAccount] = useState({ name: currentStaff?.name || "", email: currentStaff?.email || "" });
  const [saved, setSaved] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  useAdminTitle(t("Settings"));

  function cemeterySave(event) {
    event.preventDefault();
    if (!cemetery.name.trim() || !cemetery.address.trim() || !cemetery.phone.trim()) {
      toast(t("Enter the cemetery name, address, and phone."), "error");
      return;
    }
    updateCemetery({
      name: cemetery.name.trim(),
      address: cemetery.address.trim(),
      city: cemetery.city.trim(),
      phone: cemetery.phone.trim(),
      email: cemetery.email.trim(),
      hours: cemetery.hours.trim(),
      description: cemetery.description.trim(),
    });
    setSaved("cemetery");
    toast(t("Cemetery information saved."));
  }

  return (
    <div className="stack-lg">
      {can("settings.cemetery") ? (
        <form className="card form-section" onSubmit={cemeterySave}>
          <h2>{t("Cemetery information")}</h2>
          <label htmlFor="cem-name">{t("Cemetery name")}</label>
          <input id="cem-name" value={cemetery.name} onChange={(event) => setCemetery({ ...cemetery, name: event.target.value })} />
          <label htmlFor="cem-address">{t("Address")}</label>
          <input id="cem-address" value={cemetery.address} onChange={(event) => setCemetery({ ...cemetery, address: event.target.value })} />
          <label htmlFor="cem-city">{t("City")}</label>
          <input id="cem-city" value={cemetery.city} onChange={(event) => setCemetery({ ...cemetery, city: event.target.value })} />
          <label htmlFor="cem-phone">{t("Phone")}</label>
          <input id="cem-phone" value={cemetery.phone} onChange={(event) => setCemetery({ ...cemetery, phone: event.target.value })} />
          <label htmlFor="cem-email">{t("Email")}</label>
          <input id="cem-email" type="email" value={cemetery.email} onChange={(event) => setCemetery({ ...cemetery, email: event.target.value })} />
          <label htmlFor="cem-hours">{t("Visiting hours")}</label>
          <input id="cem-hours" value={cemetery.hours} onChange={(event) => setCemetery({ ...cemetery, hours: event.target.value })} />
          <label htmlFor="cem-about">{t("Short description")}</label>
          <textarea id="cem-about" value={cemetery.description} onChange={(event) => setCemetery({ ...cemetery, description: event.target.value })} />
          <Button type="submit">{t("Save cemetery information")}</Button>
          {saved === "cemetery" ? <p className="success-banner" role="status">{t("Cemetery information saved.")}</p> : null}
        </form>
      ) : null}

      {can("settings.preferences") ? (
        <form
          className="card form-section"
          onSubmit={(event) => {
            event.preventDefault();
            updateSettings({
              pageSize: Number(settings.pageSize) || 6,
              showPlotNumbers: Boolean(settings.showPlotNumbers),
            });
            setSaved("preferences");
            toast(t("Preferences saved."));
          }}
        >
          <h2>{t("General preferences")}</h2>
          <label htmlFor="page-size">{t("Records per page")}</label>
          <select id="page-size" value={settings.pageSize} onChange={(event) => setSettings({ ...settings, pageSize: Number(event.target.value) })}>
            <option value={6}>6</option>
            <option value={8}>8</option>
            <option value={12}>12</option>
          </select>
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(settings.showPlotNumbers)}
              onChange={(event) => setSettings({ ...settings, showPlotNumbers: event.target.checked })}
            />
            {t("Show lot numbers when the map is zoomed in")}
          </label>
          <Button type="submit">{t("Save preferences")}</Button>
          {saved === "preferences" ? <p className="success-banner" role="status">{t("Preferences saved.")}</p> : null}
        </form>
      ) : null}

      <form
        className="card form-section"
        onSubmit={(event) => {
          event.preventDefault();
          setLang(settings.language || lang);
          setSaved("language");
          toast(t("Language saved on this browser."));
        }}
      >
        <h2>{t("Language settings")}</h2>
        <label htmlFor="language">{t("Language")}</label>
        <select
          id="language"
          value={lang}
          onChange={(event) => {
            setLang(event.target.value);
            setSettings({ ...settings, language: event.target.value });
          }}
        >
          <option value="en">English</option>
          <option value="fil">Filipino</option>
        </select>
        <p className="hint">{t("The language control in the header changes the interface immediately.")}</p>
        {saved === "language" ? <p className="success-banner" role="status">{t("Language saved on this browser.")}</p> : null}
      </form>

      <form
        className="card form-section"
        onSubmit={(event) => {
          event.preventDefault();
          const result = updateAccount(account);
          if (!result.ok) {
            toast(t(result.errors?.name || result.errors?.email || result.error), "error");
            return;
          }
          setSaved("account");
          toast(t("Account settings saved."));
        }}
      >
        <h2>{t("Account settings")}</h2>
        <label htmlFor="account-name">{t("Your name")}</label>
        <input id="account-name" value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} />
        <label htmlFor="account-email">{t("Email")}</label>
        <input id="account-email" type="email" value={account.email} onChange={(event) => setAccount({ ...account, email: event.target.value })} />
        <Button type="submit">{t("Save account settings")}</Button>
        {saved === "account" ? <p className="success-banner" role="status">{t("Account settings saved.")}</p> : null}
      </form>

      {can("settings.security") ? (
        <form
          className="card form-section"
          onSubmit={(event) => {
            event.preventDefault();
            updateSettings({
              sessionHours: Number(settings.sessionHours) || 8,
              staffCanRegenerateCodes: Boolean(settings.staffCanRegenerateCodes),
            });
            setSaved("security");
            toast(t("Security preferences saved."));
          }}
        >
          <h2>{t("Security preferences")}</h2>
          <label htmlFor="session-hours">{t("Suggested session length")}</label>
          <select id="session-hours" value={settings.sessionHours} onChange={(event) => setSettings({ ...settings, sessionHours: Number(event.target.value) })}>
            <option value={4}>{t("{count} hours", { count: 4 })}</option>
            <option value={8}>{t("{count} hours", { count: 8 })}</option>
            <option value={12}>{t("{count} hours", { count: 12 })}</option>
          </select>
          <p className="hint">{t("Saved for this prototype. Automatic sign-out is not enforced.")}</p>
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(settings.staffCanRegenerateCodes)}
              onChange={(event) => setSettings({ ...settings, staffCanRegenerateCodes: event.target.checked })}
            />
            {t("Allow cemetery staff to generate new family access codes")}
          </label>
          <Button type="submit">{t("Save security preferences")}</Button>
          {saved === "security" ? <p className="success-banner" role="status">{t("Security preferences saved.")}</p> : null}
        </form>
      ) : null}

      {can("settings.codes") ? (
        <form
          className="card form-section"
          onSubmit={(event) => {
            event.preventDefault();
            const prefix = settings.codePrefix.trim().toUpperCase();
            if (!/^[A-Z0-9]{2,6}$/.test(prefix)) {
              toast(t("Use 2 to 6 letters or numbers for the code prefix."), "error");
              return;
            }
            updateSettings({ codePrefix: prefix, codeExpiryMonths: Number(settings.codeExpiryMonths) || 12 });
            setSaved("codes");
            toast(t("Access code settings saved."));
          }}
        >
          <h2>{t("Access code management")}</h2>
          <label htmlFor="prefix">{t("Code prefix")}</label>
          <input id="prefix" value={settings.codePrefix} onChange={(event) => setSettings({ ...settings, codePrefix: event.target.value.toUpperCase() })} />
          <label htmlFor="expiry">{t("Months before a new code expires")}</label>
          <input id="expiry" type="number" min="1" max="60" value={settings.codeExpiryMonths} onChange={(event) => setSettings({ ...settings, codeExpiryMonths: Number(event.target.value) })} />
          <Button type="submit">{t("Save access code settings")}</Button>
          {saved === "codes" ? <p className="success-banner" role="status">{t("Access code settings saved.")}</p> : null}
          <div className="stack">
            {db.credentials.slice(0, 8).map((credential) => {
              const record = db.records.find((item) => item.id === credential.recordId);
              return (
                <article key={credential.id} className="spread">
                  <div>
                    <strong>{can("access.viewFull") ? credential.code : maskCode(credential.code)}</strong>
                    <p className="muted">{record ? fullName(record) : credential.recordId} · {formatDate(credential.expiresAt, lang)}</p>
                  </div>
                  <Badge tone={statusTone(credential.status)}>{t(credential.status === "active" ? "Active" : credential.status === "expired" ? "Expired" : "Revoked")}</Badge>
                  {credential.status === "active" && can("access.revoke") ? (
                    <Button variant="danger" onClick={() => revokeCredential(credential.id)}>{t("Revoke")}</Button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </form>
      ) : null}

      {can("settings.security") ? (
        <section className="card form-section">
          <h2>{t("Demonstration data")}</h2>
          <p>{t("Restore the original sample records. Changes saved in this browser will be cleared.")}</p>
          <Button variant="danger" onClick={() => setResetOpen(true)}>{t("Reset demonstration data")}</Button>
        </section>
      ) : null}
      <ConfirmDialog
        open={resetOpen}
        title={t("Reset demonstration data?")}
        message={t("Records, plots, staff changes, and settings saved in this browser will return to the original sample.")}
        confirmLabel={t("Reset demonstration data")}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          resetDemo();
          setResetOpen(false);
          toast(t("Demonstration data restored."));
        }}
      />
    </div>
  );
}
