import { createContext, useContext, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { notificationText, ROLE_LABEL } from "../lib/records";
import { formatWhen } from "../lib/format";
import { ThemeToggle } from "./ThemeToggle";
import { Badge, Button, LanguageSwitch, Logo } from "./ui";

const TitleContext = createContext(null);

export function useAdminTitle(title) {
  const context = useContext(TitleContext);
  useEffect(() => {
    document.title = `${title} · GRAVELOC`;
    context?.setTitle(title);
  }, [title, context]);
}

const NAV = [
  { to: "/admin/dashboard", label: "Overview", action: "dashboard.view" },
  { to: "/admin/records", label: "Records", action: "records.view" },
  { to: "/admin/map", label: "Cemetery Map", action: "map.view" },
  { to: "/admin/map/gallery", label: "Map Gallery", action: "map.view" },
  { to: "/admin/map/trash", label: "Trash Bin", action: "records.view" },
  { to: "/admin/staff", label: "Staff Management", action: "staff.view" },
  { to: "/admin/settings", label: "Settings", action: "settings.account" },
];

export function AdminShell() {
  const { t, lang } = useI18n();
  const { currentStaff, can, signOut, db, markAllNotificationsRead } = useApp();
  const [open, setOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const unread = db.notifications.filter((item) => !item.read).length;

  useEffect(() => {
    setOpen(false);
    setNotesOpen(false);
    const title = document.getElementById("page-title");
    title?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#main">{t("Skip to content")}</a>
      {open ? <button type="button" className="backdrop" aria-label={t("Close menu")} onClick={() => setOpen(false)} /> : null}
      <aside className={open ? "admin-sidebar open" : "admin-sidebar"}>
        <NavLink to="/admin/dashboard" className="brand" aria-label={t("GRAVELOC admin home")}>
          <Logo admin />
        </NavLink>
        <nav className="admin-nav" aria-label={t("Administration")}>
          {NAV.filter((item) => can(item.action)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/admin/records" ? false : undefined}>
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="side-footer">
          <button
            type="button"
            onClick={() => {
              signOut();
              navigate("/admin/login");
            }}
          >
            {t("Log out")}
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-top">
          <div className="row">
            <button type="button" className="btn btn-secondary menu-btn" onClick={() => setOpen(true)}>
              {t("Menu")}
            </button>
            <h1 id="page-title" tabIndex={-1}>{title || t("Overview")}</h1>
          </div>
          <div className="admin-tools">
            <form
              className="admin-search"
              onSubmit={(event) => {
                event.preventDefault();
                navigate(`/admin/records?q=${encodeURIComponent(query.trim())}`);
              }}
            >
              <label className="sr-only" htmlFor="admin-search">{t("Search records")}</label>
              <input
                id="admin-search"
                type="search"
                value={query}
                placeholder={t("Search name or record ID")}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
            <LanguageSwitch />
            <ThemeToggle />
            <div className="notify">
              <Button
                variant="secondary"
                aria-expanded={notesOpen}
                aria-controls="notifications"
                onClick={() => setNotesOpen((value) => !value)}
              >
                {t("Notifications")}{unread ? ` (${unread})` : ""}
              </Button>
              {notesOpen ? (
                <div className="notify-panel" id="notifications">
                  <div className="spread">
                    <strong>{t("Notifications")}</strong>
                    <button type="button" className="btn btn-ghost" onClick={markAllNotificationsRead}>
                      {t("Mark all read")}
                    </button>
                  </div>
                  {db.notifications.length === 0 ? <p>{t("No notifications yet.")}</p> : null}
                  {db.notifications.slice(0, 6).map((note) => {
                    const text = notificationText(note, t);
                    return (
                      <article key={note.id} className={note.read ? "notify-item" : "notify-item unread"}>
                        <strong>{text.title}</strong>
                        <p>{text.body}</p>
                        <p className="muted">{formatWhen(note.at, lang)}</p>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="profile-pill">
              <strong>{currentStaff?.name}</strong>
              <Badge tone="gold">{t(ROLE_LABEL[currentStaff?.role] || "Staff")}</Badge>
            </div>
          </div>
        </header>
        <div className="admin-content" id="main" tabIndex={-1}>
          <TitleContext.Provider value={{ setTitle }}>
            <Outlet />
          </TitleContext.Provider>
        </div>
      </div>
    </div>
  );
}
