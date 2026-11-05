import { useEffect, useState } from "react";
import { Button, Modal } from "../components/ui";
import { useI18n } from "../i18n/LanguageContext";
import {
  DEFAULT_MAP_SHORTCUTS,
  formatShortcut,
  mergeShortcuts,
  normalizeShortcut,
  SHORTCUT_LABELS,
  shortcutConflicts,
  shortcutWarnings,
} from "./shortcuts";

export function MapShortcutsModal({ open, shortcuts, onClose, onSave, onRestoreDefaults }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(shortcuts);
  const [recording, setRecording] = useState("");
  const merged = mergeShortcuts(draft);
  const conflicts = shortcutConflicts(merged);
  const warnings = shortcutWarnings(merged);

  useEffect(() => {
    if (open) setDraft(shortcuts);
  }, [open, shortcuts]);

  useEffect(() => {
    if (!recording) return undefined;
    function onKey(event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecording("");
        return;
      }
      const parts = [];
      if (event.metaKey || event.ctrlKey) parts.push("mod");
      if (event.shiftKey) parts.push("shift");
      if (event.altKey) parts.push("alt");
      let key = event.key.toLowerCase();
      if (key === "control" || key === "meta" || key === "shift" || key === "alt") return;
      if (key === " ") key = "space";
      if (key === "=") key = "+";
      parts.push(key);
      const combo = normalizeShortcut(parts.join("+"));
      setDraft((current) => ({ ...current, [recording]: combo }));
      setRecording("");
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording]);

  return (
    <Modal open={open} title={t("Keyboard shortcuts")} description={t("Customize Map Builder shortcuts. Conflicts are highlighted.")} onClose={onClose}>
      {recording ? <p className="info-banner" role="status">{t("Press your desired key combination…")}</p> : null}
      {conflicts.length ? (
        <p className="form-alert" role="alert">
          {t("Conflicting shortcuts")}: {conflicts.map((item) => item.key).join(", ")}
        </p>
      ) : null}
      {warnings.length ? (
        <p className="hint">{t("These shortcuts may conflict with the browser")}: {warnings.map((item) => SHORTCUT_LABELS[item.action]).join(", ")}</p>
      ) : null}
      <ul className="shortcut-list">
        {Object.keys(DEFAULT_MAP_SHORTCUTS).map((action) => (
          <li key={action} className="spread wrap-row">
            <span>{t(SHORTCUT_LABELS[action])}</span>
            <Button variant="secondary" onClick={() => setRecording(action)} aria-pressed={recording === action}>
              {formatShortcut(merged[action])}
            </Button>
          </li>
        ))}
      </ul>
      <div className="btn-row">
        <Button
          disabled={conflicts.length > 0}
          onClick={() => {
            onSave(merged);
            onClose();
          }}
        >
          {t("Save shortcuts")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            onRestoreDefaults();
            setDraft(DEFAULT_MAP_SHORTCUTS);
          }}
        >
          {t("Restore defaults")}
        </Button>
        <Button variant="ghost" onClick={onClose}>{t("Cancel")}</Button>
      </div>
    </Modal>
  );
}
