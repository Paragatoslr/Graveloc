import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import { CemeteryMap } from "../components/CemeteryMap";
import { FamilyMapView } from "../components/FamilyMapView";
import { Button, PageHeading } from "../components/ui";
import { plotIsDrawn, publishedMapForPlot } from "../data/mapModel";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { fullName } from "../lib/records";

export function MapPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { db, familyAccess } = useApp();
  const access = familyAccess(id);
  const [sectionId, setSectionId] = useState("");
  const [blockId, setBlockId] = useState("");
  const [selectedPlotId, setSelectedPlotId] = useState("");
  const [focusToken, setFocusToken] = useState(1);

  const record = access.ok ? access.record : null;
  const plot = db.plots.find((item) => item.id === record?.plotId);
  const names = useMemo(() => (record && plot ? { [plot.id]: [fullName(record)] } : {}), [record, plot]);

  if (!access.ok) {
    return (
      <section className="wrap page">
        <div className="narrow card card-pad stack">
          <PageHeading title={t("Verify your access code")} lede={t("The cemetery map for a resting place opens only after a valid family access code.")} />
          <Button to="/access">{t("Enter access code")}</Button>
        </div>
      </section>
    );
  }

  const section = db.sections.find((item) => item.id === (sectionId || plot?.sectionId));
  const visibleBlocks = db.blocks.filter((block) => block.sectionId === section?.id);
  const selectedPlot = db.plots.find((item) => item.id === (selectedPlotId || plot?.id));
  const selectedBlock = db.blocks.find((item) => item.id === selectedPlot?.blockId);
  const published = publishedMapForPlot(db, plot?.id);
  const customDestination = plotIsDrawn(published, plot?.id);

  return (
    <section className="wrap page">
      <PageHeading
        title={t("Cemetery map")}
        lede={t("The gold marker shows the resting place of {name}. Other names stay private.", { name: fullName(record) })}
      />
      <div className="map-layout">
        <div className="stack">
          <div className="chips" role="group" aria-label={t("Cemetery sections")}>
            {db.sections.map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip"
                aria-pressed={section?.id === item.id}
                onClick={() => {
                  setSectionId(item.id);
                  setBlockId("");
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
          {published && customDestination ? (
            <FamilyMapView
              snapshot={published}
              plots={db.plots}
              destinationPlotId={plot?.id || ""}
              resetToken={focusToken}
            />
          ) : (
            <>
              {published ? <p className="info-banner">{t("This resting place is not marked on the published map yet. The illustrated plan is shown instead.")}</p> : null}
          <CemeteryMap
            sections={db.sections}
            blocks={db.blocks}
            plots={db.plots}
            destinationPlotId={plot?.id || ""}
            selectedPlotId={selectedPlotId}
            occupantNames={names}
            showNumbers={db.settings.showPlotNumbers}
            focusToken={focusToken}
            focusPlotId={plot?.id || ""}
            onSelectSection={setSectionId}
            onSelectBlock={(idValue) => {
              setBlockId(idValue);
              const block = db.blocks.find((item) => item.id === idValue);
              if (block) setSectionId(block.sectionId);
            }}
            onSelectPlot={setSelectedPlotId}
          />
          <p className="hint">{t("Drag the map to look around, or use the buttons. This plan is a guide, not a live location.")}</p>
            </>
          )}
        </div>
        <aside className="card card-pad stack destination-card">
          <h2>{t("Destination")}</h2>
          <p>
            {t("Section {section} — Block {block} — Lot {lot}", {
              section: plot?.sectionId || "—",
              block: db.blocks.find((item) => item.id === plot?.blockId)?.label || "—",
              lot: plot?.lot || "—",
            })}
          </p>
          <p>{fullName(record)}</p>
          <p className="muted">{db.cemetery.name}</p>
          {section ? (
            <p>
              <strong>{section.name}</strong>
              <br />
              {t(section.description)}
            </p>
          ) : null}
          {blockId || selectedBlock ? (
            <p>{t("Selected block: {label}", { label: (db.blocks.find((item) => item.id === (blockId || selectedBlock?.id)) || {}).label || "" })}</p>
          ) : null}
          {visibleBlocks.length ? (
            <div className="chips">
              {visibleBlocks.map((block) => (
                <button key={block.id} type="button" className="chip" aria-pressed={blockId === block.id} onClick={() => setBlockId(block.id)}>
                  {t("Block {label}", { label: block.label })}
                </button>
              ))}
            </div>
          ) : null}
          <Button to={`/navigate/${record.id}`}>{t("Start Navigation")}</Button>
          <Link to={`/memorial/${record.id}`}>{t("Back to memorial")}</Link>
          <Button variant="ghost" onClick={() => setFocusToken((value) => value + 1)}>{t("Reset map position")}</Button>
        </aside>
      </div>
    </section>
  );
}
