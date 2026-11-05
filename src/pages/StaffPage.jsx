import { useState } from "react";
import { useAdminTitle } from "../components/AdminShell";
import { Badge, Button, ConfirmDialog, EmptyState, Field, Modal, statusTone, useToast } from "../components/ui";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { canAssignRole, canEditStaff, ROLE_LABEL } from "../lib/records";
import { formatWhen } from "../lib/format";

const ROLES = ["super_admin", "cemetery_admin", "cemetery_staff"];

export function StaffPage() {
  const { t, lang } = useI18n();
  const { db, can, currentStaff, addStaff, updateStaff } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", role: "cemetery_staff" });
  const [errors, setErrors] = useState({});
  const [tempPassword, setTempPassword] = useState("");
  const [confirm, setConfirm] = useState(null);
  useAdminTitle(t("Staff Management"));

  if (!can("staff.view")) {
    return <EmptyState title={t("Staff management is limited")} description={t("Ordinary cemetery staff cannot manage administrator accounts.")} />;
  }

  function startCreate() {
    setEditing(null);
    setErrors({});
    setForm({ name: "", email: "", role: "cemetery_staff" });
    setOpen(true);
  }

  function startEdit(person) {
    setEditing(person);
    setErrors({});
    setForm({ name: person.name, email: person.email, role: person.role });
    setOpen(true);
  }

  function save() {
    const result = editing
      ? updateStaff(editing.id, { ...form, status: editing.status })
      : addStaff(form);
    if (!result.ok) {
      setErrors(result.errors || {});
      if (result.error) toast(t(result.error), "error");
      return;
    }
    setOpen(false);
    if (result.tempPassword) setTempPassword(result.tempPassword);
    toast(editing ? t("Staff account updated.") : t("Staff account added."));
  }

  const allowedRoles = ROLES.filter((role) => canAssignRole(currentStaff.role, role));

  return (
    <div className="stack">
      <div className="spread">
        <p className="lede">{t("Three roles: Super Administrator, Cemetery Administrator, and Cemetery Staff.")}</p>
        {can("staff.manage") ? <Button onClick={startCreate}>{t("Add staff")}</Button> : null}
      </div>
      {tempPassword ? (
        <div className="success-banner stack" role="status">
          <strong>{t("Temporary prototype password")}</strong>
          <p>{tempPassword}</p>
          <p>{t("Share it with the staff member once. It is stored only in this browser demonstration.")}</p>
          <Button variant="secondary" onClick={() => setTempPassword("")}>{t("Hide password")}</Button>
        </div>
      ) : null}
      <div className="card card-pad">
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">{t("Staff accounts")}</caption>
            <thead>
              <tr>
                <th>{t("Staff name")}</th>
                <th>{t("Email")}</th>
                <th>{t("Assigned role")}</th>
                <th>{t("Account status")}</th>
                <th>{t("Last active")}</th>
                <th>{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {db.staff.map((person) => {
                const editable = can("staff.manage") && canEditStaff(currentStaff, person);
                return (
                  <tr key={person.id}>
                    <td>{person.name}</td>
                    <td>{person.email}</td>
                    <td>{t(ROLE_LABEL[person.role])}</td>
                    <td><Badge tone={person.status === "active" ? "success" : "danger"}>{t(person.status === "active" ? "Active" : "Deactivated")}</Badge></td>
                    <td>{person.lastActive ? formatWhen(person.lastActive, lang) : t("Never")}</td>
                    <td>
                      {editable ? (
                        <div className="btn-row">
                          <Button variant="secondary" onClick={() => startEdit(person)}>{t("Edit staff")}</Button>
                          <Button
                            variant={person.status === "active" ? "danger" : "secondary"}
                            onClick={() => setConfirm(person)}
                          >
                            {person.status === "active" ? t("Deactivate staff") : t("Activate staff")}
                          </Button>
                        </div>
                      ) : (
                        <span className="muted">{t("No actions")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="record-cards">
          {db.staff.map((person) => (
            <article key={person.id} className="card record-card">
              <strong>{person.name}</strong>
              <p>{person.email}</p>
              <p>{t(ROLE_LABEL[person.role])}</p>
              <Badge tone={statusTone(person.status === "active" ? "active" : "deactivated")}>
                {t(person.status === "active" ? "Active" : "Deactivated")}
              </Badge>
              <p>{person.lastActive ? formatWhen(person.lastActive, lang) : t("Never")}</p>
            </article>
          ))}
        </div>
      </div>
      <Modal open={open} title={editing ? t("Edit staff") : t("Add staff")} onClose={() => setOpen(false)}>
        <div className="stack">
          <Field label={t("Staff name")} required error={errors.name ? t(errors.name) : ""}>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label={t("Email")} required error={errors.email ? t(errors.email) : ""}>
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label={t("Assigned role")} required error={errors.role ? t(errors.role) : ""}>
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {allowedRoles.map((role) => (
                <option key={role} value={role}>{t(ROLE_LABEL[role])}</option>
              ))}
            </select>
          </Field>
          <div className="btn-row">
            <Button onClick={save}>{editing ? t("Save changes") : t("Add staff")}</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>{t("Cancel")}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.status === "active" ? t("Deactivate this account?") : t("Activate this account?")}
        message={confirm?.status === "active"
          ? t("{name} will no longer be able to sign in.", { name: confirm?.name || "" })
          : t("{name} will be able to sign in again.", { name: confirm?.name || "" })}
        confirmLabel={confirm?.status === "active" ? t("Deactivate staff") : t("Activate staff")}
        tone={confirm?.status === "active" ? "danger" : "primary"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const result = updateStaff(confirm.id, {
            ...confirm,
            status: confirm.status === "active" ? "deactivated" : "active",
          });
          setConfirm(null);
          toast(result.ok ? t("Staff account updated.") : t(result.error), result.ok ? "success" : "error");
        }}
      />
    </div>
  );
}
