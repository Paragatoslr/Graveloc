import { cloneElement, Component, createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/LanguageContext";

const Toasts = createContext(null);

export function Logo({ admin = false }) {
  const { t } = useI18n();
  return (
    <span className="brand-mark">
      <svg className="logo-svg" viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="12" fill="#245B48" />
        <path d="M20 8c4 5 8 8.2 8 13.2A8 8 0 1 1 12 21.2C12 16.2 16 13 20 8z" fill="#F8F9F6" />
        <circle cx="20" cy="21" r="2.4" fill="#C7A66A" />
      </svg>
      <span>
        <span className="wordmark">GRAVELOC</span>
        {admin ? <span className="brand-sub">{t("Admin")}</span> : null}
      </span>
    </span>
  );
}

export function Button({
  variant = "primary",
  to,
  type = "button",
  className = "",
  block = false,
  children,
  ...props
}) {
  const cls = ["btn", `btn-${variant}`, block ? "btn-block" : "", className].filter(Boolean).join(" ");
  if (to) {
    return (
      <Link to={to} className={cls} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} {...props}>
      {children}
    </button>
  );
}

export function Field({ label, hint, error, required = false, children }) {
  const uid = useId();
  const hintId = hint ? `${uid}-hint` : undefined;
  const errorId = error ? `${uid}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const control = cloneElement(children, {
    id: children.props.id || uid,
    "aria-invalid": error ? "true" : undefined,
    "aria-describedby": describedBy,
    "aria-required": required ? "true" : undefined,
  });
  return (
    <div className={error ? "field has-error" : "field"}>
      <label htmlFor={control.props.id}>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      {control}
      {hint ? (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SearchField({ id, label, ...props }) {
  return (
    <div className="search-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="search" {...props} />
    </div>
  );
}

export function Badge({ tone = "neutral", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty card">
      <h2>{title}</h2>
      {description ? <p className="muted">{description}</p> : null}
      {action || null}
    </div>
  );
}

export function Breadcrumb({ items }) {
  const { t } = useI18n();
  return (
    <nav className="breadcrumb" aria-label={t("Breadcrumb")}>
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {item.to && !last ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current={last ? "page" : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Pagination({ page, pageCount, onPage }) {
  const { t } = useI18n();
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  return (
    <nav className="pagination" aria-label={t("Pagination")}>
      <Button variant="secondary" onClick={() => onPage(page - 1)} disabled={page === 1}>
        {t("Previous")}
      </Button>
      <div className="pages">
        {pages.map((number) => (
          <button
            key={number}
            type="button"
            className="btn btn-ghost"
            aria-current={number === page ? "page" : undefined}
            onClick={() => onPage(number)}
          >
            {number}
          </button>
        ))}
      </div>
      <Button variant="secondary" onClick={() => onPage(page + 1)} disabled={page === pageCount}>
        {t("Next")}
      </Button>
    </nav>
  );
}

export function PageHeading({ title, lede }) {
  const ref = useRef(null);
  useEffect(() => {
    document.title = `${title} · GRAVELOC`;
    ref.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <div className="page-heading">
      <h1 ref={ref} tabIndex={-1}>
        {title}
      </h1>
      {lede ? <p className="lede">{lede}</p> : null}
    </div>
  );
}

export function Modal({ open, title, onClose, children, description }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const root = ref.current;
    const focusable = () =>
      [...root.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
        (node) => !node.disabled,
      );
    focusable()[0]?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        ref={ref}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" onClick={onClose}>
            {t("Close")}
          </Button>
        </div>
        {description ? <p id={descId}>{description}</p> : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  tone = "danger",
  onConfirm,
  onClose,
  busy = false,
}) {
  const { t } = useI18n();
  return (
    <Modal open={open} title={title} onClose={onClose} description={message}>
      <div className="btn-row" style={{ marginTop: 16 }}>
        <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
          {busy ? t("Please wait…") : confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t("Cancel")}
        </Button>
      </div>
    </Modal>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (message, tone = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4800);
  };
  return (
    <Toasts.Provider value={push}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </Toasts.Provider>
  );
}

export function useToast() {
  return useContext(Toasts);
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal">
          <div className="card card-pad stack">
            <h1>Something went wrong</h1>
            <p>This page could not be shown. You can return to the homepage and try again.</p>
            <a className="btn btn-primary" href="/">
              Go to homepage
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t("Language")}>
      <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
        EN
      </button>
      <button type="button" aria-pressed={lang === "fil"} onClick={() => setLang("fil")}>
        FIL
      </button>
    </div>
  );
}

export function statusTone(status) {
  if (status === "active" || status === "available") return "success";
  if (status === "pending" || status === "reserved" || status === "expired") return "warning";
  if (status === "revoked" || status === "deactivated") return "danger";
  if (status === "occupied") return "info";
  return "neutral";
}
