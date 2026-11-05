import { useState } from "react";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { BURIAL_TYPES, RECORD_STATUSES, occupantsOf, validateRecord } from "../lib/records";
import { Button, Field } from "./ui";

export function RecordForm({ initial, editingId = null, showStatus = false, submitLabel, onSubmit }) {
  const { t } = useI18n();
  const { db } = useApp();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function update(key, value) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "sectionId") {
        next.blockId = "";
        next.lot = "";
      }
      if (key === "blockId") next.lot = "";
      return next;
    });
  }

  const blocks = db.blocks.filter((block) => block.sectionId === values.sectionId);
  const lots = db.plots
    .filter((plot) => plot.blockId === values.blockId)
    .slice()
    .sort((a, b) => a.lot.localeCompare(b.lot, undefined, { numeric: true }));

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateRecord(values, db, editingId);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const alert = document.getElementById("form-errors");
      alert?.focus();
      return;
    }
    setBusy(true);
    await onSubmit(values);
    setBusy(false);
  }

  function onPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) {
      setErrors((current) => ({
        ...current,
        photo: t("That photo is too large for this prototype. Choose an image under 500 KB."),
      }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update("photo", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  const errorList = Object.values(errors);

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      {errorList.length ? (
        <div className="form-alert" id="form-errors" tabIndex={-1} role="alert">
          <p>{t("Please correct the highlighted fields.")}</p>
          <ul>
            {errorList.map((message) => (
              <li key={message}>{t(message)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset className="card form-section">
        <legend>{t("Personal information")}</legend>
        <div className="grid-2">
          <Field label={t("First name")} required error={errors.firstName ? t(errors.firstName) : ""}>
            <input value={values.firstName} onChange={(event) => update("firstName", event.target.value)} autoComplete="given-name" />
          </Field>
          <Field label={t("Middle name")} hint={t("Optional")}>
            <input value={values.middleName} onChange={(event) => update("middleName", event.target.value)} autoComplete="additional-name" />
          </Field>
          <Field label={t("Last name")} required error={errors.lastName ? t(errors.lastName) : ""}>
            <input value={values.lastName} onChange={(event) => update("lastName", event.target.value)} autoComplete="family-name" />
          </Field>
          <Field label={t("Date of birth")} required error={errors.birthDate ? t(errors.birthDate) : ""}>
            <input type="date" value={values.birthDate} onChange={(event) => update("birthDate", event.target.value)} />
          </Field>
          <Field label={t("Date of passing")} required error={errors.passingDate ? t(errors.passingDate) : ""}>
            <input type="date" value={values.passingDate} onChange={(event) => update("passingDate", event.target.value)} />
          </Field>
          <Field label={t("Photograph")} hint={t("Optional. JPG, PNG, or WebP under 500 KB.")} error={errors.photo ? t(errors.photo) : ""}>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPhoto} />
          </Field>
        </div>
        {values.photo ? (
          <div className="row">
            <img className="photo-preview" src={values.photo} alt={t("Selected photograph preview")} />
            <Button variant="ghost" onClick={() => update("photo", "")}>{t("Remove photograph")}</Button>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="card form-section">
        <legend>{t("Burial information")}</legend>
        <div className="grid-2">
          <Field label={t("Cemetery")} required>
            <select value={values.cemeteryId} onChange={(event) => update("cemeteryId", event.target.value)}>
              <option value={db.cemetery.id}>{db.cemetery.name}</option>
            </select>
          </Field>
          <Field label={t("Section")} required error={errors.sectionId ? t(errors.sectionId) : ""}>
            <select value={values.sectionId} onChange={(event) => update("sectionId", event.target.value)}>
              <option value="">{t("Choose a section")}</option>
              {db.sections.map((section) => (
                <option key={section.id} value={section.id}>{section.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("Block")} required error={errors.blockId ? t(errors.blockId) : ""}>
            <select value={values.blockId} onChange={(event) => update("blockId", event.target.value)} disabled={!values.sectionId}>
              <option value="">{t("Choose a block")}</option>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>{t("Block {label}", { label: block.label })}</option>
              ))}
            </select>
          </Field>
          <Field label={t("Lot number")} required error={errors.lot ? t(errors.lot) : ""}>
            <select value={values.lot} onChange={(event) => update("lot", event.target.value)} disabled={!values.blockId}>
              <option value="">{t("Choose a lot")}</option>
              {lots.map((plot) => {
                const count = occupantsOf(db, plot.id, editingId).length;
                const current = editingId && db.records.find((record) => record.id === editingId)?.plotId === plot.id;
                const full = count >= plot.capacity && !current;
                const reserved = plot.status === "reserved" && count === 0 && !current;
                let note = t("available");
                if (current) note = t("current lot");
                else if (reserved) note = t("reserved");
                else if (full) note = t("occupied");
                else if (count > 0) note = t("{count} of {capacity} spaces used", { count, capacity: plot.capacity });
                return (
                  <option key={plot.id} value={plot.lot} disabled={full || reserved}>
                    {t("Lot {lot}", { lot: plot.lot })} ({note})
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label={t("Burial type")} required error={errors.burialType ? t(errors.burialType) : ""}>
            <select value={values.burialType} onChange={(event) => update("burialType", event.target.value)}>
              {BURIAL_TYPES.map((type) => (
                <option key={type.id} value={type.id}>{t(type.label)}</option>
              ))}
            </select>
          </Field>
          <Field label={t("Burial date")} required error={errors.burialDate ? t(errors.burialDate) : ""}>
            <input type="date" value={values.burialDate} onChange={(event) => update("burialDate", event.target.value)} />
          </Field>
          {showStatus ? (
            <Field label={t("Record status")}>
              <select value={values.status} onChange={(event) => update("status", event.target.value)}>
                {RECORD_STATUSES.map((status) => (
                  <option key={status.id} value={status.id}>{t(status.label)}</option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
        <p className="hint">
          {t("A single plot can hold more than one person only when the burial type allows it, such as a companion burial.")}
        </p>
      </fieldset>

      <div className="btn-row">
        <Button type="submit" disabled={busy}>{busy ? t("Saving…") : submitLabel}</Button>
      </div>
    </form>
  );
}
