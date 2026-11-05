import { useMemo } from "react";
import { useAdminTitle } from "../components/AdminShell";
import { Badge, Button, statusTone } from "../components/ui";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { activityText, fullName, RECORD_STATUSES } from "../lib/records";
import { formatDate, formatWhen, greeting } from "../lib/format";

function recordStatusLabel(status) {
  return RECORD_STATUSES.find((item) => item.id === status)?.label || status;
}

export function DashboardPage() {
  const { t, lang } = useI18n();
  const { db, currentStaff, can } = useApp();
  useAdminTitle(t("Overview"));

  const stats = useMemo(() => {
    const occupied = db.plots.filter((plot) => plot.status === "occupied").length;
    const available = db.plots.filter((plot) => plot.status === "available").length;
    const reserved = db.plots.filter((plot) => plot.status === "reserved").length;
    const activeCodes = db.credentials.filter(
      (item) => item.status === "active" && new Date(item.expiresAt).getTime() >= Date.now(),
    ).length;
    return [
      [t("Total registered individuals"), db.records.length],
      [t("Occupied burial plots"), occupied],
      [t("Available burial plots"), available],
      [t("Reserved burial plots"), reserved],
      [t("Registered family access codes"), activeCodes],
    ];
  }, [db, t]);

  const parts = [
    { label: t("Occupied"), value: db.plots.filter((plot) => plot.status === "occupied").length, color: "#245B48" },
    { label: t("Available"), value: db.plots.filter((plot) => plot.status === "available").length, color: "#A8B9A5" },
    { label: t("Reserved"), value: db.plots.filter((plot) => plot.status === "reserved").length, color: "#C7A66A" },
  ];
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let used = 0;
  const arcs = parts.map((part) => {
    const length = (part.value / total) * circumference;
    const arc = { ...part, length, gap: circumference - length, offset: used };
    used += length;
    return arc;
  });

  const recent = [...db.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const updated = [...db.records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const sections = db.sections.map((section) => {
    const plots = db.plots.filter((plot) => plot.sectionId === section.id);
    const occupied = plots.filter((plot) => plot.status === "occupied").length;
    return { ...section, occupied, total: plots.length };
  });

  return (
    <div className="stack-lg">
      <div className="spread">
        <p className="lede">{greeting(lang)}, {currentStaff?.name}. {t("Here is the cemetery at a glance.")}</p>
        <div className="btn-row">
          {can("records.create") ? <Button to="/admin/records/new">{t("Register New Individual")}</Button> : null}
          <Button variant="secondary" to="/admin/records">{t("Manage Records")}</Button>
          <Button variant="secondary" to="/admin/map">{t("View Cemetery Map")}</Button>
        </div>
      </div>
      <div className="stat-grid">
        {stats.map(([label, value]) => (
          <article key={label} className="card stat-card">
            <span className="muted">{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="grid-2">
        <section className="card card-pad stack">
          <h2>{t("Recent registrations")}</h2>
          {recent.map((record) => (
            <div key={record.id} className="spread">
              <div>
                <strong>{fullName(record)}</strong>
                <p className="muted">{record.id} · {formatDate(record.passingDate, lang)}</p>
              </div>
              <Badge tone={statusTone(record.status)}>{t(recordStatusLabel(record.status))}</Badge>
            </div>
          ))}
        </section>
        <section className="card card-pad stack">
          <h2>{t("Recently updated records")}</h2>
          {updated.map((record) => (
            <div key={record.id} className="spread">
              <div>
                <strong>{fullName(record)}</strong>
                <p className="muted">{formatWhen(record.updatedAt, lang)}</p>
              </div>
              <Button variant="ghost" to={`/admin/records/${record.id}`}>{t("View details")}</Button>
            </div>
          ))}
        </section>
        <section className="card card-pad stack">
          <h2>{t("Cemetery plot occupancy")}</h2>
          <div className="donut-wrap">
            <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label={t("Plot status chart")}>
              <g transform="rotate(-90 80 80)">
                {arcs.map((arc) => (
                  <circle
                    key={arc.label}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth="18"
                    strokeDasharray={`${arc.length} ${arc.gap}`}
                    strokeDashoffset={-arc.offset}
                  />
                ))}
              </g>
            </svg>
            <ul className="legend-list">
              {parts.map((part) => (
                <li key={part.label}><strong>{part.label}</strong> · {part.value} ({Math.round((part.value / total) * 100)}%)</li>
              ))}
            </ul>
          </div>
          <div className="stack">
            {sections.map((section) => (
              <div key={section.id} className="chart-row">
                <span>{section.name}</span>
                <div className="bar" aria-hidden="true">
                  <span style={{ width: `${section.total ? (section.occupied / section.total) * 100 : 0}%` }} />
                </div>
                <span>{t("{occupied} of {total} occupied", { occupied: section.occupied, total: section.total })}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card card-pad stack">
          <div className="spread wrap-row">
            <h2>{t("Recent administrative activity")}</h2>
            <Button variant="ghost" to="/admin/activity">{t("See more")}</Button>
          </div>
          {db.activity.slice(0, 6).map((entry) => (
            <article key={entry.id}>
              <p>{activityText(entry, t)}</p>
              <p className="muted">{formatWhen(entry.at, lang)}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
