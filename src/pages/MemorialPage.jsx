import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { burialLabel, fullName } from "../lib/records";
import { formatDate } from "../lib/format";
import { Button, PageHeading } from "../components/ui";

export function MemorialPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const { db, familyAccess, clearFamily } = useApp();
  const navigate = useNavigate();
  const access = familyAccess(id);

  if (!access.ok) {
    return (
      <section className="wrap page">
        <div className="narrow card card-pad stack">
          <PageHeading
            title={t("Verify your access code")}
            lede={t("This memorial opens only after a valid family access code. The page does not show who is buried here until then.")}
          />
          {access.reason === "revoked" || access.reason === "expired" ? (
            <p className="warn-banner" role="status">
              {access.reason === "revoked"
                ? t("This access code has been revoked. Please contact the cemetery office for a new code.")
                : t("This access code has expired. Please contact the cemetery office to renew it.")}
            </p>
          ) : null}
          <Button to="/access">{t("Enter access code")}</Button>
        </div>
      </section>
    );
  }

  const record = access.record;
  const plot = db.plots.find((item) => item.id === record.plotId);
  const block = db.blocks.find((item) => item.id === plot?.blockId);
  const section = db.sections.find((item) => item.id === plot?.sectionId);
  const name = fullName(record);
  const initials = `${record.firstName[0] || ""}${record.lastName[0] || ""}`.toUpperCase();

  return (
    <section className="wrap page">
      <div className="narrow stack">
        <Link to="/access">{t("Back")}</Link>
        <article className="card memorial-card stack">
          <div className="profile">
            {record.photo ? (
              <img className="avatar-img" src={record.photo} alt={t("Memorial photograph of {name}", { name })} />
            ) : (
              <div className="avatar" aria-hidden="true">{initials}</div>
            )}
            <div className="stack">
              <PageHeading title={name} lede={`${formatDate(record.birthDate, lang)} — ${formatDate(record.passingDate, lang)}`} />
              <p>{db.cemetery.name}</p>
            </div>
          </div>
          <div>
            <h2>{t("Resting Place Information")}</h2>
            <dl className="dl" style={{ marginTop: 12 }}>
              <div><dt>{t("Cemetery")}</dt><dd>{db.cemetery.name}</dd></div>
              <div><dt>{t("Section")}</dt><dd>{section ? `${section.name} · ${t(section.description)}` : plot?.sectionId}</dd></div>
              <div><dt>{t("Block")}</dt><dd>{block ? t("Block {label}", { label: block.label }) : "—"}</dd></div>
              <div><dt>{t("Lot number")}</dt><dd>{plot?.lot || "—"}</dd></div>
              <div><dt>{t("Burial type")}</dt><dd>{t(burialLabel(record.burialType))}</dd></div>
              <div><dt>{t("Record number")}</dt><dd>{record.id}</dd></div>
            </dl>
          </div>
          <div className="btn-row">
            <Button to={`/map/${record.id}`}>{t("View Cemetery Map")}</Button>
            <Button variant="secondary" to={`/navigate/${record.id}`}>{t("Get Directions")}</Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              clearFamily();
              navigate("/");
            }}
          >
            {t("End this visit")}
          </Button>
        </article>
      </div>
    </section>
  );
}
