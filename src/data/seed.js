export const DATA_VERSION = 1;

const SECTION_DEFS = [
  { id: "A", name: "Section A", description: "Garden of Peace" },
  { id: "B", name: "Section B", description: "Oak Grove" },
  { id: "C", name: "Section C", description: "Lily Court" },
  { id: "D", name: "Section D", description: "Memorial Lawn" },
];

const BLOCK_LABELS = ["01", "02", "03", "04"];

const RESERVED = ["A-01-010", "B-04-003", "C-03-014", "D-02-008", "A-02-024"];

const RECORD_DEFS = [
  ["GRV-2026-0001", "Maria", "", "Santos", "1945-04-12", "2021-08-17", "A-03-018", "single", "2021-08-21", "active", "GRV-8K29-XP41", "active"],
  ["GRV-2026-0002", "Roberto", "", "Cruz", "1950-09-21", "2023-02-14", "B-02-011", "single", "2023-02-18", "active", "GRV-5P72-LM83", "active"],
  ["GRV-2026-0003", "Elena", "Paz", "Reyes", "1938-01-30", "2019-11-02", "A-01-004", "single", "2019-11-06", "active", "GRV-3N18-QW55", "active"],
  ["GRV-2026-0004", "Jose", "Antonio", "Mercado", "1962-07-08", "2024-05-19", "C-04-021", "single", "2024-05-23", "active", "GRV-9T44-HK27", "active"],
  ["GRV-2026-0005", "Carmen", "", "Dela Cruz", "1932-12-03", "2016-03-28", "D-01-007", "single", "2016-04-02", "active", "GRV-2M61-VB90", "expired"],
  ["GRV-2026-0006", "Antonio", "Luis", "Flores", "1948-06-15", "2022-10-09", "B-03-015", "single", "2022-10-13", "active", "GRV-7C33-YD14", "active"],
  ["GRV-2026-0007", "Liza", "Marie", "Navarro", "1971-02-27", "2020-01-11", "A-04-002", "niche", "2020-01-18", "active", "GRV-4H88-PS62", "revoked"],
  ["GRV-2026-0008", "Pedro", "", "Villanueva", "1940-11-19", "2018-07-23", "C-02-009", "single", "2018-07-27", "active", "GRV-6R15-ZN47", "active"],
  ["GRV-2026-0009", "Rosa", "Isabel", "Aquino", "1955-05-06", "2024-12-01", "D-03-012", "single", "2024-12-05", "active", "GRV-1W90-EF28", "active"],
  ["GRV-2026-0010", "Miguel", "", "Bautista", "1936-08-14", "2015-09-30", "B-01-020", "single", "2015-10-04", "active", "GRV-8Q52-JT36", "active"],
  ["GRV-2026-0011", "Teresa", "Lourdes", "Gonzales", "1944-03-09", "2022-04-18", "A-02-016", "single", "2022-04-22", "active", "GRV-5L77-CA19", "active"],
  ["GRV-2026-0012", "Fernando", "Jose", "Ramos", "1958-10-25", "2025-06-07", "C-01-006", "single", "2025-06-11", "pending", "GRV-3D41-UM84", "active"],
  ["GRV-2026-0013", "Isabel", "", "Romero", "1942-02-02", "2020-08-08", "D-04-010", "companion", "2020-08-12", "active", "GRV-2H56-KP73", "active"],
  ["GRV-2026-0014", "Ramon", "", "Romero", "1940-01-16", "2019-12-12", "D-04-010", "companion", "2019-12-16", "active", "GRV-9M28-QW16", "active"],
];

function plotParts(plotId) {
  const [sectionId, block, lot] = plotId.split("-");
  return { sectionId, blockId: `${sectionId}-${block}`, lot };
}

export function createSeed() {
  const sections = SECTION_DEFS.map((section) => ({ ...section }));
  const blocks = [];
  const plots = [];

  sections.forEach((section) => {
    BLOCK_LABELS.forEach((label) => {
      const block = { id: `${section.id}-${label}`, sectionId: section.id, label };
      blocks.push(block);
      for (let number = 1; number <= 24; number += 1) {
        const lot = String(number).padStart(3, "0");
        const id = `${section.id}-${label}-${lot}`;
        plots.push({
          id,
          sectionId: section.id,
          blockId: block.id,
          lot,
          status: "available",
          capacity: 1,
          notes: "",
        });
      }
    });
  });

  const capacityByPlot = {};
  RECORD_DEFS.forEach((row) => {
    capacityByPlot[row[6]] = row[7] === "companion" ? 2 : row[7] === "estate" ? 4 : 1;
  });

  plots.forEach((plot) => {
    if (capacityByPlot[plot.id]) {
      plot.status = "occupied";
      plot.capacity = capacityByPlot[plot.id];
    } else if (RESERVED.includes(plot.id)) {
      plot.status = "reserved";
      plot.notes = "Held for a family arrangement.";
    }
  });

  const records = RECORD_DEFS.map((row, index) => ({
    id: row[0],
    firstName: row[1],
    middleName: row[2],
    lastName: row[3],
    birthDate: row[4],
    passingDate: row[5],
    photo: "",
    cemeteryId: "evergreen",
    plotId: row[6],
    burialType: row[7],
    burialDate: row[8],
    status: row[9],
    createdAt: new Date(Date.UTC(2026, index % 8, 4 + index, 2, 15)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 9, 8 + (index % 10), 3, 40)).toISOString(),
  }));

  const credentials = RECORD_DEFS.map((row, index) => {
    const status = row[11];
    const issuedAt = new Date(Date.UTC(2025, index % 6, 10, 1, 0)).toISOString();
    let expiresAt = new Date(Date.UTC(2027, index % 6, 10, 1, 0)).toISOString();
    let revokedAt = null;
    if (status === "expired") {
      expiresAt = "2025-04-01T00:00:00.000Z";
    }
    if (status === "revoked") {
      revokedAt = "2026-09-15T02:00:00.000Z";
    }
    return {
      id: `cred-${row[0].slice(-4)}`,
      recordId: row[0],
      code: row[10],
      status,
      issuedAt,
      expiresAt,
      revokedAt,
    };
  });

  return {
    version: DATA_VERSION,
    cemetery: {
      id: "evergreen",
      name: "Evergreen Memorial Park",
      address: "124 Acacia Drive, Quezon City",
      city: "Metro Manila, Philippines",
      phone: "+63 2 8123 4567",
      email: "visitors@evergreenmemorial.example",
      hours: "6:00 AM – 6:00 PM daily",
      description:
        "A landscaped memorial park with marked sections, walking paths, and a visitor pavilion.",
    },
    settings: {
      pageSize: 6,
      showPlotNumbers: true,
      sessionHours: 8,
      staffCanRegenerateCodes: false,
      codePrefix: "GRV",
      codeExpiryMonths: 12,
    },
    sections,
    blocks,
    plots,
    records,
    credentials,
    staff: [
      {
        id: "staff-amelia",
        name: "Amelia Cruz",
        email: "amelia.cruz@evergreen.example",
        role: "super_admin",
        status: "active",
        password: "grove-admin",
        lastActive: "2026-11-04T00:10:00.000Z",
      },
      {
        id: "staff-julian",
        name: "Julian Reyes",
        email: "julian.reyes@evergreen.example",
        role: "cemetery_admin",
        status: "active",
        password: "grove-records",
        lastActive: "2026-11-03T08:40:00.000Z",
      },
      {
        id: "staff-sofia",
        name: "Sofia Mendoza",
        email: "sofia.mendoza@evergreen.example",
        role: "cemetery_staff",
        status: "active",
        password: "grove-staff",
        lastActive: "2026-11-04T23:05:00.000Z",
      },
      {
        id: "staff-marco",
        name: "Marco Delgado",
        email: "marco.delgado@evergreen.example",
        role: "cemetery_staff",
        status: "deactivated",
        password: "grove-staff",
        lastActive: "2026-06-12T01:00:00.000Z",
      },
    ],
    activity: [
      {
        id: "act-1",
        type: "record.updated",
        params: { name: "Rosa Isabel Aquino" },
        actorId: "staff-julian",
        at: "2026-11-02T03:20:00.000Z",
      },
      {
        id: "act-2",
        type: "access.revoked",
        params: { name: "Liza Marie Navarro" },
        actorId: "staff-amelia",
        at: "2026-09-15T02:00:00.000Z",
      },
      {
        id: "act-3",
        type: "plot.updated",
        params: { plot: "A-01-010", status: "reserved" },
        actorId: "staff-julian",
        at: "2026-11-01T06:12:00.000Z",
      },
      {
        id: "act-4",
        type: "record.created",
        params: { name: "Fernando Jose Ramos" },
        actorId: "staff-sofia",
        at: "2026-06-12T04:00:00.000Z",
      },
      {
        id: "act-5",
        type: "staff.login",
        params: { name: "Amelia Cruz" },
        actorId: "staff-amelia",
        at: "2026-11-04T00:10:00.000Z",
      },
      {
        id: "act-6",
        type: "settings.updated",
        params: {},
        actorId: "staff-amelia",
        at: "2026-10-20T01:00:00.000Z",
      },
    ],
    notifications: [
      {
        id: "note-1",
        type: "code.expired",
        params: { name: "Carmen Dela Cruz" },
        at: "2026-11-02T01:00:00.000Z",
        read: false,
      },
      {
        id: "note-2",
        type: "plot.reserved",
        params: { plot: "Section A — Block 01 — Lot 010" },
        at: "2026-11-01T06:12:00.000Z",
        read: false,
      },
      {
        id: "note-3",
        type: "record.updated",
        params: { name: "Rosa Isabel Aquino" },
        at: "2026-10-28T03:05:00.000Z",
        read: true,
      },
    ],
  };
}

export function emptyRecord(cemeteryId = "evergreen") {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    birthDate: "",
    passingDate: "",
    photo: "",
    cemeteryId,
    sectionId: "",
    blockId: "",
    lot: "",
    burialType: "single",
    burialDate: "",
    status: "active",
  };
}

export function recordToForm(record, db) {
  const plot = db.plots.find((item) => item.id === record.plotId);
  const parts = plot ? plot : plotParts(record.plotId);
  return {
    firstName: record.firstName,
    middleName: record.middleName,
    lastName: record.lastName,
    birthDate: record.birthDate,
    passingDate: record.passingDate,
    photo: record.photo || "",
    cemeteryId: record.cemeteryId,
    sectionId: parts.sectionId,
    blockId: parts.blockId,
    lot: parts.lot,
    burialType: record.burialType,
    burialDate: record.burialDate,
    status: record.status,
  };
}
