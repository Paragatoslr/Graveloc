import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAdminTitle } from "../components/AdminShell";
import { CemeteryMap } from "../components/CemeteryMap";
import { Badge, Button, ConfirmDialog, Field, statusTone, useToast } from "../components/ui";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { fullName, PLOT_STATUS_LABEL } from "../lib/records";

export function AdminMapPage() {
  const { t } = useI18n();
  const { db, can, setPlotStatus, updatePlotDetails, addSection, addBlock, addPlots } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [sectionId, setSectionId] = useState(db.sections[0]?.id || "");
  const [blockId, setBlockId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [focusToken, setFocusToken] = useState(1);
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [sectionName, setSectionName] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");
  const [plotCount, setPlotCount] = useState(12);
  const [newStatus, setNewStatus] = useState("available");
  const [confirm, setConfirm] = useState(null);
  useAdminTitle(t("Cemetery Map"));

  const occupantNames = useMemo(() => {
    const map = {};
    db.records.forEach((record) => {
      map[record.plotId] = [...(map[record.plotId] || []), fullName(record)];
    });
    return map;
  }, [db.records]);

  function focusPlot(plot) {
    setSelectedId(plot.id);
    setSectionId(plot.sectionId);
    setBlockId(plot.blockId);
    setNotes(plot.notes || "");
    setCapacity(plot.capacity);
    setFocusToken((value) => value + 1);
  }

  useEffect(() => {
    const requested = params.get("plot");
    if (!requested) return;
    const plot = db.plots.find((item) => item.id === requested);
    if (plot) focusPlot(plot);
    // Focus only when the requested plot id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const blocks = db.blocks.filter((block) => block.sectionId === sectionId);
  const plots = db.plots
    .filter((plot) => plot.blockId === blockId)
    .slice()
    .sort((a, b) => a.lot.localeCompare(b.lot, undefined, { numeric: true }));
  const selected = db.plots.find((plot) => plot.id === selectedId);
  const occupants = db.records.filter((record) => record.plotId === selectedId);
  const canEdit = can("map.edit");
  const matches = query.trim().length < 2
    ? []
    : db.plots.filter((plot) => {
      const people = (occupantNames[plot.id] || []).join(" ").toLowerCase();
      const q = query.trim().toLowerCase();
      return plot.id.toLowerCase().includes(q) || plot.lot.includes(q) || people.includes(q);
    }).slice(0, 8);

  function applyStatus(status) {
    if (!selected) return;
    const result = setPlotStatus(selected.id, status);
    if (result.ok) {
      toast(t("Plot {plot} marked {status}.", { plot: selected.lot, status: t(PLOT_STATUS_LABEL[status]) }));
      return;
    }
    if (result.error === "needs-record") {
      navigate(`/admin/records/new?section=${selected.sectionId}&block=${selected.blockId}&lot=${selected.lot}`);
      return;
    }
    if (result.error === "assigned") {
      setConfirm({ type: "assigned" });
      return;
    }
    toast(t(result.error || "The plot could not be updated."), "error");
  }

  return (
    <div className="stack">
      <div className="spread">
        <p className="lede">{t("Review sections, blocks, and plots on the same illustrated plan families use.")}</p>
        <div className="btn-row">
          {canEdit ? <Button to="/admin/map/gallery">{t("Map Gallery")}</Button> : null}
          {canEdit ? <Button to="/admin/map/builder">{t("Cemetery Map Builder")}</Button> : null}
        </div>
      </div>
      {!canEdit ? <p className="info-banner">{t("Your role can view the map. A cemetery administrator changes plot status and layout.")}</p> : null}
      <div className="map-layout">
        <div className="stack">
          <form
            className="row"
            onSubmit={(event) => {
              event.preventDefault();
              if (!matches[0]) {
                toast(t("No plot matched that search."), "error");
                return;
              }
              focusPlot(matches[0]);
            }}
          >
            <Field label={t("Search plots")}>
              <input value={query} placeholder={t("Name, lot, or plot ID")} onChange={(event) => setQuery(event.target.value)} />
            </Field>
            <Button type="submit">{t("Search")}</Button>
          </form>
          {matches.length ? (
            <div className="chips">
              {matches.map((plot) => (
                <button key={plot.id} type="button" className="chip" onClick={() => focusPlot(plot)}>
                  {plot.id}
                </button>
              ))}
            </div>
          ) : null}
          <div className="chips" role="group" aria-label={t("Cemetery sections")}>
            {db.sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className="chip"
                aria-pressed={sectionId === section.id}
                onClick={() => {
                  setSectionId(section.id);
                  setBlockId("");
                }}
              >
                {section.name}
              </button>
            ))}
          </div>
          <div className="chips" role="group" aria-label={t("Blocks")}>
            {blocks.map((block) => (
              <button key={block.id} type="button" className="chip" aria-pressed={blockId === block.id} onClick={() => setBlockId(block.id)}>
                {t("Block {label}", { label: block.label })}
              </button>
            ))}
          </div>
          <CemeteryMap
            sections={db.sections}
            blocks={db.blocks}
            plots={db.plots}
            selectedPlotId={selectedId}
            occupantNames={occupantNames}
            showNumbers={db.settings.showPlotNumbers}
            focusToken={focusToken}
            focusPlotId={selectedId}
            onSelectSection={(id) => {
              setSectionId(id);
              setBlockId("");
            }}
            onSelectBlock={(id) => {
              const block = db.blocks.find((item) => item.id === id);
              if (!block) return;
              setSectionId(block.sectionId);
              setBlockId(block.id);
            }}
            onSelectPlot={(id) => {
              const plot = db.plots.find((item) => item.id === id);
              if (plot) focusPlot(plot);
            }}
          />
          {blockId ? (
            <div>
              <h2>{t("Plots in this block")}</h2>
              {plots.length === 0 ? <p>{t("This block has no plots yet.")}</p> : null}
              <div className="plot-grid" style={{ marginTop: 10 }}>
                {plots.map((plot) => (
                  <button
                    key={plot.id}
                    type="button"
                    className={`plot-btn ${plot.status}`}
                    aria-pressed={selectedId === plot.id}
                    onClick={() => focusPlot(plot)}
                  >
                    <span className="sr-only">{t(PLOT_STATUS_LABEL[plot.status])}</span>
                    {plot.lot}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p>{t("Choose a section and a block to see individual plots as large buttons.")}</p>
          )}
        </div>
        <aside className="stack">
          <section className="card card-pad stack">
            <h2>{t("Selected plot")}</h2>
            {selected ? (
              <>
                <p><strong>{selected.id}</strong></p>
                <Badge tone={statusTone(selected.status)}>{t(PLOT_STATUS_LABEL[selected.status])}</Badge>
                <p>{t("Capacity")}: {selected.capacity}</p>
                {occupants.length ? (
                  <ul>
                    {occupants.map((record) => (
                      <li key={record.id}>
                        <Button variant="ghost" to={`/admin/records/${record.id}`}>{fullName(record)} · {record.id}</Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t("No individual is assigned to this plot.")}</p>
                )}
                {canEdit ? (
                  <>
                    <div className="btn-row">
                      <Button variant="secondary" onClick={() => applyStatus("available")}>{t("Mark available")}</Button>
                      <Button variant="secondary" onClick={() => applyStatus("reserved")}>{t("Mark reserved")}</Button>
                      <Button onClick={() => applyStatus("occupied")}>{t("Mark occupied")}</Button>
                    </div>
                    <Field label={t("Capacity")} hint={t("Use 2 for a companion plot and 4 for a family estate.")}>
                      <input type="number" min="1" max="8" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} />
                    </Field>
                    <Field label={t("Plot notes")}>
                      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
                    </Field>
                    <Button
                      onClick={() => {
                        const result = updatePlotDetails(selected.id, { notes, capacity });
                        toast(result.ok ? t("Plot details saved.") : t(result.error), result.ok ? "success" : "error");
                      }}
                    >
                      {t("Save plot details")}
                    </Button>
                  </>
                ) : null}
              </>
            ) : (
              <p>{t("Select a plot on the map or in the block grid.")}</p>
            )}
          </section>
          {canEdit ? (
            <section className="card card-pad stack">
              <h2>{t("Add to the plan")}</h2>
              <Field label={t("New section name")}>
                <input value={sectionName} onChange={(event) => setSectionName(event.target.value)} />
              </Field>
              <Field label={t("Description")}>
                <input value={sectionDescription} onChange={(event) => setSectionDescription(event.target.value)} />
              </Field>
              <Button
                variant="secondary"
                onClick={() => {
                  const result = addSection({ name: sectionName, description: sectionDescription });
                  if (!result.ok) {
                    toast(t(result.error), "error");
                    return;
                  }
                  setSectionId(result.section.id);
                  setSectionName("");
                  setSectionDescription("");
                  setFocusToken((value) => value + 1);
                  toast(t("Section added."));
                }}
              >
                {t("Add section")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const result = addBlock(sectionId);
                  if (!result.ok) {
                    toast(t(result.error), "error");
                    return;
                  }
                  setBlockId(result.block.id);
                  toast(t("Block added."));
                }}
              >
                {t("Add block to selected section")}
              </Button>
              <Field label={t("Number of plots")}>
                <input type="number" min="1" max="24" value={plotCount} onChange={(event) => setPlotCount(Number(event.target.value))} />
              </Field>
              <Field label={t("Status for new plots")}>
                <select value={newStatus} onChange={(event) => setNewStatus(event.target.value)}>
                  <option value="available">{t("Available")}</option>
                  <option value="reserved">{t("Reserved")}</option>
                </select>
              </Field>
              <Button
                onClick={() => {
                  const result = addPlots({ blockId, count: plotCount, status: newStatus });
                  toast(result.ok ? t("Plots added.") : t(result.error), result.ok ? "success" : "error");
                }}
              >
                {t("Add burial plots")}
              </Button>
            </section>
          ) : null}
        </aside>
      </div>
      <ConfirmDialog
        open={confirm?.type === "assigned"}
        title={t("This plot already has a record")}
        message={t("Move or edit the assigned record before the plot can be marked available or reserved.")}
        confirmLabel={t("Open record")}
        tone="primary"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const record = occupants[0];
          setConfirm(null);
          if (record) navigate(`/admin/records/${record.id}?mode=edit`);
        }}
      />
    </div>
  );
}
