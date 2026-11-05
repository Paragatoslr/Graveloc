import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitch, Logo } from "./ui";

export function FamilyShell() {
  const { t } = useI18n();
  const { db } = useApp();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const focused = location.pathname !== "/";

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!location.hash) return;
    const target = document.querySelector(location.hash);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      target.focus({ preventScroll: true });
    }
  }, [location]);

  return (
    <div className="portal-family">
      <a className="skip-link" href="#main">{t("Skip to content")}</a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label={t("GRAVELOC home")}>
            <Logo />
          </Link>
          {focused ? (
            <div className="header-tools">
              <Link className="text-link" to="/">{t("Home")}</Link>
              <LanguageSwitch />
              <ThemeToggle />
            </div>
          ) : (
            <>
              <nav className="desktop-nav" aria-label={t("Primary")}>
                <NavLink to="/" end>{t("Home")}</NavLink>
                <a href="#how-it-works">{t("How It Works")}</a>
                <a href="#about">{t("About")}</a>
              </nav>
              <div className="header-tools">
                <LanguageSwitch />
                <ThemeToggle />
                <button
                  type="button"
                  className="btn btn-secondary nav-toggle"
                  aria-expanded={open}
                  aria-controls="mobile-nav"
                  onClick={() => setOpen((value) => !value)}
                >
                  {open ? t("Close menu") : t("Menu")}
                </button>
              </div>
            </>
          )}
        </div>
        {!focused ? (
          <nav id="mobile-nav" className={open ? "mobile-nav open" : "mobile-nav"} aria-label={t("Mobile")}>
            <NavLink to="/" end>{t("Home")}</NavLink>
            <a href="#how-it-works" onClick={() => setOpen(false)}>{t("How It Works")}</a>
            <a href="#about" onClick={() => setOpen(false)}>{t("About")}</a>
            <Link to="/access" onClick={() => setOpen(false)}>{t("Find a Loved One")}</Link>
          </nav>
        ) : null}
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="footer-inner footer-grid">
          <div>
            <Logo />
            <p style={{ marginTop: 12 }}>
              {t("GRAVELOC helps families find a resting place and helps cemetery staff keep clear records.")}
            </p>
          </div>
          <div>
            <h2>{t("About GRAVELOC")}</h2>
            <ul>
              <li><Link to="/#about">{t("About the park")}</Link></li>
              <li><Link to="/#how-it-works">{t("How It Works")}</Link></li>
              <li><Link to="/#privacy">{t("Privacy")}</Link></li>
            </ul>
          </div>
          <div>
            <h2>{t("Visitor assistance")}</h2>
            <ul>
              <li><a href={`tel:${db.cemetery.phone.replace(/\s/g, "")}`}>{db.cemetery.phone}</a></li>
              <li><a href={`mailto:${db.cemetery.email}`}>{db.cemetery.email}</a></li>
              <li>{db.cemetery.hours}</li>
            </ul>
          </div>
          <div>
            <h2>{t("Visit")}</h2>
            <p>{db.cemetery.name}</p>
            <p>{db.cemetery.address}</p>
            <p>{db.cemetery.city}</p>
            <p><Link className="staff-link" to="/admin/login">{t("Staff sign in")}</Link></p>
          </div>
        </div>
        <div className="footer-inner legal">
          {t("Family access codes are private. This prototype stores demonstration records in your browser only.")}
        </div>
      </footer>
    </div>
  );
}
