import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CemeteryMap } from "../components/CemeteryMap";
import { FamilyMapView } from "../components/FamilyMapView";
import { Button, PageHeading } from "../components/ui";
import { plotIsDrawn, publishedMapForPlot } from "../data/mapModel";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { fullName } from "../lib/records";
import { buildLayout, estimateWalk } from "../map/layout";

export function NavigatePage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { db, familyAccess } = useApp();
  const access = familyAccess(id);
  const [step, setStep] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [focusToken, setFocusToken] = useState(1);

  const record = access.ok ? access.record : null;
  const plot = db.plots.find((item) => item.id === record?.plotId);
  const block = db.blocks.find((item) => item.id === plot?.blockId);
  const section = db.sections.find((item) => item.id === plot?.sectionId);
  const layout = useMemo(() => buildLayout(db.sections, db.blocks, db.plots), [db.sections, db.blocks, db.plots]);
  const frame = layout.plots.find((item) => item.id === plot?.id);
  const walk = frame ? estimateWalk(frame) : { meters: 0, minutes: 0 };
  const side = frame?.sectionCol === 0 ? t("left") : t("right");

  if (!access.ok || !plot || !section || !block) {
    return (
      <section className="wrap page">
        <div className="narrow card card-pad stack">
          <PageHeading title={t("Verify your access code")} lede={t("Directions open only for a verified family visit.")} />
          <Button to="/access">{t("Enter access code")}</Button>
        </div>
      </section>
    );
  }

  const steps = [
    {
      title: t("Start at the main entrance."),
      detail: t("Use the main gate as your starting point. This guide does not track your location or use GPS."),
    },
    {
      title: t("Follow the pathway toward Section {section}.", { section: section.id }),
      detail: t("{name} is on the {side} side of the central pathway.", { name: section.name, side }),
    },
    {
      title: t("Continue straight until Block {block}.", { block: block.label }),
      detail: t("Enter {section} and look for Block {block}.", { section: section.name, block: block.label }),
    },
    {
      title: t("Your destination is on the {side}.", { side }),
      detail: t("Lot {lot} is marked in gold.", { lot: plot.lot }),
    },
  ];

  return (
    <section className="wrap page">
      <PageHeading
        title={t("Walking guide")}
        lede={t("A simulated route from the main entrance to {name}. It is not live GPS.", { name: fullName(record) })}
      />
      <div className="map-layout nav-layout">
        <div className="card card-pad stack destination-card">
          <p className="eyebrow">{t("About {meters} m · {minutes} minutes on foot", walk)}</p>
          <h2>{t("Destination")}</h2>
          <p>{t("Section {section} — Block {block} — Lot {lot}", { section: section.id, block: block.label, lot: plot.lot })}</p>
          <p>{fullName(record)}</p>
          <ol className="directions">
            {steps.map((item, index) => (
              <li key={item.title} className={index === step ? "direction current" : "direction"} aria-current={index === step ? "step" : undefined}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </li>
            ))}
          </ol>
          <div className="btn-row">
            <Button variant="secondary" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>
              {t("Previous direction")}
            </Button>
            <Button onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))} disabled={step === steps.length - 1}>
              {t("Next direction")}
            </Button>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setArrived(true);
              setStep(steps.length - 1);
            }}
          >
            {t("Destination Reached")}
          </Button>
          {arrived ? (
            <div className="success-banner" role="status">
              <strong>{t("You have marked this visit as arrived.")}</strong>
              <p>{t("This button does not detect your location. It simply confirms the end of the guide.")}</p>
            </div>
          ) : null}
          <div className="btn-row">
            <Button variant="ghost" to={`/map/${record.id}`}>{t("Back to Map")}</Button>
            <Button variant="ghost" onClick={() => setFocusToken((value) => value + 1)}>{t("Recenter Map")}</Button>
          </div>
          <Link to={`/memorial/${record.id}`}>{t("Back to memorial")}</Link>
        </div>
        {plotIsDrawn(publishedMapForPlot(db, plot.id), plot.id) ? (
          <FamilyMapView
            snapshot={publishedMapForPlot(db, plot.id)}
            plots={db.plots}
            destinationPlotId={plot.id}
            resetToken={focusToken}
          />
        ) : (
          <CemeteryMap
            sections={db.sections}
            blocks={db.blocks}
            plots={db.plots}
            destinationPlotId={plot.id}
            occupantNames={{ [plot.id]: [fullName(record)] }}
            showPath
            navStep={step}
            showNumbers={db.settings.showPlotNumbers}
            focusToken={focusToken}
            focusPlotId={plot.id}
          />
        )}
      </div>
    </section>
  );
}
