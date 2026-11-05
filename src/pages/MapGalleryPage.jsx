import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ActionMenu } from "../components/ActionMenu";
import { useAdminTitle } from "../components/AdminShell";
import { Badge, Button, EmptyState, Modal, SearchField, useToast } from "../components/ui";
import { activeMaps, mapStats, primaryMapId } from "../data/mapModel";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { formatWhen } from "../lib/format";

const MAP_TYPES = [
  ["main", "Main Cemetery"],
  ["extension", "Land Extension"],
  ["burial", "Additional Burial Area"],
  ["garden", "Memorial Garden"],
  ["other", "Other"],
];

export function MapGalleryPage() {
  const { t, lang } = useI18n();
  const { db, can, createMap, duplicateMap, deleteMap } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  useAdminTitle(t("Map Gallery"));

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteMode, setDeleteMode] = useState("preserve-records");
  const [form, setForm] = useState({ name: "", description: "", mapType: "main" });

  const maps = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = activeMaps(db).filter((map) => {
      if (statusFilter && map.status !== statusFilter) return false;
      if (!q) return true;
      return map.name.toLowerCase().includes(q) || map.id.toLowerCase().includes(q);
    });
    list = list.slice().sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return list;
  }, [db, query, sort, statusFilter]);

  if (!can("map.view")) {
    return <p className="warn-banner">{t("Your role cannot view cemetery maps.")}</p>;
  }

  function statusTone(status) {
    if (status === "published") return "success";
    return "neutral";
  }

  return (
    <div className="stack">
      <div className="spread">
        <p className="lede">{t("Create, publish, and manage multiple cemetery maps for extensions, gardens, and additional burial areas.")}</p>
        {can("map.edit") ? (
          <Button onClick={() => setCreateOpen(true)}>{t("Create New Map")}</Button>
        ) : null}
      </div>
      <div className="card card-pad row wrap-row">
        <SearchField label={t("Search maps")} value={query} onChange={setQuery} placeholder={t("Map name or ID")} />
        <label>
          {t("Filter by status")}
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">{t("All statuses")}</option>
            <option value="draft">{t("Draft")}</option>
            <option value="published">{t("Published")}</option>
          </select>
        </label>
        <label>
          {t("Sort")}
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="updated">{t("Last updated")}</option>
            <option value="name">{t("Name")}</option>
          </select>
        </label>
        <div className="btn-row" role="group" aria-label={t("Gallery view")}>
          <Button variant={view === "grid" ? "primary" : "secondary"} aria-pressed={view === "grid"} onClick={() => setView("grid")}>
            {t("Grid")}
          </Button>
          <Button variant={view === "list" ? "primary" : "secondary"} aria-pressed={view === "list"} onClick={() => setView("list")}>
            {t("List")}
          </Button>
        </div>
      </div>
      {maps.length === 0 ? (
        <EmptyState title={t("No maps found")} body={t("Create a map to start drawing sections, blocks, and burial plots.")} />
      ) : (
        <div className={view === "grid" ? "map-gallery-grid" : "map-gallery-list stack"}>
          {maps.map((map) => {
            const stats = mapStats(map);
            const sections = stats.sections ? `A–${String.fromCharCode(64 + Math.min(stats.sections, 26))}` : "—";
            return (
              <article key={map.id} className="card card-pad map-gallery-card stack">
                <div className="map-thumb" aria-hidden="true">
                  <span>{stats.plots || 0} {t("plots")}</span>
                </div>
                <div className="spread wrap-row">
                  <div>
                    <h2>{map.name}</h2>
                    <p className="muted">{map.id}</p>
                    <p>{db.cemetery?.name || t("Cemetery")}</p>
                  </div>
                  <Badge tone={statusTone(map.status)}>{map.status === "published" ? t("Published") : t("Draft")}</Badge>
                </div>
                <ul className="map-gallery-meta">
                  <li>{t("Sections")}: {sections} ({stats.sections})</li>
                  <li>{t("Blocks")}: {stats.blocks}</li>
                  <li>{t("Burial plots")}: {stats.plots}</li>
                  <li>{t("Last updated")}: {formatWhen(map.updatedAt, lang)}</li>
                </ul>
                <div className="btn-row">
                  <Button to={`/admin/map/builder/${map.id}`}>{t("Open Map")}</Button>
                  <ActionMenu label={t("Map actions")}>
                    <Link to={`/admin/map/builder/${map.id}`}>{t("Edit Map")}</Link>
                    <Link to={`/admin/map/preview/${map.id}`}>{t("Preview Family View")}</Link>
                    {can("map.edit") ? (
                      <button
                        type="button"
                        onClick={() => {
                          const result = duplicateMap(map.id);
                          toast(result.ok ? t("Map duplicated.") : t(result.error), result.ok ? "success" : "error");
                          if (result.ok) navigate(`/admin/map/builder/${result.map.id}`);
                        }}
                      >
                        {t("Duplicate Map")}
                      </button>
                    ) : null}
                    {can("map.edit") ? (
                      <button type="button" onClick={() => setDeleteTarget(map)}>{t("Delete Map")}</button>
                    ) : null}
                  </ActionMenu>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Modal
        open={createOpen}
        title={t("Create New Map")}
        description={t("Name the map and choose its purpose. You can add a background image in the Map Builder.")}
        onClose={() => setCreateOpen(false)}
      >
        <div className="stack form-stack">
          <label htmlFor="new-map-name">{t("Map Name")}</label>
          <input id="new-map-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          <label htmlFor="new-map-type">{t("Map Type")}</label>
          <select id="new-map-type" value={form.mapType} onChange={(event) => setForm((current) => ({ ...current, mapType: event.target.value }))}>
            {MAP_TYPES.map(([id, label]) => (
              <option key={id} value={id}>{t(label)}</option>
            ))}
          </select>
          <label htmlFor="new-map-desc">{t("Description")}</label>
          <textarea id="new-map-desc" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          <p className="hint">{t("Cemetery")}: {db.cemetery?.name}</p>
          <div className="btn-row">
            <Button
              onClick={() => {
                const result = createMap(form);
                setCreateOpen(false);
                if (!result.ok) {
                  toast(t("The map could not be created."), "error");
                  return;
                }
                navigate(`/admin/map/builder/${result.map.id}`);
              }}
            >
              {t("Create map")}
            </Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>{t("Cancel")}</Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={Boolean(deleteTarget)}
        title={t("Delete this cemetery map?")}
        description={deleteTarget ? t("You are deleting {name}. Choose whether to preserve deceased records.", { name: deleteTarget.name }) : ""}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteMode("preserve-records");
        }}
      >
        {deleteTarget ? (
          <div className="stack">
            <p>{t("Sections")}: {mapStats(deleteTarget).sections} · {t("Blocks")}: {mapStats(deleteTarget).blocks} · {t("Plots")}: {mapStats(deleteTarget).plots}</p>
            <fieldset className="stack">
              <legend>{t("Deletion option")}</legend>
              <label className="check-row">
                <input type="radio" name="delete-mode" checked={deleteMode === "preserve-records"} onChange={() => setDeleteMode("preserve-records")} />
                <span>{t("Option A — Delete map, preserve records (detach plot assignments where needed)")}</span>
              </label>
              <label className="check-row">
                <input type="radio" name="delete-mode" checked={deleteMode === "map-data"} onChange={() => setDeleteMode("map-data")} />
                <span>{t("Option B — Delete map and associated map geometry only (records are never deleted automatically)")}</span>
              </label>
            </fieldset>
            <div className="btn-row">
              <Button
                variant="danger"
                onClick={() => {
                  const result = deleteMap(deleteTarget.id, deleteMode);
                  setDeleteTarget(null);
                  toast(result.ok ? t("Map moved to Trash.") : t(result.error), result.ok ? "success" : "error");
                }}
              >
                {t("Move to Trash")}
              </Button>
              <Button variant="secondary" onClick={() => { setDeleteTarget(null); setDeleteMode("preserve-records"); }}>{t("Cancel")}</Button>
            </div>
          </div>
        ) : null}
      </Modal>
      <p><Link to="/admin/map">{t("Back to cemetery map")}</Link></p>
    </div>
  );
}

export function MapBuilderRedirect() {
  const { db } = useApp();
  return <Navigate to={`/admin/map/builder/${primaryMapId(db)}`} replace />;
}

export function MapPreviewRedirect() {
  const { db } = useApp();
  return <Navigate to={`/admin/map/preview/${primaryMapId(db)}`} replace />;
}
