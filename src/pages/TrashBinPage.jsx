import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminTitle } from "../components/AdminShell";
import { Badge, Button, ConfirmDialog, useToast } from "../components/ui";
import { daysRemaining, mapStats, TRASH_RETENTION_DAYS } from "../data/mapModel";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { formatWhen } from "../lib/format";
import { fullName } from "../lib/records";

export function TrashBinPage() {
  const { t, lang } = useI18n();
  const {
    db,
    can,
    restoreRecordFromTrash,
    permanentDeleteRecord,
    restoreMapFromTrash,
    permanentDeleteMap,
  } = useApp();
  const toast = useToast();
  useAdminTitle(t("Trash Bin"));

  const [tab, setTab] = useState("records");
  const [confirm, setConfirm] = useState(null);

  const staffName = (id) => db.staff.find((person) => person.id === id)?.name || t("Unknown");

  const recordRows = useMemo(() => db.trash?.records || [], [db.trash]);
  const mapRows = useMemo(() => db.trash?.maps || [], [db.trash]);

  if (!can("records.view") && !can("map.view")) {
    return <p className="warn-banner">{t("Your role cannot open the Trash Bin.")}</p>;
  }

  return (
    <div className="stack">
      <p className="lede">
        {t("Recover deleted records and maps within {days} days. After that, items are permanently removed when the application loads.", {
          days: TRASH_RETENTION_DAYS,
        })}
      </p>
      <div className="btn-row" role="tablist" aria-label={t("Trash categories")}>
        <Button variant={tab === "records" ? "primary" : "secondary"} role="tab" aria-selected={tab === "records"} onClick={() => setTab("records")}>
          {t("Deleted Records")} ({recordRows.length})
        </Button>
        <Button variant={tab === "maps" ? "primary" : "secondary"} role="tab" aria-selected={tab === "maps"} onClick={() => setTab("maps")}>
          {t("Deleted Maps")} ({mapRows.length})
        </Button>
      </div>
      {tab === "records" ? (
        <div className="card card-pad stack">
          {recordRows.length === 0 ? <p>{t("No deleted records.")}</p> : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("Record ID")}</th>
                  <th>{t("Name")}</th>
                  <th>{t("Date Deleted")}</th>
                  <th>{t("Deleted By")}</th>
                  <th>{t("Retention")}</th>
                  <th>{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {recordRows.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.id}</td>
                    <td>{fullName(entry.record)}</td>
                    <td>{formatWhen(entry.deletedAt, lang)}</td>
                    <td>{staffName(entry.deletedBy)}</td>
                    <td>
                      <Badge tone="warning">{t("{days} days remaining", { days: daysRemaining(entry.deletedAt) })}</Badge>
                    </td>
                    <td className="btn-row">
                      {can("records.edit") ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const ok = window.confirm(t("Reactivate family access codes for this record if they are still valid?"));
                            const result = restoreRecordFromTrash(entry.id, ok);
                            toast(result.ok ? t("Record restored.") : t(result.error), result.ok ? "success" : "error");
                          }}
                        >
                          {t("Restore")}
                        </Button>
                      ) : null}
                      {can("records.edit") ? (
                        <Button variant="danger" onClick={() => setConfirm({ type: "record", id: entry.id, name: fullName(entry.record) })}>
                          {t("Permanently Delete")}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card card-pad stack">
          {mapRows.length === 0 ? <p>{t("No deleted maps.")}</p> : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("Map")}</th>
                  <th>{t("Date Deleted")}</th>
                  <th>{t("Deleted By")}</th>
                  <th>{t("Elements")}</th>
                  <th>{t("Retention")}</th>
                  <th>{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {mapRows.map((entry) => {
                  const stats = entry.stats || mapStats(entry.map);
                  const total = stats.elements ?? stats.sections + stats.blocks + stats.plots;
                  return (
                    <tr key={entry.id}>
                      <td>{entry.map.name}<br /><span className="muted">{entry.id}</span></td>
                      <td>{formatWhen(entry.deletedAt, lang)}</td>
                      <td>{staffName(entry.deletedBy)}</td>
                      <td>{total}</td>
                      <td>
                        <Badge tone="warning">{t("{days} days remaining", { days: daysRemaining(entry.deletedAt) })}</Badge>
                      </td>
                      <td className="btn-row">
                        {can("map.edit") ? (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const result = restoreMapFromTrash(entry.id);
                              toast(result.ok ? t("Map restored.") : t(result.error), result.ok ? "success" : "error");
                            }}
                          >
                            {t("Restore Map")}
                          </Button>
                        ) : null}
                        {can("map.edit") ? (
                          <Button variant="danger" onClick={() => setConfirm({ type: "map", id: entry.id, name: entry.map.name })}>
                            {t("Permanently Delete")}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm?.type === "record"}
        title={t("Permanently delete this record?")}
        message={t("This action cannot be undone. The record for {name} will be removed from the Trash Bin.", { name: confirm?.name || "" })}
        confirmLabel={t("Permanently delete")}
        tone="danger"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const result = permanentDeleteRecord(confirm.id);
          setConfirm(null);
          toast(result.ok ? t("Record permanently deleted.") : t(result.error), result.ok ? "success" : "error");
        }}
      />
      <ConfirmDialog
        open={confirm?.type === "map"}
        title={t("Permanently delete this map?")}
        message={t("This action cannot be undone. Map geometry for {name} will be removed.", { name: confirm?.name || "" })}
        confirmLabel={t("Permanently delete")}
        tone="danger"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const result = permanentDeleteMap(confirm.id);
          setConfirm(null);
          toast(result.ok ? t("Map permanently deleted.") : t(result.error), result.ok ? "success" : "error");
        }}
      />
      <p className="hint">{t("Automatic purge runs on each application load (prototype). Deploy a server scheduled job for production retention.")}</p>
      <p><Link to="/admin/dashboard">{t("Back to overview")}</Link></p>
    </div>
  );
}
