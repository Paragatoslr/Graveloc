import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAdminTitle } from "../components/AdminShell";
import { ActionMenu } from "../components/ActionMenu";
import { Badge, Breadcrumb, Button, ConfirmDialog, EmptyState, Pagination, SearchField, statusTone, useToast } from "../components/ui";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { fullName, RECORD_STATUSES } from "../lib/records";
import { formatDate } from "../lib/format";

function statusLabel(status) {
  return RECORD_STATUSES.find((item) => item.id === status)?.label || status;
}

export function RecordsPage() {
  const { t, lang } = useI18n();
  const { db, can, archiveRecord, moveRecordToTrash } = useApp();
  const toast = useToast();
  const [params] = useSearchParams();
  useAdminTitle(t("Records"));
  const [query, setQuery] = useState(params.get("q") || "");
  const [sectionId, setSectionId] = useState(params.get("section") || "");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    setQuery(params.get("q") || "");
    setPage(1);
  }, [params]);

  useEffect(() => {
    setPage(1);
  }, [query, sectionId, status, sort.key, sort.dir]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = db.records.filter((record) => {
      const plot = db.plots.find((item) => item.id === record.plotId);
      const name = fullName(record).toLowerCase();
      const matchesQuery = !q || name.includes(q) || record.id.toLowerCase().includes(q);
      const matchesSection = !sectionId || plot?.sectionId === sectionId;
      const matchesStatus = !status || record.status === status;
      return matchesQuery && matchesSection && matchesStatus;
    });
    const valueOf = (record) => {
      const plot = db.plots.find((item) => item.id === record.plotId);
      const block = db.blocks.find((item) => item.id === plot?.blockId);
      if (sort.key === "id") return record.id;
      if (sort.key === "passing") return record.passingDate;
      if (sort.key === "section") return plot?.sectionId || "";
      if (sort.key === "block") return block?.label || "";
      if (sort.key === "lot") return plot?.lot || "";
      if (sort.key === "status") return record.status;
      return fullName(record);
    };
    filtered.sort((a, b) => {
      const result = String(valueOf(a)).localeCompare(String(valueOf(b)), undefined, { numeric: true, sensitivity: "base" });
      return sort.dir === "asc" ? result : -result;
    });
    return filtered;
  }, [db, query, sectionId, status, sort]);

  const pageSize = Number(db.settings.pageSize) || 6;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key) {
    setSort((current) => (
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    ));
  }

  function ariaSort(key) {
    if (sort.key !== key) return "none";
    return sort.dir === "asc" ? "ascending" : "descending";
  }

  const columns = [
    ["id", "Record ID"],
    ["name", "Full name"],
    ["passing", "Date of passing"],
    ["section", "Section"],
    ["block", "Block"],
    ["lot", "Lot"],
    ["status", "Record status"],
  ];

  function plotOf(record) {
    return db.plots.find((item) => item.id === record.plotId);
  }

  function Actions({ record }) {
    const plot = plotOf(record);
    return (
      <ActionMenu label={t("Actions")}>
        <Link to={`/admin/records/${record.id}`}>{t("View details")}</Link>
        {can("records.edit") ? <Link to={`/admin/records/${record.id}?mode=edit`}>{t("Edit record")}</Link> : null}
        {can("access.view") ? <Link to={`/admin/records/${record.id}?panel=access`}>{t("Manage access code")}</Link> : null}
        <Link to={`/admin/map?plot=${plot?.id || ""}`}>{t("View on cemetery map")}</Link>
        {can("records.edit") && record.status !== "archived" ? (
          <button type="button" onClick={() => setArchiveTarget(record)}>{t("Archive record")}</button>
        ) : null}
        {can("records.edit") ? (
          <button type="button" onClick={() => setDeleteTarget(record)}>{t("Delete record")}</button>
        ) : null}
      </ActionMenu>
    );
  }

  return (
    <div className="stack">
      <Breadcrumb items={[{ label: t("Overview"), to: "/admin/dashboard" }, { label: t("Records") }]} />
      <div className="spread">
        <p className="lede">{t("Search, filter, and open burial records. Showing {count}.", { count: rows.length })}</p>
        {can("records.create") ? <Button to="/admin/records/new">{t("Add new record")}</Button> : null}
      </div>
      <div className="card card-pad row">
        <SearchField
          id="record-search"
          label={t("Search by name or record ID")}
          value={query}
          placeholder={t("Example: Santos or GRV-2026-0001")}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="field">
          <label htmlFor="section-filter">{t("Section")}</label>
          <select id="section-filter" value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
            <option value="">{t("All sections")}</option>
            {db.sections.map((section) => (
              <option key={section.id} value={section.id}>{section.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="status-filter">{t("Record status")}</label>
          <select id="status-filter" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{t("All statuses")}</option>
            {RECORD_STATUSES.map((item) => (
              <option key={item.id} value={item.id}>{t(item.label)}</option>
            ))}
          </select>
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState
          title={t("No records match")}
          description={t("Try another name, record ID, section, or status.")}
          action={<Button variant="secondary" onClick={() => { setQuery(""); setSectionId(""); setStatus(""); }}>{t("Clear filters")}</Button>}
        />
      ) : (
        <div className="card card-pad stack">
          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">{t("Burial records")}</caption>
              <thead>
                <tr>
                  {columns.map(([key, label]) => (
                    <th key={key} aria-sort={ariaSort(key)}>
                      <button type="button" onClick={() => toggleSort(key)}>{t(label)}</button>
                    </th>
                  ))}
                  <th>{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((record) => {
                  const plot = plotOf(record);
                  const block = db.blocks.find((item) => item.id === plot?.blockId);
                  return (
                    <tr key={record.id}>
                      <td>{record.id}</td>
                      <td>{fullName(record)}</td>
                      <td>{formatDate(record.passingDate, lang)}</td>
                      <td>{plot?.sectionId}</td>
                      <td>{block?.label}</td>
                      <td>{plot?.lot}</td>
                      <td><Badge tone={statusTone(record.status)}>{t(statusLabel(record.status))}</Badge></td>
                      <td><Actions record={record} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="record-cards">
            {visible.map((record) => {
              const plot = plotOf(record);
              const block = db.blocks.find((item) => item.id === plot?.blockId);
              return (
                <article key={record.id} className="card record-card">
                  <strong>{fullName(record)}</strong>
                  <p>{record.id}</p>
                  <p>{formatDate(record.passingDate, lang)}</p>
                  <p>{t("Section {section} — Block {block} — Lot {lot}", { section: plot?.sectionId, block: block?.label, lot: plot?.lot })}</p>
                  <Badge tone={statusTone(record.status)}>{t(statusLabel(record.status))}</Badge>
                  <Actions record={record} />
                </article>
              );
            })}
          </div>
          <Pagination page={currentPage} pageCount={pageCount} onPage={setPage} />
        </div>
      )}
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title={t("Archive this record?")}
        message={t("Family access stops working. The burial plot stays assigned until the record is edited.")}
        confirmLabel={t("Archive record")}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => {
          const result = archiveRecord(archiveTarget.id);
          setArchiveTarget(null);
          toast(result.ok ? t("Record archived.") : t(result.error || "That record could not be found."), result.ok ? "success" : "error");
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("Are you sure you want to delete this record?")}
        message={deleteTarget ? t("{name} · {id}", { name: fullName(deleteTarget), id: deleteTarget.id }) : ""}
        confirmLabel={t("Yes, Move to Trash")}
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          const result = moveRecordToTrash(deleteTarget.id);
          setDeleteTarget(null);
          toast(result.ok ? t("Record moved to Trash.") : t(result.error || "That record could not be found."), result.ok ? "success" : "error");
        }}
      />
    </div>
  );
}
