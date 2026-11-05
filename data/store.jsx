import { createContext, useContext, useEffect, useRef, useState } from "react";
import { clearImages } from "./imageStore";
import {
  createMapDocument,
  getMapById,
  mapStats,
  migrateDb,
  primaryMapId,
  TRASH_RETENTION_MS,
} from "./mapModel";
import { cloneElements } from "../map/elementClone";
import { createSeed } from "./seed";
import {
  assessCode,
  canAssignRole,
  canEditStaff,
  capacityFor,
  findPlot,
  fullName,
  normalizeAccessCode,
  occupantsOf,
  validateRecord,
  validateStaff,
} from "../lib/records";

const STORAGE_KEY = "graveloc-db-v1";
const SESSION_LOCAL = "graveloc-session";
const SESSION_TAB = "graveloc-session-tab";
const FAMILY_KEY = "graveloc-family-session";

const AppContext = createContext(null);

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateDb(createSeed());
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.records)) return migrateDb(createSeed());
    return migrateDb(parsed);
  } catch {
    return migrateDb(createSeed());
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_LOCAL) || sessionStorage.getItem(SESSION_TAB);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadFamily() {
  try {
    const raw = sessionStorage.getItem(FAMILY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function nextRecordId(records) {
  const nums = records.map((record) => {
    const match = String(record.id).match(/(\d+)$/);
    return match ? Number.parseInt(match[1], 10) : 0;
  });
  const next = Math.max(0, ...nums) + 1;
  return `GRV-2026-${String(next).padStart(4, "0")}`;
}

function makeAccessCode(credentials, prefix = "GRV") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const clean = String(prefix || "GRV").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const safe = /^[A-Z0-9]{2,6}$/.test(clean) ? clean : "GRV";
  const chunk = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  let code = "";
  do {
    code = `${safe}-${chunk()}-${chunk()}`;
  } while (credentials.some((item) => normalizeAccessCode(item.code) === code));
  return code;
}

function addMonths(iso, months) {
  const date = new Date(iso);
  date.setMonth(date.getMonth() + Number(months || 12));
  return date.toISOString();
}

function makeActivity(type, params, actorId) {
  return { id: uid("act"), type, params, actorId: actorId || null, at: new Date().toISOString() };
}

function pushActivity(db, entry) {
  return [entry, ...db.activity].slice(0, 500);
}

function mapById(db, mapId) {
  return getMapById(db, mapId) || getMapById(db, primaryMapId(db));
}

export function AppProvider({ children }) {
  const [db, setDbState] = useState(loadDb);
  const [session, setSession] = useState(loadSession);
  const [familySession, setFamilySession] = useState(loadFamily);
  const dbRef = useRef(db);
  dbRef.current = db;

  function commit(next) {
    const migrated = migrateDb(next);
    dbRef.current = migrated;
    setDbState(migrated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return { ok: true };
    } catch {
      return { ok: false, error: "storage" };
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      /* Prototype storage can fill up if a large photo is saved. */
    }
  }, [db]);

  const currentStaff =
    db.staff.find((person) => person.id === session?.staffId && person.status === "active") || null;

  function can(action) {
    const role = currentStaff?.role;
    if (!role) return false;
    if (role === "super_admin") return true;
    const adminActions = new Set([
      "dashboard.view",
      "records.view",
      "records.create",
      "records.edit",
      "access.view",
      "access.viewFull",
      "access.revoke",
      "access.regenerate",
      "map.view",
      "map.edit",
      "staff.view",
      "staff.manage",
      "settings.cemetery",
      "settings.preferences",
      "settings.account",
      "settings.codes",
    ]);
    const staffActions = new Set([
      "dashboard.view",
      "records.view",
      "records.create",
      "records.edit",
      "access.view",
      "map.view",
      "settings.account",
    ]);
    if (db.settings.staffCanRegenerateCodes) staffActions.add("access.regenerate");
    if (role === "cemetery_admin") return adminActions.has(action);
    if (role === "cemetery_staff") return staffActions.has(action);
    return false;
  }

  function signOut() {
    localStorage.removeItem(SESSION_LOCAL);
    sessionStorage.removeItem(SESSION_TAB);
    setSession(null);
  }

  useEffect(() => {
    if (session && !currentStaff) signOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, currentStaff]);

  function signIn(email, password, remember) {
    const current = dbRef.current;
    const person = current.staff.find(
      (item) => item.email.toLowerCase() === String(email || "").trim().toLowerCase(),
    );
    if (!person || person.password !== password) {
      return { ok: false, error: "Those sign-in details do not match a staff account." };
    }
    if (person.status !== "active") {
      return {
        ok: false,
        error: "This staff account is deactivated. Ask a Super Administrator for help.",
      };
    }
    const nextSession = { staffId: person.id };
    localStorage.removeItem(SESSION_LOCAL);
    sessionStorage.removeItem(SESSION_TAB);
    const store = remember ? localStorage : sessionStorage;
    store.setItem(remember ? SESSION_LOCAL : SESSION_TAB, JSON.stringify(nextSession));
    setSession(nextSession);
    const now = new Date().toISOString();
    commit({
      ...current,
      staff: current.staff.map((item) =>
        item.id === person.id ? { ...item, lastActive: now } : item,
      ),
      activity: pushActivity(current, makeActivity("staff.login", { name: person.name }, person.id)),
    });
    return { ok: true, staff: person };
  }

  function signInWithRole(role) {
    const person = dbRef.current.staff.find((item) => item.role === role && item.status === "active");
    if (!person) return { ok: false, error: "That demonstration role is unavailable." };
    return signIn(person.email, person.password, true);
  }

  function verifyAndEnter(code) {
    const result = assessCode(dbRef.current, code);
    if (!result.ok) return result;
    const next = { recordId: result.record.id, credentialId: result.credential.id };
    sessionStorage.setItem(FAMILY_KEY, JSON.stringify(next));
    setFamilySession(next);
    return result;
  }

  function clearFamily() {
    sessionStorage.removeItem(FAMILY_KEY);
    setFamilySession(null);
  }

  function familyAccess(recordId) {
    if (!familySession || familySession.recordId !== recordId) return { ok: false, reason: "required" };
    const current = dbRef.current;
    const credential = current.credentials.find((item) => item.id === familySession.credentialId);
    const record = current.records.find((item) => item.id === recordId);
    if (!credential || !record) return { ok: false, reason: "required" };
    if (credential.status === "revoked") return { ok: false, reason: "revoked" };
    if (credential.status === "expired" || new Date(credential.expiresAt).getTime() < Date.now()) {
      return { ok: false, reason: "expired" };
    }
    if (credential.status !== "active") return { ok: false, reason: "inactive" };
    if (record.status === "archived") return { ok: false, reason: "unavailable" };
    return { ok: true, record, credential };
  }

  function createRecord(input) {
    const current = dbRef.current;
    const errors = validateRecord(input, current, null);
    if (Object.keys(errors).length) return { ok: false, errors };
    const plot = findPlot(current, input.sectionId, input.blockId, input.lot);
    const others = occupantsOf(current, plot.id);
    const capacity = others.length > 0 ? plot.capacity : capacityFor(input.burialType);
    const now = new Date().toISOString();
    const record = {
      id: nextRecordId(current.records),
      firstName: input.firstName.trim(),
      middleName: input.middleName.trim(),
      lastName: input.lastName.trim(),
      birthDate: input.birthDate,
      passingDate: input.passingDate,
      photo: input.photo || "",
      cemeteryId: current.cemetery.id,
      plotId: plot.id,
      burialType: input.burialType,
      burialDate: input.burialDate,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    const credential = {
      id: uid("cred"),
      recordId: record.id,
      code: makeAccessCode(current.credentials, current.settings.codePrefix || "GRV"),
      status: "active",
      issuedAt: now,
      expiresAt: addMonths(now, current.settings.codeExpiryMonths || 12),
      revokedAt: null,
    };
    const name = fullName(record);
    const saved = commit({
      ...current,
      records: [record, ...current.records],
      credentials: [credential, ...current.credentials],
      plots: current.plots.map((item) =>
        item.id === plot.id ? { ...item, status: "occupied", capacity } : item,
      ),
      activity: pushActivity(current, makeActivity("record.created", { name }, currentStaff?.id)),
      notifications: [
        { id: uid("note"), type: "record.created", params: { name }, at: now, read: false },
        ...current.notifications,
      ].slice(0, 30),
    });
    return { ok: true, record, credential, warning: saved.ok ? "" : "storage" };
  }

  function updateRecord(id, input) {
    const current = dbRef.current;
    const existing = current.records.find((item) => item.id === id);
    if (!existing) return { ok: false, errors: { form: "That record could not be found." } };
    const errors = validateRecord(input, current, id);
    if (Object.keys(errors).length) return { ok: false, errors };
    const plot = findPlot(current, input.sectionId, input.blockId, input.lot);
    const others = occupantsOf(current, plot.id, id);
    const capacity = others.length > 0 ? plot.capacity : capacityFor(input.burialType);
    const now = new Date().toISOString();
    const record = {
      ...existing,
      firstName: input.firstName.trim(),
      middleName: input.middleName.trim(),
      lastName: input.lastName.trim(),
      birthDate: input.birthDate,
      passingDate: input.passingDate,
      photo: input.photo || "",
      plotId: plot.id,
      burialType: input.burialType,
      burialDate: input.burialDate,
      status: input.status || existing.status,
      updatedAt: now,
    };
    let plots = current.plots.map((item) =>
      item.id === plot.id ? { ...item, status: "occupied", capacity } : item,
    );
    if (existing.plotId !== plot.id) {
      const remaining = occupantsOf(current, existing.plotId, id);
      if (remaining.length === 0) {
        plots = plots.map((item) =>
          item.id === existing.plotId ? { ...item, status: "available", capacity: 1 } : item,
        );
      }
    }
    const name = fullName(record);
    commit({
      ...current,
      records: current.records.map((item) => (item.id === id ? record : item)),
      plots,
      activity: pushActivity(current, makeActivity("record.updated", { name }, currentStaff?.id)),
    });
    return { ok: true, record };
  }

  function setPlotStatus(plotId, status) {
    const current = dbRef.current;
    const plot = current.plots.find((item) => item.id === plotId);
    if (!plot) return { ok: false, error: "That plot could not be found." };
    const occupants = occupantsOf(current, plotId);
    if (occupants.length > 0 && status !== "occupied") {
      return { ok: false, error: "assigned", occupants };
    }
    if (status === "occupied" && occupants.length === 0) {
      return { ok: false, error: "needs-record" };
    }
    const label = `${plot.sectionId}-${plot.blockId.split("-")[1]}-${plot.lot}`;
    commit({
      ...current,
      plots: current.plots.map((item) => (item.id === plotId ? { ...item, status } : item)),
      activity: pushActivity(
        current,
        makeActivity("plot.updated", { plot: label, status }, currentStaff?.id),
      ),
      notifications:
        status === "reserved"
          ? [
              {
                id: uid("note"),
                type: "plot.reserved",
                params: { plot: `Section ${plot.sectionId} — Block ${plot.blockId.split("-")[1]} — Lot ${plot.lot}` },
                at: new Date().toISOString(),
                read: false,
              },
              ...current.notifications,
            ].slice(0, 30)
          : current.notifications,
    });
    return { ok: true };
  }

  function updatePlotDetails(plotId, patch) {
    const current = dbRef.current;
    const plot = current.plots.find((item) => item.id === plotId);
    if (!plot) return { ok: false, error: "That plot could not be found." };
    const capacity = Number(patch.capacity);
    const occupants = occupantsOf(current, plotId);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 8) {
      return { ok: false, error: "Enter a capacity from 1 to 8." };
    }
    if (capacity < occupants.length) {
      return {
        ok: false,
        error: "Capacity cannot be lower than the number of people already assigned to this plot.",
      };
    }
    commit({
      ...current,
      plots: current.plots.map((item) =>
        item.id === plotId ? { ...item, capacity, notes: patch.notes?.slice(0, 180) || "" } : item,
      ),
    });
    return { ok: true };
  }

  function addSection(input) {
    const current = dbRef.current;
    const name = input.name?.trim();
    if (!name) return { ok: false, error: "Enter a section name." };
    const used = new Set(current.sections.map((section) => section.id));
    let id = "";
    for (let code = 65; code <= 90; code += 1) {
      const letter = String.fromCharCode(code);
      if (!used.has(letter)) {
        id = letter;
        break;
      }
    }
    if (!id) id = `S${current.sections.length + 1}`;
    const section = { id, name, description: input.description?.trim() || "New section" };
    commit({
      ...current,
      sections: [...current.sections, section],
      activity: pushActivity(current, makeActivity("section.added", { name }, currentStaff?.id)),
    });
    return { ok: true, section };
  }

  function addBlock(sectionId) {
    const current = dbRef.current;
    const section = current.sections.find((item) => item.id === sectionId);
    if (!section) return { ok: false, error: "Choose a section first." };
    const nums = current.blocks
      .filter((block) => block.sectionId === sectionId)
      .map((block) => Number(block.label))
      .filter((value) => !Number.isNaN(value));
    const label = String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, "0");
    const block = { id: `${sectionId}-${label}`, sectionId, label };
    commit({
      ...current,
      blocks: [...current.blocks, block],
      activity: pushActivity(
        current,
        makeActivity("block.added", { block: label, section: section.name }, currentStaff?.id),
      ),
    });
    return { ok: true, block };
  }

  function addPlots(input) {
    const current = dbRef.current;
    const block = current.blocks.find((item) => item.id === input.blockId);
    if (!block) return { ok: false, error: "Choose a block first." };
    const count = Number(input.count);
    if (!Number.isInteger(count) || count < 1 || count > 24) {
      return { ok: false, error: "Add between 1 and 24 plots at a time." };
    }
    const existing = current.plots.filter((plot) => plot.blockId === block.id).map((plot) => Number(plot.lot));
    let cursor = existing.length ? Math.max(...existing) : 0;
    const created = [];
    for (let index = 0; index < count; index += 1) {
      cursor += 1;
      const lot = String(cursor).padStart(3, "0");
      created.push({
        id: `${block.sectionId}-${block.label}-${lot}`,
        sectionId: block.sectionId,
        blockId: block.id,
        lot,
        status: input.status === "reserved" ? "reserved" : "available",
        capacity: 1,
        notes: "",
      });
    }
    commit({
      ...current,
      plots: [...current.plots, ...created],
      activity: pushActivity(
        current,
        makeActivity("plot.added", { count, block: block.label }, currentStaff?.id),
      ),
    });
    return { ok: true, created };
  }

  function revokeCredential(credentialId) {
    if (!can("access.revoke")) {
      return { ok: false, error: "You do not have permission to revoke access codes." };
    }
    const current = dbRef.current;
    const credential = current.credentials.find((item) => item.id === credentialId);
    if (!credential || credential.status !== "active") {
      return { ok: false, error: "Only an active access code can be revoked." };
    }
    const record = current.records.find((item) => item.id === credential.recordId);
    const now = new Date().toISOString();
    const name = fullName(record);
    commit({
      ...current,
      credentials: current.credentials.map((item) =>
        item.id === credentialId ? { ...item, status: "revoked", revokedAt: now } : item,
      ),
      activity: pushActivity(current, makeActivity("access.revoked", { name }, currentStaff?.id)),
      notifications: [
        { id: uid("note"), type: "access.revoked", params: { name }, at: now, read: false },
        ...current.notifications,
      ].slice(0, 30),
    });
    return { ok: true };
  }

  function regenerateCredential(recordId) {
    if (!can("access.regenerate")) {
      return { ok: false, error: "You do not have permission to issue access codes." };
    }
    const current = dbRef.current;
    const record = current.records.find((item) => item.id === recordId);
    if (!record) return { ok: false, error: "That record could not be found." };
    const now = new Date().toISOString();
    const credentials = current.credentials.map((item) =>
      item.recordId === recordId && item.status === "active"
        ? { ...item, status: "revoked", revokedAt: now }
        : item,
    );
    const credential = {
      id: uid("cred"),
      recordId,
      code: makeAccessCode(credentials, current.settings.codePrefix || "GRV"),
      status: "active",
      issuedAt: now,
      expiresAt: addMonths(now, current.settings.codeExpiryMonths || 12),
      revokedAt: null,
    };
    commit({
      ...current,
      credentials: [credential, ...credentials],
      activity: pushActivity(
        current,
        makeActivity("access.issued", { name: fullName(record) }, currentStaff?.id),
      ),
    });
    return { ok: true, credential };
  }

  function addStaff(input) {
    if (!can("staff.manage")) return { ok: false, errors: { form: "You cannot add staff accounts." } };
    const current = dbRef.current;
    const errors = validateStaff(input, current);
    if (!canAssignRole(currentStaff.role, input.role)) {
      errors.role = "You cannot assign that role.";
    }
    if (Object.keys(errors).length) return { ok: false, errors };
    const tempPassword = `Temp-${Math.random().toString(36).slice(2, 8)}`;
    const person = {
      id: uid("staff"),
      name: input.name.trim(),
      email: input.email.trim(),
      role: input.role,
      status: "active",
      password: tempPassword,
      lastActive: null,
    };
    commit({
      ...current,
      staff: [...current.staff, person],
      activity: pushActivity(current, makeActivity("staff.added", { name: person.name }, currentStaff?.id)),
    });
    return { ok: true, staff: person, tempPassword };
  }

  function updateStaff(id, patch) {
    const current = dbRef.current;
    const target = current.staff.find((item) => item.id === id);
    if (!target) return { ok: false, error: "That staff account could not be found." };
    if (!canEditStaff(currentStaff, target)) {
      return { ok: false, error: "You do not have permission to manage this account." };
    }
    if (patch.role && !canAssignRole(currentStaff.role, patch.role)) {
      return { ok: false, error: "You cannot assign that role." };
    }
    const next = {
      ...target,
      name: patch.name?.trim() || target.name,
      email: patch.email?.trim() || target.email,
      role: patch.role || target.role,
      status: patch.status || target.status,
    };
    const emailErrors = validateStaff(next, current, id);
    if (emailErrors.email || emailErrors.name) return { ok: false, errors: emailErrors };
    const otherSupers = current.staff.filter(
      (item) => item.id !== id && item.role === "super_admin" && item.status === "active",
    );
    const remainsSuper = next.role === "super_admin" && next.status === "active";
    if (otherSupers.length === 0 && !remainsSuper) {
      return { ok: false, error: "Keep at least one active Super Administrator." };
    }
    if (currentStaff?.id === id && next.status !== "active") {
      return { ok: false, error: "You cannot deactivate your own account." };
    }
    commit({
      ...current,
      staff: current.staff.map((item) => (item.id === id ? next : item)),
      activity: pushActivity(current, makeActivity("staff.updated", { name: next.name }, currentStaff?.id)),
    });
    return { ok: true, staff: next };
  }

  function updateSettings(patch) {
    const current = dbRef.current;
    commit({
      ...current,
      settings: { ...current.settings, ...patch },
      activity: pushActivity(current, makeActivity("settings.updated", {}, currentStaff?.id)),
    });
    return { ok: true };
  }

  function updateCemetery(patch) {
    const current = dbRef.current;
    commit({
      ...current,
      cemetery: { ...current.cemetery, ...patch },
      activity: pushActivity(current, makeActivity("settings.updated", {}, currentStaff?.id)),
    });
    return { ok: true };
  }

  function updateAccount(patch) {
    const current = dbRef.current;
    if (!currentStaff) return { ok: false, error: "Sign in again to update your account." };
    const errors = validateStaff(
      { ...currentStaff, name: patch.name, email: patch.email, role: currentStaff.role },
      current,
      currentStaff.id,
    );
    if (errors.name || errors.email) return { ok: false, errors };
    commit({
      ...current,
      staff: current.staff.map((item) =>
        item.id === currentStaff.id
          ? { ...item, name: patch.name.trim(), email: patch.email.trim() }
          : item,
      ),
    });
    return { ok: true };
  }

  function markAllNotificationsRead() {
    const current = dbRef.current;
    commit({
      ...current,
      notifications: current.notifications.map((item) => ({ ...item, read: true })),
    });
  }

  function archiveRecord(id) {
    const current = dbRef.current;
    const existing = current.records.find((item) => item.id === id);
    if (!existing) return { ok: false, error: "That record could not be found." };
    if (existing.status === "archived") return { ok: true };
    const now = new Date().toISOString();
    const name = fullName(existing);
    commit({
      ...current,
      records: current.records.map((item) =>
        item.id === id ? { ...item, status: "archived", updatedAt: now } : item,
      ),
      activity: pushActivity(current, makeActivity("record.archived", { name }, currentStaff?.id)),
    });
    return { ok: true };
  }

  function syncLegacyCustom(maps) {
    return maps[0] || createMapDocument();
  }

  function saveMapDraft(mapId, patch) {
    const current = dbRef.current;
    const now = new Date().toISOString();
    const maps = current.maps.map((item) => {
      if (item.id !== mapId) return item;
      return {
        ...item,
        name: patch.name || item.name,
        description: patch.description ?? item.description,
        familyDefaultAerial: Boolean(patch.familyDefaultAerial),
        background: { ...item.background, ...(patch.background || {}) },
        scale: { ...item.scale, ...(patch.scale || {}) },
        draft: { elements: Array.isArray(patch.elements) ? patch.elements : item.draft.elements },
        updatedAt: now,
        version: (item.version || 1) + 1,
      };
    });
    const saved = commit({
      ...current,
      maps,
      customMap: syncLegacyCustom(maps),
      activity: pushActivity(current, makeActivity("map.saved", { name: patch.name || mapId }, currentStaff?.id)),
    });
    return saved.ok ? { ok: true, map: mapById({ ...current, maps }, mapId) } : { ok: false, error: "storage" };
  }

  function publishMap(mapId) {
    const current = dbRef.current;
    const map = mapById(current, mapId);
    if (!map) return { ok: false, error: "That map could not be found." };
    const now = new Date().toISOString();
    const snapshot = {
      name: map.name,
      familyDefaultAerial: map.familyDefaultAerial,
      background: map.background,
      scale: map.scale,
      elements: map.draft.elements,
      publishedAt: now,
      version: (map.published?.version || 0) + 1,
    };
    const maps = current.maps.map((item) =>
      item.id === mapId
        ? { ...item, published: snapshot, previousPublished: item.published, status: "published", updatedAt: now }
        : item,
    );
    const saved = commit({
      ...current,
      maps,
      customMap: syncLegacyCustom(maps),
      activity: pushActivity(current, makeActivity("map.published", { name: map.name }, currentStaff?.id)),
    });
    return saved.ok ? { ok: true } : { ok: false, error: "storage" };
  }

  function restorePublishedMap(mapId) {
    const current = dbRef.current;
    const map = mapById(current, mapId);
    const previous = map?.previousPublished;
    if (!previous) return { ok: false, error: "There is no earlier published map to restore." };
    const maps = current.maps.map((item) =>
      item.id === mapId ? { ...item, published: previous, previousPublished: item.published, updatedAt: new Date().toISOString() } : item,
    );
    commit({
      ...current,
      maps,
      customMap: syncLegacyCustom(maps),
      activity: pushActivity(current, makeActivity("map.published", { name: map.name }, currentStaff?.id)),
    });
    return { ok: true };
  }

  function createMap(input) {
    const current = dbRef.current;
    const doc = createMapDocument({
      cemeteryId: input.cemeteryId || current.cemetery.id,
      name: input.name?.trim() || "New cemetery map",
      description: input.description?.trim() || "",
      mapType: input.mapType || "other",
    });
    if (input.background) doc.background = { ...doc.background, ...input.background };
    const maps = [...current.maps, doc];
    commit({
      ...current,
      maps,
      customMap: syncLegacyCustom(maps),
      activity: pushActivity(current, makeActivity("map.created", { name: doc.name }, currentStaff?.id)),
    });
    return { ok: true, map: doc };
  }

  function duplicateMap(mapId) {
    const current = dbRef.current;
    const source = mapById(current, mapId);
    if (!source) return { ok: false, error: "That map could not be found." };
    const copy = createMapDocument({
      cemeteryId: source.cemeteryId,
      name: `${source.name} (copy)`,
      description: source.description,
      mapType: source.mapType,
    });
    copy.background = { ...source.background };
    copy.scale = { ...source.scale };
    copy.draft = {
      elements: cloneElements(source.draft.elements || []).map((element) => ({
        ...element,
        refId: element.type === "plot" ? "" : element.refId,
      })),
    };
    copy.familyDefaultAerial = source.familyDefaultAerial;
    const maps = [...current.maps, copy];
    commit({
      ...current,
      maps,
      customMap: syncLegacyCustom(maps),
      activity: pushActivity(current, makeActivity("map.duplicated", { name: copy.name }, currentStaff?.id)),
    });
    return { ok: true, map: copy };
  }

  function deleteMap(mapId, mode = "preserve-records") {
    const current = dbRef.current;
    const map = mapById(current, mapId);
    if (!map) return { ok: false, error: "That map could not be found." };
    const stats = mapStats(map);
    const now = new Date().toISOString();
    const plotRefIds = new Set(
      [...(map.draft?.elements || []), ...(map.published?.elements || [])]
        .filter((element) => element.type === "plot" && element.refId)
        .map((element) => element.refId),
    );
    const records =
      mode === "preserve-records" && plotRefIds.size
        ? current.records.map((record) =>
            plotRefIds.has(record.plotId) ? { ...record, needsPlotReassignment: true, updatedAt: now } : record,
          )
        : current.records;
    const trashEntry = {
      id: map.id,
      map: JSON.parse(JSON.stringify(map)),
      deletedAt: now,
      deletedBy: currentStaff?.id || null,
      mode,
      stats,
    };
    const maps = current.maps.filter((item) => item.id !== mapId);
    commit({
      ...current,
      records,
      maps,
      customMap: syncLegacyCustom(maps),
      trash: { ...current.trash, maps: [trashEntry, ...(current.trash?.maps || [])] },
      activity: pushActivity(current, makeActivity("map.deleted", { name: map.name, mode }, currentStaff?.id)),
    });
    return { ok: true };
  }

  function restoreMapFromTrash(trashId) {
    const current = dbRef.current;
    const entry = (current.trash?.maps || []).find((item) => item.id === trashId);
    if (!entry) return { ok: false, error: "That deleted map could not be found." };
    if (current.maps.some((item) => item.id === entry.id)) {
      return { ok: false, error: "A map with this ID already exists. Rename or permanently delete the conflicting map first." };
    }
    const maps = [...current.maps, entry.map];
    commit({
      ...current,
      maps,
      customMap: syncLegacyCustom(maps),
      trash: { ...current.trash, maps: current.trash.maps.filter((item) => item.id !== trashId) },
      activity: pushActivity(current, makeActivity("map.restored", { name: entry.map.name }, currentStaff?.id)),
    });
    return { ok: true };
  }

  function permanentDeleteMap(trashId) {
    const current = dbRef.current;
    const entry = (current.trash?.maps || []).find((item) => item.id === trashId);
    if (!entry) return { ok: false, error: "That deleted map could not be found." };
    commit({
      ...current,
      trash: { ...current.trash, maps: current.trash.maps.filter((item) => item.id !== trashId) },
      activity: pushActivity(current, makeActivity("map.purged", { name: entry.map.name }, currentStaff?.id)),
    });
    return { ok: true };
  }

  function moveRecordToTrash(recordId) {
    const current = dbRef.current;
    const record = current.records.find((item) => item.id === recordId);
    if (!record) return { ok: false, error: "That record could not be found." };
    const now = new Date().toISOString();
    const name = fullName(record);
    const credentials = current.credentials.filter((item) => item.recordId === recordId);
    commit({
      ...current,
      records: current.records.filter((item) => item.id !== recordId),
      credentials: current.credentials.map((item) =>
        item.recordId === recordId ? { ...item, status: "revoked", revokedAt: now } : item,
      ),
      trash: {
        ...current.trash,
        records: [
          {
            id: record.id,
            record,
            credentials,
            deletedAt: now,
            deletedBy: currentStaff?.id || null,
            purgeAfter: new Date(Date.now() + TRASH_RETENTION_MS).toISOString(),
          },
          ...(current.trash?.records || []),
        ],
      },
      activity: pushActivity(current, makeActivity("record.deleted", { name }, currentStaff?.id)),
    });
    return { ok: true };
  }

  function restoreRecordFromTrash(recordId, reactivateCodes = false) {
    const current = dbRef.current;
    const entry = (current.trash?.records || []).find((item) => item.id === recordId);
    if (!entry) return { ok: false, error: "That deleted record could not be found." };
    if (current.records.some((item) => item.id === recordId)) {
      return { ok: false, error: "An active record with this ID already exists." };
    }
    const plot = current.plots.find((item) => item.id === entry.record.plotId);
    const occupants = occupantsOf(current, plot?.id || "");
    if (plot && plot.status === "occupied" && occupants.length > 0) {
      return { ok: false, error: "The original burial plot is occupied by another record. Reassign the plot before restoring." };
    }
    const now = new Date().toISOString();
    const credentials = entry.credentials.map((item) => {
      if (!reactivateCodes) return item;
      const expired = new Date(item.expiresAt).getTime() < Date.now();
      if (item.status === "revoked" || expired) return item;
      return { ...item, status: "active", revokedAt: null };
    });
    commit({
      ...current,
      records: [{ ...entry.record, updatedAt: now }, ...current.records],
      credentials: [
        ...current.credentials.filter((item) => item.recordId !== recordId),
        ...credentials,
      ],
      trash: { ...current.trash, records: current.trash.records.filter((item) => item.id !== recordId) },
      activity: pushActivity(current, makeActivity("record.restored", { name: fullName(entry.record) }, currentStaff?.id)),
    });
    return { ok: true };
  }

  function permanentDeleteRecord(recordId) {
    const current = dbRef.current;
    const entry = (current.trash?.records || []).find((item) => item.id === recordId);
    if (!entry) return { ok: false, error: "That deleted record could not be found." };
    commit({
      ...current,
      trash: { ...current.trash, records: current.trash.records.filter((item) => item.id !== recordId) },
      activity: pushActivity(current, makeActivity("record.purged", { name: fullName(entry.record) }, currentStaff?.id)),
    });
    return { ok: true };
  }

  function updateEditorPrefs(patch) {
    const current = dbRef.current;
    commit({
      ...current,
      editorPrefs: { ...current.editorPrefs, ...patch },
    });
    return { ok: true };
  }

  function resetDemo() {
    clearImages().catch(() => {});
    commit(migrateDb(createSeed()));
  }

  const value = {
    db,
    currentStaff,
    familySession,
    can,
    signIn,
    signInWithRole,
    signOut,
    verifyAndEnter,
    clearFamily,
    familyAccess,
    createRecord,
    updateRecord,
    archiveRecord,
    saveMapDraft,
    publishMap,
    restorePublishedMap,
    createMap,
    duplicateMap,
    deleteMap,
    restoreMapFromTrash,
    permanentDeleteMap,
    moveRecordToTrash,
    restoreRecordFromTrash,
    permanentDeleteRecord,
    updateEditorPrefs,
    setPlotStatus,
    updatePlotDetails,
    addSection,
    addBlock,
    addPlots,
    revokeCredential,
    regenerateCredential,
    addStaff,
    updateStaff,
    updateSettings,
    updateCemetery,
    updateAccount,
    markAllNotificationsRead,
    resetDemo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
