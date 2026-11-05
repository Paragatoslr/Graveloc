import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminTitle } from "../components/AdminShell";
import { Button, Pagination, SearchField } from "../components/ui";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { formatWhen } from "../lib/format";
import { activityText } from "../lib/records";

const PAGE_SIZE = 30;

export function ActivityHistoryPage() {
  const { t, lang } = useI18n();
  const { db } = useApp();
  useAdminTitle(t("Activity History"));

  const [typeFilter, setTypeFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const types = useMemo(() => [...new Set(db.activity.map((entry) => entry.type))].sort(), [db.activity]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.activity.filter((entry) => {
      if (typeFilter && entry.type !== typeFilter) return false;
      if (staffFilter && entry.actorId !== staffFilter) return false;
      if (dateFilter && !entry.at.startsWith(dateFilter)) return false;
      if (!q) return true;
      const text = activityText(entry, (key, params) => t(key, params)).toLowerCase();
      return text.includes(q) || entry.type.includes(q);
    });
  }, [db.activity, typeFilter, staffFilter, dateFilter, query, t]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="stack">
      <p className="lede">{t("Audit trail of administrative actions. Entries are read-only.")}</p>
      <div className="card card-pad row wrap-row">
        <SearchField label={t("Search")} value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder={t("Activity description")} />
        <label>
          {t("Activity type")}
          <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}>
            <option value="">{t("All types")}</option>
            {types.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          {t("Staff member")}
          <select value={staffFilter} onChange={(event) => { setStaffFilter(event.target.value); setPage(1); }}>
            <option value="">{t("All staff")}</option>
            {db.staff.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </label>
        <label>
          {t("Date")}
          <input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1); }} />
        </label>
      </div>
      <div className="card card-pad stack">
        {visible.length === 0 ? <p>{t("No activities match these filters.")}</p> : null}
        {visible.map((entry) => {
          const actor = db.staff.find((person) => person.id === entry.actorId);
          return (
            <article key={entry.id} className="activity-row">
              <p><strong>{entry.type}</strong> — {activityText(entry, t)}</p>
              <p className="muted">
                {actor?.name || t("System")} · {formatWhen(entry.at, lang)}
                {entry.params?.name ? ` · ${entry.params.name}` : ""}
              </p>
            </article>
          );
        })}
        <Pagination page={current} pageCount={pageCount} onPage={setPage} />
      </div>
      <Button variant="ghost" to="/admin/dashboard">{t("Back to overview")}</Button>
    </div>
  );
}
