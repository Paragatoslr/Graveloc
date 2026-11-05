import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAdminTitle } from "../components/AdminShell";
import { AccessQR } from "../components/AccessQR";
import { RecordForm } from "../components/RecordForm";
import { Badge, Breadcrumb, Button, ConfirmDialog, statusTone, useToast } from "../components/ui";
import { recordToForm } from "../data/seed";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { burialLabel, fullName, maskCode, RECORD_STATUSES } from "../lib/records";
import { copyText, formatDate, wait } from "../lib/format";

function statusLabel(status) {
  return RECORD_STATUSES.find((item) => item.id === status)?.label || status;
}

export function RecordDetailPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const { db, can, updateRecord, revokeCredential, regenerateCredential } = useApp();
  const toast = useToast();
  const [params] = useSearchParams();
  const record = db.records.find((item) => item.id === id);
  const [editing, setEditing] = useState(params.get("mode") === "edit");
  const [confirm, setConfirm] = useState(null);
  const [issued, setIssued] = useState(null);
  useAdminTitle(record ? fullName(record) : t("Record details"));

  if (!record) {
    return (
      <div className="stack">
        <h2>{t("Record not found")}</h2>
        <Button to="/admin/records">{t("Return to records")}</Button>
      </div>
    );
  }

  const plot = db.plots.find((item) => item.id === record.plotId);
  const block = db.blocks.find((item) => item.id === plot?.blockId);
  const section = db.sections.find((item) => item.id === plot?.sectionId);
  const credentials = db.credentials.filter((item) => item.recordId === record.id);
  const showAccess = params.get("panel") === "access" || true;

  async function onSubmit(values) {
    await wait(500);
    const response = updateRecord(record.id, values);
    if (!response.ok) {
      toast(response.errors?.form ? t(response.errors.form) : t("The record could not be saved."), "error");
      return;
    }
    setEditing(false);
    toast(t("Record updated."));
  }

  return (
    <div className="stack">
      <Breadcrumb
        items={[
          { label: t("Records"), to: "/admin/records" },
          { label: fullName(record) },
        ]}
      />
      <div className="spread">
        <Badge tone={statusTone(record.status)}>{t(statusLabel(record.status))}</Badge>
        <div className="btn-row">
          {can("records.edit") ? (
            <Button variant="secondary" onClick={() => setEditing((value) => !value)}>
              {editing ? t("Close editor") : t("Edit record")}
            </Button>
          ) : null}
          <Button variant="ghost" to={`/admin/map?plot=${plot?.id || ""}`}>{t("View on cemetery map")}</Button>
        </div>
      </div>

      {editing ? (
        <RecordForm
          key={`${record.id}-${record.updatedAt}`}
          initial={recordToForm(record, db)}
          editingId={record.id}
          showStatus
          submitLabel={t("Save changes")}
          onSubmit={onSubmit}
        />
      ) : (
        <article className="card card-pad stack">
          <div className="profile">
            {record.photo ? (
              <img className="avatar-img" src={record.photo} alt="" />
            ) : (
              <div className="avatar" aria-hidden="true">{record.firstName[0]}{record.lastName[0]}</div>
            )}
            <div>
              <h2>{fullName(record)}</h2>
              <p>{record.id}</p>
            </div>
          </div>
          <dl className="dl">
            <div><dt>{t("Date of birth")}</dt><dd>{formatDate(record.birthDate, lang)}</dd></div>
            <div><dt>{t("Date of passing")}</dt><dd>{formatDate(record.passingDate, lang)}</dd></div>
            <div><dt>{t("Burial date")}</dt><dd>{formatDate(record.burialDate, lang)}</dd></div>
            <div><dt>{t("Burial type")}</dt><dd>{t(burialLabel(record.burialType))}</dd></div>
            <div><dt>{t("Cemetery")}</dt><dd>{db.cemetery.name}</dd></div>
            <div><dt>{t("Section")}</dt><dd>{section?.name}</dd></div>
            <div><dt>{t("Block")}</dt><dd>{block?.label}</dd></div>
            <div><dt>{t("Lot number")}</dt><dd>{plot?.lot}</dd></div>
          </dl>
        </article>
      )}

      {showAccess ? (
        <section className="card card-pad stack" id="access">
          <h2>{t("Family access")}</h2>
          <p>{t("The access code is separate from the permanent record number and can be revoked.")}</p>
          {credentials.map((credential) => {
            const visibleCode = can("access.viewFull") ? credential.code : maskCode(credential.code);
            return (
              <article key={credential.id} className="stack">
                <div className="spread">
                  <strong>{visibleCode}</strong>
                  <Badge tone={statusTone(credential.status)}>{t(credential.status === "active" ? "Active" : credential.status === "expired" ? "Expired" : "Revoked")}</Badge>
                </div>
                <p className="muted">
                  {t("Issued {date}", { date: formatDate(credential.issuedAt, lang) })}
                  {" · "}
                  {t("Expires {date}", { date: formatDate(credential.expiresAt, lang) })}
                </p>
                {can("access.viewFull") && credential.status === "active" ? (
                  <AccessQR value={credential.code} label={t("QR code for the family access code")} />
                ) : null}
                {credential.status === "active" && can("access.revoke") ? (
                  <Button variant="danger" onClick={() => setConfirm({ type: "revoke", credential })}>
                    {t("Revoke access code")}
                  </Button>
                ) : null}
              </article>
            );
          })}
          {can("access.regenerate") ? (
            <Button onClick={() => setConfirm({ type: "issue" })}>{t("Generate a new access code")}</Button>
          ) : (
            <p className="hint">{t("Your role can see that a code exists, but only an administrator can reveal or replace it.")}</p>
          )}
          {issued ? (
            <div className="success-banner stack" role="status">
              <p>{t("New access code")}: <strong>{issued.code}</strong></p>
              <Button
                variant="secondary"
                onClick={async () => {
                  const ok = await copyText(issued.code);
                  toast(ok ? t("Access code copied.") : t("Copy the code manually."), ok ? "success" : "error");
                }}
              >
                {t("Copy access code")}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <Link to="/admin/records">{t("Return to records")}</Link>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.type === "revoke" ? t("Revoke this access code?") : t("Generate a new access code?")}
        message={
          confirm?.type === "revoke"
            ? t("The family will no longer be able to open this memorial with the current code.")
            : t("The current active code will be revoked and replaced with a new one.")
        }
        confirmLabel={confirm?.type === "revoke" ? t("Revoke access code") : t("Generate code")}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const response = confirm?.type === "revoke"
            ? revokeCredential(confirm.credential.id)
            : regenerateCredential(record.id);
          setConfirm(null);
          if (!response.ok) {
            toast(t(response.error), "error");
            return;
          }
          if (response.credential) setIssued(response.credential);
          toast(confirm?.type === "revoke" ? t("Access code revoked.") : t("A new access code is ready."));
        }}
      />
    </div>
  );
}
