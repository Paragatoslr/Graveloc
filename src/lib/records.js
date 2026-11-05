export const BURIAL_TYPES = [
  { id: "single", label: "Single burial" },
  { id: "companion", label: "Companion burial" },
  { id: "niche", label: "Cremation niche" },
  { id: "estate", label: "Family estate" },
];

export const RECORD_STATUSES = [
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending review" },
  { id: "archived", label: "Archived" },
];

export const ROLE_LABEL = {
  super_admin: "Super Administrator",
  cemetery_admin: "Cemetery Administrator",
  cemetery_staff: "Cemetery Staff",
};

export const PLOT_STATUS_LABEL = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
};

export function capacityFor(type) {
  if (type === "companion") return 2;
  if (type === "estate") return 4;
  return 1;
}

export function fullName(record) {
  if (!record) return "";
  return [record.firstName, record.middleName, record.lastName].filter(Boolean).join(" ");
}

export function burialLabel(type) {
  return BURIAL_TYPES.find((item) => item.id === type)?.label || "Burial";
}

export function normalizeAccessCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, "");
}

export function accessErrorText(reason) {
  if (reason === "format") return "Access codes look like GRV-8K29-XP41. Check the card and try again.";
  if (reason === "record-id") return "That is a record number, not a family access code. Enter the code from the family card.";
  if (reason === "expired") return "This access code has expired. Please contact the cemetery office to renew it.";
  if (reason === "revoked") return "This access code has been revoked. Please contact the cemetery office for a new code.";
  if (reason === "inactive") return "This access code is inactive. Please contact the cemetery office.";
  if (reason === "unavailable") return "This memorial is not available with that code. Please contact the cemetery office.";
  if (reason === "missing") return "The record for this access code could not be found. Please contact the cemetery office.";
  if (reason === "storage") return "The directory could not be checked. Refresh the page and try again.";
  return "That access code was not found. Check the characters, or ask the cemetery office for help.";
}

export function assessCode(db, raw) {
  const code = normalizeAccessCode(raw);
  if (!/^[A-Z0-9]{2,6}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    return { ok: false, reason: "format" };
  }
  const credential = (db.credentials || []).find((item) => normalizeAccessCode(item.code) === code);
  if (!credential) {
    const recordNumber = (db.records || []).some((item) => normalizeAccessCode(item.id) === code);
    return { ok: false, reason: recordNumber ? "record-id" : "unknown" };
  }
  if (credential.status === "revoked") return { ok: false, reason: "revoked" };
  const expired = credential.status === "expired" || new Date(credential.expiresAt).getTime() < Date.now();
  if (expired) return { ok: false, reason: "expired" };
  if (credential.status !== "active") return { ok: false, reason: "inactive" };
  const record = db.records.find((item) => item.id === credential.recordId);
  if (!record) return { ok: false, reason: "missing" };
  if (record.status === "archived") return { ok: false, reason: "unavailable" };
  return { ok: true, credential, record };
}

export function occupantsOf(db, plotId, exceptId = null) {
  return db.records.filter((record) => record.plotId === plotId && record.id !== exceptId);
}

export function findPlot(db, sectionId, blockId, lot) {
  return db.plots.find(
    (plot) => plot.sectionId === sectionId && plot.blockId === blockId && plot.lot === lot,
  );
}

export function validateRecord(input, db, editingId = null) {
  const errors = {};
  const firstName = input.firstName?.trim() ?? "";
  const lastName = input.lastName?.trim() ?? "";
  if (!firstName) errors.firstName = "Enter a first name.";
  if (!lastName) errors.lastName = "Enter a last name.";
  if (!input.birthDate) errors.birthDate = "Enter the date of birth.";
  if (!input.passingDate) errors.passingDate = "Enter the date of passing.";
  if (input.birthDate && input.passingDate && input.passingDate < input.birthDate) {
    errors.passingDate = "The date of passing cannot be earlier than the date of birth.";
  }
  if (!input.burialDate) errors.burialDate = "Enter the burial date.";
  if (input.burialDate && input.passingDate && input.burialDate < input.passingDate) {
    errors.burialDate = "The burial date cannot be earlier than the date of passing.";
  }
  if (!input.burialType) errors.burialType = "Choose a burial type.";
  if (!input.sectionId) errors.sectionId = "Choose a section.";
  if (!input.blockId) errors.blockId = "Choose a block.";
  if (!input.lot) errors.lot = "Choose a lot.";
  if (input.photo && input.photo.length > 900000) {
    errors.photo = "That photo is too large for this prototype. Choose an image under 500 KB.";
  }

  if (input.sectionId && input.blockId && input.lot && !errors.lot && !errors.burialType) {
    const plot = findPlot(db, input.sectionId, input.blockId, input.lot);
    if (!plot) {
      errors.lot = "That lot does not exist in the selected block.";
    } else {
      const others = occupantsOf(db, plot.id, editingId);
      const requested = capacityFor(input.burialType);
      if (plot.status === "reserved" && others.length === 0) {
        errors.lot =
          "This plot is reserved. Choose another lot, or mark the plot available on the cemetery map.";
      } else if (others.length > 0 && requested !== plot.capacity) {
        errors.burialType =
          "This plot is already shared. Use the same burial type already chosen for it, or pick another lot.";
      } else if (others.length + 1 > (others.length > 0 ? plot.capacity : requested)) {
        errors.lot = "This plot is fully occupied. Choose a different lot.";
      }
    }
  }

  return errors;
}

export function validateStaff(input, db, editingId = null) {
  const errors = {};
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  if (!name) errors.name = "Enter the staff member's name.";
  if (!email) errors.email = "Enter an email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address, such as name@cemetery.example.";
  } else if (
    db.staff.some(
      (person) => person.email.toLowerCase() === email.toLowerCase() && person.id !== editingId,
    )
  ) {
    errors.email = "Another staff account already uses that email.";
  }
  if (!input.role) errors.role = "Choose a role.";
  return errors;
}

export function canAssignRole(actorRole, targetRole) {
  if (actorRole === "super_admin") return true;
  if (actorRole === "cemetery_admin") {
    return targetRole === "cemetery_admin" || targetRole === "cemetery_staff";
  }
  return false;
}

export function canEditStaff(actor, target) {
  if (!actor || !target) return false;
  if (actor.role === "super_admin") return true;
  if (actor.role === "cemetery_admin") return target.role !== "super_admin";
  return false;
}

export function activityText(entry, t) {
  const params = entry.params || {};
  switch (entry.type) {
    case "record.created":
      return t("{name} was registered.", params);
    case "record.updated":
      return t("The record for {name} was updated.", params);
    case "record.archived":
      return t("The record for {name} was archived.", params);
    case "map.saved":
      return t("A cemetery map draft was saved.");
    case "map.published":
      return t("The family cemetery map was published.");
    case "map.created":
      return t("Cemetery map {name} was created.", params);
    case "map.duplicated":
      return t("Cemetery map {name} was duplicated.", params);
    case "map.deleted":
      return t("Cemetery map {name} was moved to Trash.", params);
    case "map.restored":
      return t("Cemetery map {name} was restored.", params);
    case "map.purged":
      return t("Cemetery map {name} was permanently deleted.", params);
    case "record.deleted":
      return t("The record for {name} was moved to Trash.", params);
    case "record.restored":
      return t("The record for {name} was restored from Trash.", params);
    case "record.purged":
      return t("The record for {name} was permanently deleted.", params);
    case "trash.purged":
      return t("Trash retention removed {records} records and {maps} maps.", params);
    case "access.revoked":
      return t("An access code for {name} was revoked.", params);
    case "access.issued":
      return t("A new access code was issued for {name}.", params);
    case "plot.updated":
      return t("Plot {plot} was marked {status}.", params);
    case "plot.added":
      return t("{count} plots were added to Block {block}.", params);
    case "section.added":
      return t("{name} was added to the cemetery plan.", params);
    case "block.added":
      return t("Block {block} was added to {section}.", params);
    case "staff.added":
      return t("{name} was added to the staff list.", params);
    case "staff.updated":
      return t("The account for {name} was updated.", params);
    case "staff.login":
      return t("{name} signed in.", params);
    case "settings.updated":
      return t("Cemetery settings were saved.");
    default:
      return t("An administrative update was recorded.");
  }
}

export function notificationText(note, t) {
  const params = note.params || {};
  switch (note.type) {
    case "record.created":
      return {
        title: t("New registration"),
        body: t("{name} was added to the records.", params),
      };
    case "access.revoked":
      return {
        title: t("Access code revoked"),
        body: t("The family code for {name} is no longer active.", params),
      };
    case "code.expired":
      return {
        title: t("Access code expired"),
        body: t("The family code for {name} has expired.", params),
      };
    case "plot.reserved":
      return {
        title: t("Plot reserved"),
        body: t("{plot} was reserved.", params),
      };
    case "record.updated":
      return {
        title: t("Record updated"),
        body: t("The record for {name} was reviewed.", params),
      };
    default:
      return { title: t("Notice"), body: t("There is a new administrative update.") };
  }
}

export function activeCredential(db, recordId) {
  return db.credentials.find(
    (item) =>
      item.recordId === recordId &&
      item.status === "active" &&
      new Date(item.expiresAt).getTime() >= Date.now(),
  );
}

export function maskCode(code) {
  if (!code) return "";
  const parts = code.split("-");
  if (parts.length !== 3) return "••••••••";
  return `${parts[0]}-••••-••••`;
}
