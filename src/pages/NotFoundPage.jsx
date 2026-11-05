import { Button, PageHeading } from "../components/ui";
import { useI18n } from "../i18n/LanguageContext";

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <section className="wrap page">
      <div className="narrow card card-pad stack">
        <PageHeading title={t("Page not found")} lede={t("That address is not part of GRAVELOC.")} />
        <div className="btn-row">
          <Button to="/">{t("Go to homepage")}</Button>
          <Button variant="secondary" to="/admin/login">{t("Staff sign in")}</Button>
        </div>
      </div>
    </section>
  );
}
