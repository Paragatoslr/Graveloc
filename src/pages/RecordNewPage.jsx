import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdminTitle } from "../components/AdminShell";
import { AccessQR } from "../components/AccessQR";
import { RecordForm } from "../components/RecordForm";
import { Breadcrumb, Button } from "../components/ui";
import { useToast } from "../components/ui";
import { emptyRecord } from "../data/seed";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { fullName } from "../lib/records";
import { copyText, wait } from "../lib/format";

export function RecordNewPage() {
  const { t } = useI18n();
  const { db, can, createRecord } = useApp();
  const toast = useToast();
  const [params] = useSearchParams();
  const [result, setResult] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  useAdminTitle(t("Register an individual"));

  const initial = useMemo(() => {
    const base = emptyRecord(db.cemetery.id);
    const sectionId = params.get("section") || "";
    const blockId = params.get("block") || "";
    const lot = params.get("lot") || "";
    return { ...base, sectionId, blockId, lot };
  }, [db.cemetery.id, params]);

  if (!can("records.create")) {
    return <p className="warn-banner">{t("Your role cannot register records.")}</p>;
  }

  async function onSubmit(values) {
    await wait(650);
    const response = createRecord(values);
    if (!response.ok) {
      toast(t("The record could not be saved."), "error");
      return;
    }
    setResult(response);
    toast(t("Registration saved."));
  }

  function printCard() {
    document.body.classList.add("printing-card");
    window.print();
    window.setTimeout(() => document.body.classList.remove("printing-card"), 300);
  }

  if (result) {
    const { record, credential } = result;
    return (
      <div className="stack">
        <Breadcrumb
          items={[
            { label: t("Records"), to: "/admin/records" },
            { label: t("Registration complete") },
          ]}
        />
        <div className="card card-pad stack" id="access-card">
          <p className="success-banner" role="status">{t("The record and family access code are ready.")}</p>
          {result.warning === "storage" ? (
            <p className="warn-banner" role="alert">{t("The record is available in this session, but this browser could not store it permanently. Remove a large photo and save again.")}</p>
          ) : null}
          <h2>{fullName(record)}</h2>
          <p>{t("Record number")}: <strong>{record.id}</strong></p>
          <p>{t("Family access code")}: <strong>{credential.code}</strong></p>
          <AccessQR value={credential.code} label={t("QR code for the family access code")} />
          <p>{db.cemetery.name}</p>
          <p>{t("Enter this code on the GRAVELOC family portal to view the memorial and map. Keep this card private.")}</p>
        </div>
        <div className="btn-row">
          <Button
            onClick={async () => {
              const ok = await copyText(credential.code);
              toast(ok ? t("Access code copied.") : t("Copy the code manually."), ok ? "success" : "error");
            }}
          >
            {t("Copy access code")}
          </Button>
          <Button variant="secondary" onClick={() => setQrOpen(true)}>{t("Preview QR code")}</Button>
          <Button variant="secondary" onClick={printCard}>{t("Print family access card")}</Button>
          <Button variant="ghost" to="/admin/records">{t("Return to records")}</Button>
        </div>
        {qrOpen ? (
          <div className="card card-pad access-card">
            <h2>{t("Family QR code")}</h2>
            <AccessQR value={credential.code} label={t("Large QR code for {code}", { code: credential.code })} />
            <Button variant="ghost" onClick={() => setQrOpen(false)}>{t("Close preview")}</Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="stack">
      <Breadcrumb items={[{ label: t("Records"), to: "/admin/records" }, { label: t("Register an individual") }]} />
      <p className="lede">{t("Save the personal and burial details. A record number and a separate family access code are created after a successful save.")}</p>
      <RecordForm initial={initial} submitLabel={t("Save registration")} onSubmit={onSubmit} />
    </div>
  );
}
