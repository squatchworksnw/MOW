const STORAGE_KEY = "remodel-tracker-v1";
const DRAFT_KEY = "remodel-tracker-drafts-v1";
const BACKEND_URL_KEY = "remodel-tracker-backend-url-v1";
const AUTO_SYNC_KEY = "remodel-tracker-auto-sync-v1";
const AUTO_LOAD_KEY = "remodel-tracker-auto-load-v1";
const DEFAULT_BACKEND_URL = "https://script.google.com/macros/s/AKfycbyc6TGdgu4U9LHF8zomL-c8SBk7zfmmruOExRMfBlTaonALcIwPS8wASAzupT5ipcjFzw/exec";
const APP_VERSION = "mowfac-ops-1.0.0";
const CURRENT_BACKEND_GENERATION = "2026-04-29-v3";
const DEVICE_ID_KEY = "mowfac-device-id-v1";
const STALE_SYNC_MS = 60_000;
const MAX_SYNCED_QUEUE_ITEMS = 25;
const SYNCED_COLLECTIONS = [
  "rooms",
  "tasks",
  "materials",
  "bids",
  "expenses",
  "decisions",
  "maintenanceCalendar",
  "recurringMaintenance",
  "fleetSchedule",
  "fleetVehicles",
  "mileageLog",
  "repairLog",
  "walkthroughChecklist",
  "facilitiesInstructions",
  "contractorLibrary",
  "equipment"
];

const seedData = {
  projectName: "Kitchen and Bath Remodel",
  targetDate: "2026-08-28",
  expectedDuration: "14 weeks",
  projects: [
    { id: "default-project", name: "Kitchen and Bath Remodel", status: "Active", createdAt: "2026-04-29T00:00:00.000Z", updatedAt: "2026-04-29T00:00:00.000Z" }
  ],
  rooms: [
    { id: crypto.randomUUID(), name: "Kitchen", budget: 42000, sqft: 240, duration: "8 weeks", status: "Planning" },
    { id: crypto.randomUUID(), name: "Primary Bath", budget: 28000, sqft: 95, duration: "6 weeks", status: "In progress" },
    { id: crypto.randomUUID(), name: "Laundry", budget: 9000, sqft: 55, duration: "2 weeks", status: "Waiting" }
  ],
  tasks: [
    { id: crypto.randomUUID(), projectId: "default-project", title: "Finalize cabinet layout", room: "Kitchen", start: "2026-05-06", due: "2026-05-08", duration: "3 days", priority: "High", estimatedCost: 0, contractorCost: 0, notes: "", attachments: [], history: [], status: "Doing" },
    { id: crypto.randomUUID(), projectId: "default-project", title: "Confirm shower tile lead time", room: "Primary Bath", start: "2026-05-13", due: "2026-05-13", duration: "1 day", priority: "Normal", estimatedCost: 0, contractorCost: 0, notes: "", attachments: [], history: [], status: "Todo" },
    { id: crypto.randomUUID(), projectId: "default-project", title: "Schedule rough plumbing walk-through", room: "Laundry", start: "2026-05-20", due: "2026-05-20", duration: "2 hours", priority: "Normal", estimatedCost: 0, contractorCost: 0, notes: "", attachments: [], history: [], status: "Blocked" }
  ],
  materials: [],
  bids: [
    {
      id: crypto.randomUUID(),
      contractor: "Northline Build Co.",
      amount: 76500,
      timeline: "10 weeks",
      included: "Labor, rough materials, cabinets install, tile labor",
      exclusions: "Appliances, decorative lighting, permit fees",
      contact: "alex@northline.example",
      status: "Considering"
    },
    {
      id: crypto.randomUUID(),
      contractor: "Harbor House Renovation",
      amount: 82750,
      timeline: "8 weeks",
      included: "Labor, project management, finish carpentry, tile labor",
      exclusions: "Cabinets, fixtures, unknown subfloor repairs",
      contact: "555-0144",
      status: "Favorite"
    }
  ],
  expenses: [
    { id: crypto.randomUUID(), item: "Cabinet allowance", amount: 18500, type: "Estimate" },
    { id: crypto.randomUUID(), item: "Tile deposit", amount: 2400, type: "Committed" },
    { id: crypto.randomUUID(), item: "Design consult", amount: 950, type: "Paid" }
  ],
  decisions: [
    { id: crypto.randomUUID(), title: "Quartz vs. porcelain countertop", owner: "Beeja", status: "Researching" },
    { id: crypto.randomUUID(), title: "Keep tub or convert to shower", owner: "Beeja", status: "Open" }
  ],
  maintenanceCalendar: [],
  recurringMaintenance: [],
  fleetSchedule: [],
  fleetVehicles: [],
  equipment: [],
  mileageLog: [],
  repairLog: [],
  walkthroughChecklist: [],
  facilitiesInstructions: [],
  documentIntake: [],
  contractorLibrary: [],
  extractedLineItems: [],
  syncLog: [],
  reports: [],
  appSettings: { activeProjectId: "default-project", editMode: false },
  syncMeta: {
    lastUpdated: "",
    lastSyncedAt: "",
    updatedByDevice: "",
    appVersion: APP_VERSION,
    syncId: crypto.randomUUID(),
    unsyncedChanges: 0,
    status: "Saved"
  }
};

let state = normalizeState(loadState());
let activeMaterialTaskId = "";
let activeTaskRoomFilter = "";
let draftRestorePending = true;
let saveStatusTimer;
let autoSyncTimer;
let autosaveTimer;
let isCloudSyncing = false;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const formCollections = {
  roomForm: "rooms",
  taskForm: "tasks",
  bidForm: "bids",
  expenseForm: "expenses",
  decisionForm: "decisions",
  contractorLibraryForm: "contractorLibrary",
  equipmentForm: "equipment"
};

const submitText = {
  roomForm: "Save",
  taskForm: "Save",
  bidForm: "Save",
  expenseForm: "Save",
  decisionForm: "Save",
  contractorLibraryForm: "Save",
  equipmentForm: "Save"
};

const pageFormActions = {
  roomForm: { label: "Room actions", addLabel: "Add room" },
  taskForm: { label: "Task actions", addLabel: "Add task" },
  bidForm: { label: "Bid actions", addLabel: "Add bid" },
  expenseForm: { label: "Budget actions", addLabel: "Add cost" },
  decisionForm: { label: "Decision actions", addLabel: "Add decision" },
  equipmentForm: { label: "Equipment actions", addLabel: "Add equipment" },
  contractorLibraryForm: { label: "Contractor actions", addLabel: "Add contractor" }
};

const cycles = {
  rooms: ["Planning", "In progress", "Waiting", "Done"],
  tasks: ["Todo", "Doing", "Blocked", "Done"],
  materials: ["Needed", "Quoted", "Ordered", "Received"],
  maintenanceCalendar: ["Scheduled", "In progress", "Complete", "Skipped"],
  equipment: ["Active", "Service Due", "Needs Repair", "Out of Service", "Retired"],
  repairLog: ["Open", "Assessing", "Need quote", "Scheduled", "In progress", "Waiting", "Complete"],
  bids: ["Considering", "Need details", "Favorite", "Declined"],
  expenses: ["Estimate", "Committed", "Paid"],
  decisions: ["Open", "Researching", "Decided"],
  contractorLibrary: ["Active", "Preferred", "Needs Follow-Up", "Do Not Use"]
};

const facilityFilters = {
  maintenanceLocation: "",
  maintenanceFrequency: "",
  maintenanceStatus: "",
  recurringLocation: "",
  recurringFrequency: "",
  recurringAssigned: "",
  fleetVehicle: "",
  fleetStatus: "",
  mileageVehicle: "",
  repairStatus: "",
  walkthroughLocation: "",
  walkthroughStatus: ""
};

let activeFacilityReport = "";
let activeCustomReport = false;
let pendingDocumentReview = null;

function initializeSupabaseClient() {
  const config = window.MOWFAC_SUPABASE_CONFIG || {};
  const url = config.url || "";
  const anonKey = config.anonKey || "";

  if (!url || !anonKey || url.includes("YOUR-PROJECT-REF") || anonKey.includes("YOUR_PUBLIC_ANON_KEY")) {
    console.warn("Supabase is not configured. Rooms will stay saved locally until config.js is filled in.");
    return null;
  }

  if (!window.supabase?.createClient) {
    console.warn("Supabase library is not loaded. Rooms will stay saved locally.");
    return null;
  }

  window.supabaseClient = window.supabase.createClient(url, anonKey);
  return window.supabaseClient;
}

initializeSupabaseClient();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : structuredClone(seedData);
  } catch (error) {
    return structuredClone(seedData);
  }
}

function normalizeState(data) {
  const projects = (data.projects && data.projects.length ? data.projects : seedData.projects).map(normalizeProject);
  const activeProjectId = data.appSettings?.activeProjectId || projects[0]?.id || "default-project";
  const syncMeta = {
    ...structuredClone(seedData.syncMeta),
    ...(data.syncMeta || {}),
    appVersion: APP_VERSION,
    updatedByDevice: data.syncMeta?.updatedByDevice || getDeviceId()
  };
  return {
    ...structuredClone(seedData),
    ...data,
    expectedDuration: data.expectedDuration || "Time TBD",
    projects,
    rooms: (data.rooms || []).map((room) => ({ sqft: 0, duration: "Time TBD", ...room })),
    tasks: (data.tasks || []).map((task) => normalizeTaskItem(task, activeProjectId)),
    materials: data.materials || [],
    bids: (data.bids || []).map(normalizeBid),
    expenses: data.expenses || [],
    decisions: data.decisions || [],
    maintenanceCalendar: (data.maintenanceCalendar || []).map(normalizeMaintenanceCalendarItem),
    recurringMaintenance: (data.recurringMaintenance || []).map(normalizeRecurringMaintenanceItem),
    fleetSchedule: (data.fleetSchedule || []).map(normalizeFleetScheduleItem),
    fleetVehicles: (data.fleetVehicles || []).map(normalizeFleetVehicleItem),
    equipment: (data.equipment || []).map(normalizeEquipmentItem),
    mileageLog: (data.mileageLog || []).map(normalizeMileageLogItem),
    repairLog: (data.repairLog || []).map((item) => normalizeRepairLogItem(item, activeProjectId)),
    walkthroughChecklist: (data.walkthroughChecklist || []).map(normalizeWalkthroughItem),
    facilitiesInstructions: (data.facilitiesInstructions || []).map(normalizeFacilityInstruction),
    documentIntake: (data.documentIntake || []).map(normalizeDocumentRecord),
    contractorLibrary: (data.contractorLibrary || []).map(normalizeContractorRecord),
    extractedLineItems: (data.extractedLineItems || []).map(normalizeLineItem),
    syncLog: (data.syncLog || []).map(normalizeSyncLogItem),
    reports: data.reports || [],
    appSettings: { ...(data.appSettings || {}), activeProjectId, editMode: Boolean(data.appSettings?.editMode) },
    syncMeta
  };
}

function normalizeProject(item = {}) {
  const now = new Date().toISOString();
  return {
    id: item.id || crypto.randomUUID(),
    name: item.name || item.projectName || "Untitled Project",
    status: item.status || "Active",
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
    notes: item.notes || ""
  };
}

function normalizeTaskItem(task = {}, fallbackProjectId = getActiveProjectId()) {
  const now = new Date().toISOString();
  return {
    id: task.id || crypto.randomUUID(),
    projectId: task.projectId || fallbackProjectId,
    title: task.title || "",
    room: task.room || "",
    start: normalizeDateValue(task.start || task.due),
    due: normalizeDateValue(task.due),
    duration: task.duration || "Time TBD",
    priority: task.priority || "Normal",
    estimatedCost: Number(task.estimatedCost || 0),
    contractorCost: Number(task.contractorCost || 0),
    notes: task.notes || "",
    attachments: (task.attachments || []).map(normalizeAttachment),
    history: task.history || [],
    lastUpdated: task.lastUpdated || task.updatedAt || now,
    status: task.status || "Todo"
  };
}

function normalizeAttachment(item = {}) {
  return {
    id: item.id || crypto.randomUUID(),
    fileName: item.fileName || item.name || "",
    fileUrl: item.fileUrl || item.sourceFileUrl || "",
    uploadDate: item.uploadDate || new Date().toISOString(),
    relatedProjectId: item.relatedProjectId || item.projectId || "default-project",
    relatedTaskId: item.relatedTaskId || item.taskId || "",
    type: item.type || "PDF"
  };
}

function baseRecord(item = {}) {
  const now = new Date().toISOString();
  return {
    id: item.id || item.documentId || crypto.randomUUID(),
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
    updatedByDevice: item.updatedByDevice || getDeviceId(),
    status: item.status || "",
    notes: item.notes || ""
  };
}

function normalizeMaintenanceCalendarItem(item) {
  return {
    id: item.id || crypto.randomUUID(),
    date: normalizeDateValue(item.date),
    task: item.task || "",
    frequency: item.frequency || inferFrequency(item.task || ""),
    location: item.location || inferLocation(item.task || ""),
    category: item.category || inferCategory(item.task || ""),
    status: item.status || "Scheduled",
    notes: item.notes || ""
  };
}

function normalizeRecurringMaintenanceItem(item) {
  return {
    id: item.id || crypto.randomUUID(),
    frequency: item.frequency || "",
    locationArea: item.locationArea || "",
    task: item.task || "",
    assignedTo: item.assignedTo || "",
    timing: item.timing || "",
    notes: item.notes || ""
  };
}

function normalizeFleetScheduleItem(item) {
  return {
    id: item.id || crypto.randomUUID(),
    frequency: item.frequency || "",
    task: item.task || "",
    appliesTo: item.appliesTo || "",
    suggestedTiming: item.suggestedTiming || "",
    wearTearItems: item.wearTearItems || "",
    trigger: item.trigger || "",
    assignedTo: item.assignedTo || "",
    notes: item.notes || ""
  };
}

function normalizeFleetVehicleItem(item) {
  return {
    id: item.id || crypto.randomUUID(),
    vehicle: item.vehicle || "",
    type: item.type || "",
    plateVin: item.plateVin || "",
    currentMileage: toNumberOrBlank(item.currentMileage),
    lastOilChangeMileage: toNumberOrBlank(item.lastOilChangeMileage),
    nextOilChangeDue: item.nextOilChangeDue || "",
    lastTireRotation: item.lastTireRotation || "",
    nextTireRotationDue: item.nextTireRotationDue || "",
    lastServiceDate: normalizeDateValue(item.lastServiceDate),
    status: item.status || "",
    notes: item.notes || ""
  };
}

function normalizeMileageLogItem(item) {
  const startMileage = toNumberOrBlank(item.startMileage);
  const endMileage = toNumberOrBlank(item.endMileage);
  return {
    id: item.id || crypto.randomUUID(),
    date: normalizeDateValue(item.date),
    vehicle: item.vehicle || "",
    startMileage,
    endMileage,
    milesDriven: item.milesDriven !== "" && item.milesDriven != null ? Number(item.milesDriven) : calculateMilesDriven(startMileage, endMileage),
    driverInitials: item.driverInitials || "",
    notes: item.notes || ""
  };
}

function normalizeRepairLogItem(item, fallbackProjectId = getActiveProjectId()) {
  const now = new Date().toISOString();
  return {
    id: item.id || crypto.randomUUID(),
    projectId: item.projectId || fallbackProjectId,
    date: normalizeDateValue(item.date),
    areaSystemVehicle: item.areaSystemVehicle || "",
    issue: item.issue || "",
    actionTaken: item.actionTaken || "",
    contractorVendor: item.contractorVendor || "",
    cost: Number(item.cost || 0),
    estimatedCost: Number(item.estimatedCost || item.cost || 0),
    contractorCost: Number(item.contractorCost || item.cost || 0),
    priority: item.priority || "Normal",
    status: item.status || "",
    followUpDate: normalizeDateValue(item.followUpDate),
    notes: item.notes || "",
    attachments: (item.attachments || []).map(normalizeAttachment),
    history: item.history || [],
    lastUpdated: item.lastUpdated || item.updatedAt || now
  };
}

function normalizeWalkthroughItem(item) {
  return {
    id: item.id || crypto.randomUUID(),
    location: item.location || "",
    checkArea: item.checkArea || "",
    itemToInspect: item.itemToInspect || "",
    status: item.status || "",
    notesFollowUp: item.notesFollowUp || ""
  };
}

function normalizeFacilityInstruction(item) {
  return {
    id: item.id || crypto.randomUUID(),
    topic: item.topic || "",
    instruction: item.instruction || ""
  };
}

function normalizeDocumentRecord(item) {
  const base = baseRecord(item);
  return {
    ...base,
    documentId: item.documentId || base.id,
    contractorVendor: item.contractorVendor || item.vendorName || "",
    uploadDate: normalizeDateValue(item.uploadDate) || todayDateString(),
    uploadedByDevice: item.uploadedByDevice || item.updatedByDevice || getDeviceId(),
    originalFileName: item.originalFileName || item.sourceFileName || "",
    documentType: item.documentType || "Other",
    projectRoomCategory: item.projectRoomCategory || item.category || "",
    sourceFileUrl: item.sourceFileUrl || "",
    sourceFileName: item.sourceFileName || item.originalFileName || "",
    extracted: item.extracted || {}
  };
}

function normalizeContractorRecord(item) {
  return {
    ...baseRecord(item),
    name: item.name || item.contractorVendor || "",
    contactPerson: item.contactPerson || "",
    phone: item.phone || "",
    email: item.email || "",
    address: item.address || "",
    licenseNumber: item.licenseNumber || "",
    insuranceStatus: item.insuranceStatus || "",
    servicesOffered: item.servicesOffered || "",
    pastBids: item.pastBids || "",
    pastInvoices: item.pastInvoices || "",
    status: item.status || "Active",
    notes: item.notes || ""
  };
}

function normalizeLineItem(item) {
  return {
    ...baseRecord(item),
    documentId: item.documentId || "",
    description: item.description || "",
    quantity: item.quantity || "",
    unitCost: Number(item.unitCost || 0),
    totalCost: Number(item.totalCost || 0),
    category: item.category || "",
    status: item.status || "Extracted"
  };
}

function normalizeEquipmentItem(item = {}) {
  return {
    ...baseRecord(item),
    name: item.name || item.equipment || "",
    type: item.type || item.category || "",
    location: item.location || "",
    modelSerial: item.modelSerial || item.serial || item.plateVin || "",
    serviceFrequency: item.serviceFrequency || item.frequency || "",
    lastServiceDate: normalizeDateValue(item.lastServiceDate),
    nextServiceDue: normalizeDateValue(item.nextServiceDue || item.nextDue),
    vendor: item.vendor || item.contractorVendor || "",
    sourceFileUrl: item.sourceFileUrl || "",
    status: item.status || "Active",
    notes: item.notes || ""
  };
}

function normalizeSyncLogItem(item) {
  return {
    id: item.id || crypto.randomUUID(),
    timestamp: item.timestamp || new Date().toISOString(),
    action: item.action || "",
    status: item.status || "",
    message: item.message || "",
    updatedByDevice: item.updatedByDevice || getDeviceId()
  };
}

function normalizeBid(bid) {
  return {
    id: bid.id || crypto.randomUUID(),
    contractor: bid.contractor || "",
    amount: Number(bid.amount || 0),
    timeline: bid.timeline || "",
    included: bid.included || "",
    exclusions: bid.exclusions || "",
    allowanceAmount: Number(bid.allowanceAmount || 0),
    materialsIncluded: bid.materialsIncluded || "",
    laborIncluded: bid.laborIncluded || "",
    permitFeesIncluded: bid.permitFeesIncluded || "",
    laborCost: Number(bid.laborCost || 0),
    materialsCost: Number(bid.materialsCost || 0),
    permitCost: Number(bid.permitCost || 0),
    tax: Number(bid.tax || 0),
    warranty: bid.warranty || "",
    licenseNumber: bid.licenseNumber || "",
    insuranceInfo: bid.insuranceInfo || "",
    bidDocumentName: bid.bidDocumentName || "",
    bidPdfUrl: bid.bidPdfUrl || "",
    bidReceivedDate: normalizeDateValue(bid.bidReceivedDate),
    contact: bid.contact || "",
    notes: bid.notes || "",
    status: bid.status || "Considering"
  };
}

function saveState() {
  try {
    touchSyncMeta();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    showSaveStatus(navigator.onLine ? "Unsynced Changes" : "Offline Mode");
    renderSyncStatus();
    return true;
  } catch (error) {
    showSaveStatus("Storage blocked - use Save Backup");
    return false;
  }
}

function touchSyncMeta() {
  const now = new Date().toISOString();
  state.syncMeta = {
    ...(state.syncMeta || {}),
    lastUpdated: now,
    updatedByDevice: getDeviceId(),
    appVersion: APP_VERSION,
    syncId: state.syncMeta?.syncId || crypto.randomUUID(),
    unsyncedChanges: Number(state.syncMeta?.unsyncedChanges || 0) + 1,
    status: navigator.onLine ? "Unsynced Changes" : "Offline Mode"
  };
}

function normalizeDuplicateKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, " ");
}

function findPossibleDuplicate(collection, payload, id) {
  const items = state[collection];
  if (!Array.isArray(items)) return null;

  const keyFor = {
    rooms: (item) => normalizeDuplicateKey(item.name),
    tasks: (item) => [
      normalizeDuplicateKey(item.title),
      normalizeDuplicateKey(item.room),
      normalizeDuplicateKey(item.due)
    ].join("|"),
    bids: (item) => [
      normalizeDuplicateKey(item.contractor),
      normalizeDuplicateKey(item.amount),
      normalizeDuplicateKey(item.bidReceivedDate)
    ].join("|"),
    expenses: (item) => [
      normalizeDuplicateKey(item.item),
      normalizeDuplicateKey(item.amount),
      normalizeDuplicateKey(item.type)
    ].join("|"),
    materials: (item) => [
      normalizeDuplicateKey(item.item),
      normalizeDuplicateKey(item.company),
      normalizeDuplicateKey(item.taskId)
    ].join("|"),
    decisions: (item) => [
      normalizeDuplicateKey(item.title),
      normalizeDuplicateKey(item.owner)
    ].join("|")
  }[collection];

  if (!keyFor) return null;

  const payloadKey = keyFor(payload);
  if (!payloadKey || payloadKey.split("|").some((part) => !part)) return null;

  return items.find((item) => item.id !== id && !item.deletedAt && keyFor(item) === payloadKey) || null;
}

function confirmDuplicateIfNeeded(collection, payload, id) {
  const duplicate = findPossibleDuplicate(collection, payload, id);
  if (!duplicate) return true;
  return confirm("This may already exist. Create it anyway?");
}

function saveChange({ type, collection, id, payload }) {
  if (type === "create" && !confirmDuplicateIfNeeded(collection, payload, id)) {
    showSaveStatus("Duplicate not created");
    return null;
  }

  const timestamp = new Date().toISOString();

  const change = {
    id: crypto.randomUUID(),
    type,
    collection,
    recordId: id,
    payload,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
    deviceId: getDeviceId()
  };

  applyLocalChange(change);
  addToSyncQueue(change);
  saveState();
  render();
  showSaveStatus("Saved locally - pending sync");

  return change;
}

function applyLocalChange(change) {
  const { type, collection, recordId, payload } = change;

  if (!state[collection]) {
    console.warn("Unknown collection:", collection);
    return;
  }

  if (type === "create") {
    const exists = state[collection].some((item) => item.id === recordId);
    if (!exists) {
      state[collection].push({
        id: recordId,
        ...payload,
        createdAt: change.createdAt,
        updatedAt: change.updatedAt,
        deletedAt: null
      });
    }
  }

  if (type === "update") {
    const item = state[collection].find((entry) => entry.id === recordId);
    if (item) {
      const previousRoomName = collection === "rooms" ? item.name : "";
      Object.assign(item, {
        ...payload,
        updatedAt: change.updatedAt
      });
      if (collection === "rooms" && previousRoomName !== payload.name) {
        state.tasks.forEach((task) => {
          if (task.room === previousRoomName) task.room = payload.name;
        });
        if (activeTaskRoomFilter === previousRoomName) activeTaskRoomFilter = payload.name;
      }
    }
  }

  if (type === "delete") {
    const item = state[collection].find((entry) => entry.id === recordId);
    if (item) {
      item.deletedAt = change.updatedAt;
      item.updatedAt = change.updatedAt;
    }
  }
}

function addToSyncQueue(change) {
  const queue = getSyncQueue();
  queue.push(change);
  localStorage.setItem("mow-sync-queue-v1", JSON.stringify(queue));
}

function getSyncQueue() {
  try {
    return JSON.parse(localStorage.getItem("mow-sync-queue-v1")) || [];
  } catch {
    return [];
  }
}

function markQueueItemStatus(changeId, status, extraFields = {}) {
  const queue = getSyncQueue().map((change) =>
    change.id === changeId
      ? {
          ...change,
          ...extraFields,
          status,
          updatedAt: new Date().toISOString()
        }
      : change
  );
  localStorage.setItem("mow-sync-queue-v1", JSON.stringify(queue));
  renderSyncStatus();
}

function recoverStaleSyncItems() {
  const now = Date.now();
  let recovered = 0;
  const queue = getSyncQueue().map((change) => {
    if (change.status !== "syncing") return change;

    const lastAttempt = Date.parse(change.lastAttemptAt || change.updatedAt || change.createdAt || 0);
    if (lastAttempt && now - lastAttempt <= STALE_SYNC_MS) return change;

    recovered += 1;
    return {
      ...change,
      status: "pending",
      errorMessage: "Previous sync was interrupted. Ready to retry.",
      updatedAt: new Date().toISOString()
    };
  });

  if (recovered) {
    localStorage.setItem("mow-sync-queue-v1", JSON.stringify(queue));
  }

  return recovered;
}

function pruneSyncedQueue(limit = MAX_SYNCED_QUEUE_ITEMS) {
  const queue = getSyncQueue();
  const synced = queue.filter((change) => change.status === "synced");
  if (synced.length <= limit) return;

  const keepSyncedIds = new Set(
    synced
      .slice()
      .sort((a, b) => Date.parse(b.syncedAt || b.updatedAt || 0) - Date.parse(a.syncedAt || a.updatedAt || 0))
      .slice(0, limit)
      .map((change) => change.id)
  );
  const pruned = queue.filter((change) => change.status !== "synced" || keepSyncedIds.has(change.id));
  localStorage.setItem("mow-sync-queue-v1", JSON.stringify(pruned));
}

function clearSyncedQueueItems() {
  const queue = getSyncQueue();
  const remaining = queue.filter((change) => change.status !== "synced");
  const removed = queue.length - remaining.length;
  localStorage.setItem("mow-sync-queue-v1", JSON.stringify(remaining));
  logSync("cleanup", "success", removed ? `Cleared ${removed} synced queue item(s)` : "No synced queue items to clear");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderSyncStatus();
  renderSyncLog();
  return removed;
}

function getPendingSyncChanges() {
  recoverStaleSyncItems();
  const now = Date.now();
  return getSyncQueue().filter((change) => {
    if (["pending", "failed"].includes(change.status)) return true;
    if (change.status !== "syncing") return false;

    const lastAttempt = Date.parse(change.lastAttemptAt || change.updatedAt || change.createdAt || 0);
    return !lastAttempt || now - lastAttempt > STALE_SYNC_MS;
  });
}

async function processSyncQueue() {
  const changes = getPendingSyncChanges();
  let syncedCount = 0;

  for (const change of changes) {
    const lastAttemptAt = new Date().toISOString();
    const attempts = Number(change.attempts || 0) + 1;

    markQueueItemStatus(change.id, "syncing", {
      attempts,
      lastAttemptAt,
      errorMessage: ""
    });

    try {
      if (SYNCED_COLLECTIONS.includes(change.collection)) {
        await syncToBackend(change);
      } else {
        await simulateBackendSync(change);
      }
      markQueueItemStatus(change.id, "synced", {
        attempts,
        lastAttemptAt,
        errorMessage: "",
        syncedAt: new Date().toISOString()
      });
      syncedCount += 1;
      logSync("sync", "success", `${getQueueItemLabel(change)} synced`);
    } catch (error) {
      markQueueItemStatus(change.id, error.code === "SYNC_CONFLICT" ? "conflict" : "failed", {
        attempts,
        lastAttemptAt,
        errorMessage: getFriendlySyncError(error),
        remoteRecord: error.remoteRecord || null
      });
      logSync("sync", error.code === "SYNC_CONFLICT" ? "conflict" : "failed", `${getQueueItemLabel(change)}: ${getFriendlySyncError(error)}`);
    }
  }

  if (syncedCount) {
    state.syncMeta = {
      ...(state.syncMeta || {}),
      lastSyncedAt: new Date().toISOString(),
      status: getSyncQueueSummary().pending ? "Saved locally - pending sync" : "Synced"
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  pruneSyncedQueue();
  renderSyncStatus();
  renderSyncLog();
}

function syncNow() {
  return retryFailedSyncs();
}

function retryFailedSyncs() {
  recoverStaleSyncItems();
  const queue = getSyncQueue().map((change) =>
    ["failed", "syncing"].includes(change.status)
      ? {
          ...change,
          status: "pending",
          errorMessage: "",
          updatedAt: new Date().toISOString()
        }
      : change
  );
  localStorage.setItem("mow-sync-queue-v1", JSON.stringify(queue));
  renderSyncStatus();
  return processSyncQueue();
}

function simulateBackendSync() {
  return Promise.resolve({ ok: true });
}

function getFriendlySyncError(error) {
  const message = error?.message || String(error || "");

  if (/row-level security|violates row-level security/i.test(message)) {
    return "Sync is blocked by Supabase permissions. Check the testing policy.";
  }

  if (/failed to fetch|network/i.test(message)) {
    return "Sync could not reach Supabase. Check your connection and Supabase URL.";
  }

  if (/duplicate key|unique/i.test(message)) {
    return "This may already exist in Supabase.";
  }

  if (/column .* does not exist|schema cache/i.test(message)) {
    return "The Supabase table is missing a field the app needs.";
  }

  if (/Cannot coerce the result to a single JSON object/i.test(message)) {
    return "That record is not in Supabase yet. Create or sync it before deleting it.";
  }

  return message || "Sync failed. Your changes are still saved locally.";
}

const backendTableMap = {
  rooms: "rooms",
  tasks: "tasks",
  materials: "materials",
  bids: "bids",
  expenses: "expenses",
  decisions: "decisions",
  maintenanceCalendar: "maintenance_calendar",
  recurringMaintenance: "recurring_maintenance",
  fleetSchedule: "fleet_schedule",
  fleetVehicles: "fleet_vehicles",
  mileageLog: "mileage_log",
  repairLog: "repair_log",
  walkthroughChecklist: "walkthrough_checklist",
  facilitiesInstructions: "facilities_instructions",
  contractorLibrary: "contractor_library",
  equipment: "equipment"
};

async function syncToBackend(change) {
  if (!SYNCED_COLLECTIONS.includes(change.collection)) {
    return simulateBackendSync(change);
  }

  const supabase = getSupabaseClient();
  const table = backendTableMap[change.collection];
  if (!table) throw new Error(`No backend table mapped for ${change.collection}`);

  const payload = toBackendPayload({
    id: change.recordId,
    ...change.payload,
    createdAt: change.createdAt,
    updatedAt: change.updatedAt,
    updatedByDevice: change.deviceId
  });

  if (change.type === "create") {
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const remote = await fetchBackendRecord(supabase, table, change.recordId);
  if (!remote && change.type === "update") {
    const fullLocalRecord = getFullLocalRecordForSync(change);
    const insertPayload = toBackendPayload({
      id: change.recordId,
      ...fullLocalRecord,
      ...change.payload,
      createdAt: fullLocalRecord?.createdAt || change.createdAt,
      updatedAt: change.updatedAt,
      updatedByDevice: change.deviceId
    });

    const { data, error } = await supabase
      .from(table)
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  if (!remote && change.type === "delete") {
    return { id: change.recordId, deleted_at: change.updatedAt };
  }

  if (remote && isRemoteNewerThanChange(remote, change)) {
    const error = new Error("Conflict: remote record is newer than this local change.");
    error.code = "SYNC_CONFLICT";
    error.remoteRecord = remote;
    throw error;
  }

  const updatePayload =
    change.type === "delete"
      ? {
          deleted_at: change.updatedAt,
          updated_at: change.updatedAt,
          updated_by_device: change.deviceId
        }
      : payload;

  const { data, error } = await supabase
    .from(table)
    .update(updatePayload)
    .eq("id", change.recordId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

function getFullLocalRecordForSync(change) {
  const collection = state[change.collection];
  if (!Array.isArray(collection)) return {};
  return collection.find((item) => item.id === change.recordId) || {};
}

function getSupabaseClient() {
  if (!window.supabaseClient) {
    initializeSupabaseClient();
  }
  if (!window.supabaseClient) {
    throw new Error("Supabase client is not configured yet.");
  }
  return window.supabaseClient;
}

async function fetchBackendRecord(supabase, table, id) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function isRemoteNewerThanChange(remote, change) {
  const remoteUpdatedAt = remote.updated_at || remote.updatedAt;
  if (!remoteUpdatedAt) return false;
  return new Date(remoteUpdatedAt).getTime() > new Date(change.updatedAt || change.createdAt).getTime();
}

function toBackendPayload(payload) {
  const output = { ...payload };
  if (output.updatedAt && !output.updated_at) output.updated_at = output.updatedAt;
  if (output.createdAt && !output.created_at) output.created_at = output.createdAt;
  if (output.deletedAt && !output.deleted_at) output.deleted_at = output.deletedAt;
  if (output.updatedByDevice && !output.updated_by_device) output.updated_by_device = output.updatedByDevice;

  [
    "start",
    "due",
    "bidReceivedDate",
    "lastUpdated",
    "date",
    "lastServiceDate",
    "followUpDate",
    "uploadDate",
    "expirationDate",
    "nextServiceDue",
    "lastServiceDate",
    "lastInspectionDate",
    "nextInspectionDue"
  ].forEach((field) => {
    if (output[field] === "") output[field] = null;
  });

  delete output.updatedAt;
  delete output.createdAt;
  delete output.deletedAt;
  delete output.updatedByDevice;

  return output;
}

function getSyncQueueSummary() {
  recoverStaleSyncItems();
  const queue = getSyncQueue();
  const failedItems = queue.filter((change) => change.status === "failed");
  const pending = queue.filter((change) => change.status === "pending").length;
  const syncing = queue.filter((change) => change.status === "syncing").length;
  return {
    pending,
    syncing,
    unsynced: pending + syncing + failedItems.length + queue.filter((change) => change.status === "conflict").length,
    failed: failedItems.length,
    conflicts: queue.filter((change) => change.status === "conflict").length,
    synced: queue.filter((change) => change.status === "synced").length,
    firstError: failedItems[0]?.errorMessage || ""
  };
}

function saveWorkspaceChange(payload) {
  const timestamp = new Date().toISOString();
  const change = {
    id: crypto.randomUUID(),
    type: "update",
    collection: "workspace",
    recordId: "workspace",
    payload,
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
    deviceId: getDeviceId()
  };

  Object.assign(state, payload);
  addToSyncQueue(change);
  saveState();
  scheduleAutoSync();
  renderPrintReport();
  showSaveStatus("Saved locally - pending sync");

  return change;
}

function render() {
  renderCommandCenterCopy();
  document.querySelector("#projectName").value = state.projectName;
  document.querySelector("#targetDate").value = state.targetDate;
  document.querySelector("#expectedDuration").value = state.expectedDuration || "";
  document.querySelector("#backendUrl").value = getBackendUrl();
  document.querySelector("#bottomBackendUrl").value = getBackendUrl();
  document.querySelector("#autoSyncToggle").checked = isAutoSyncEnabled();
  document.querySelector("#autoLoadToggle").checked = isAutoLoadEnabled();
  renderProjectToolbar();
  renderSyncStatus();
  renderStats();
  renderOpsDashboard();
  renderRooms();
  renderTasks();
  renderCalendar();
  renderBids();
  renderExpenses();
  renderDecisions();
  renderFacilities();
  renderEquipment();
  renderDocumentIntake();
  renderContractorLibrary();
  renderBidComparison();
  renderSyncLog();
  renderReportPreview();
  renderPrintReport();
  syncRoomSelect();
  if (draftRestorePending) {
    restoreDrafts();
    draftRestorePending = false;
  }
}

function renderCommandCenterCopy() {
  const heroTitle = document.querySelector("#overview .overview-hero h2");
  const heroCopy = document.querySelector("#overview .overview-hero p:not(.eyebrow)");
  if (heroTitle) heroTitle.textContent = "Today's rhythm";
  if (heroCopy) heroCopy.textContent = "A calm place to review what needs attention, choose a workspace, and keep facilities work moving.";
}

function renderStats() {
  const totals = getTotals();

  document.querySelector("#totalBudget").textContent = money.format(totals.totalBudget);
  document.querySelector("#totalEstimate").textContent = money.format(totals.totalEstimate);
  document.querySelector("#taskProgress").textContent = `${totals.progress}%`;
  document.querySelector("#bestBid").textContent = totals.bestBid
    ? `${totals.bestBid.contractor} ${money.format(totals.bestBid.amount)}`
    : "TBD";
  document.querySelector("#totalSqft").textContent = totals.totalSqft.toLocaleString();
  document.querySelector("#budgetPerSqft").textContent = totals.totalSqft
    ? money.format(totals.totalBudget / totals.totalSqft)
    : "TBD";
  document.querySelector("#materialCosts").textContent = money.format(totals.materialCosts);
  document.querySelector("#suppliesToBuy").textContent = getSuppliesToBuy().length.toLocaleString();

  document.querySelector("#roomProgress").innerHTML = activeItems(state.rooms)
    .map((room) => {
      const roomTasks = activeItems(state.tasks).filter((task) => task.room === room.name);
      const done = roomTasks.filter((task) => task.status === "Done").length;
      const pct = roomTasks.length ? Math.round((done / roomTasks.length) * 100) : 0;
      return `
        <div class="item-card">
          <div class="item-head">
            <strong>${escapeHtml(room.name)}</strong>
            <span class="pill">${escapeHtml(room.status)}</span>
          </div>
          <p class="small">${money.format(room.budget)} budget - ${Number(room.sqft).toLocaleString()} sq ft - ${escapeHtml(room.duration || "Time TBD")}</p>
          <div class="progress" aria-label="${pct}% complete"><span style="width:${pct}%"></span></div>
        </div>
      `;
    })
    .join("");

  document.querySelector("#upcomingTasks").innerHTML = [...activeItems(state.tasks)]
    .filter((task) => task.status !== "Done")
    .sort((a, b) => taskDate(a).localeCompare(taskDate(b)))
    .slice(0, 5)
    .map((task) => taskTemplate(task, false))
    .join("");

  document.querySelector("#bidSummary").innerHTML = [...activeItems(state.bids)]
    .sort((a, b) => Number(a.amount) - Number(b.amount))
    .map(
      (bid) => `
        <tr>
          <td><strong>${escapeHtml(bid.contractor)}</strong><br><span class="small">${escapeHtml(bid.contact || "No contact yet")}</span></td>
          <td>${money.format(bid.amount)}</td>
          <td>${escapeHtml(bid.timeline)}</td>
          <td>${escapeHtml(bid.included)}</td>
          <td><span class="pill">${escapeHtml(bid.status)}</span></td>
        </tr>
      `
    )
    .join("");
}

function renderProjectToolbar() {
  const select = document.querySelector("#projectSelect");
  if (select) {
    select.innerHTML = state.projects
      .map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`)
      .join("");
    select.value = getActiveProjectId();
  }
  const editToggle = document.querySelector("#editModeToggle");
  if (editToggle) editToggle.checked = isEditMode();
}

function renderOpsDashboard() {
  const stats = getFacilitiesStats();
  const today = todayDateString();
  const todayTasks = getProjectItems(activeItems(state.tasks)).filter((task) => task.status !== "Done" && (taskDate(task) === today || task.due === today));
  const contractorFollowups = activeItems(state.bids).filter((bid) => /waiting|follow|need|revised|license|insurance/i.test(`${bid.status} ${bid.notes} ${bid.exclusions}`));
  const recentDocs = [...state.documentIntake].sort((a, b) => String(b.uploadDate).localeCompare(String(a.uploadDate))).slice(0, 5);
  fillStack("#todayPriorities", todayTasks, (task) => miniCard(task.title, `${task.room} - due ${task.due}`, task.status));
  fillStack("#dashboardOverdueTasks", stats.overdue, (item) => miniCard(item.task, item.date, item.status));
  fillStack("#dashboardWeekMaintenance", stats.thisWeek, (item) => miniCard(item.task, `${item.date} - ${item.location || "No location"}`, item.status));
  fillStack("#dashboardOpenRepairs", stats.openRepairs, (item) => miniCard(item.issue, item.areaSystemVehicle || item.date, item.status || "Open"));
  fillStack("#dashboardFleetDue", stats.fleetDue, (item) => miniCard(item.vehicle, item.notes || item.nextOilChangeDue || "Service due", item.status || "Due"));
  fillStack("#dashboardEquipmentDue", stats.equipmentDue, (item) => miniCard(item.name, `${item.location || "No location"} - due ${item.nextServiceDue || "TBD"}`, item.status || "Service Due"));
  fillStack("#dashboardWalkthroughIssues", stats.walkthroughIssues, (item) => miniCard(item.itemToInspect, item.location, item.status || "Issue"));
  fillStack("#dashboardContractorFollowups", contractorFollowups, (bid) => miniCard(bid.contractor, bid.notes || bid.status, "Follow-up"));
  fillStack("#dashboardUnsyncedChanges", Number(state.syncMeta?.unsyncedChanges || 0) ? [{ title: "Local changes waiting to sync" }] : [], () => miniCard("Local changes waiting to sync", `${state.syncMeta.unsyncedChanges} unsynced change(s)`, state.syncMeta.status));
  fillStack("#dashboardRecentDocuments", recentDocs, (doc) => miniCard(doc.originalFileName || doc.sourceFileName || doc.documentType, doc.contractorVendor || doc.projectRoomCategory, doc.status));
}

function fillStack(selector, items, template) {
  const node = document.querySelector(selector);
  if (!node) return;
  node.innerHTML = items.length ? items.slice(0, 5).map(template).join("") : `<p class="meta">Nothing needs attention here.</p>`;
}

function miniCard(title, detail, status) {
  return `
    <article class="item-card compact-card">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(title || "Untitled")}</strong>
          <p class="meta">${escapeHtml(detail || "")}</p>
        </div>
        <span class="pill">${escapeHtml(status || "Open")}</span>
      </div>
    </article>
  `;
}

function activeItems(items = []) {
  return items.filter((item) => !item.deletedAt);
}

function actionChoice(scope, id, options, config = {}) {
  const input = config.attachCollection
    ? `<input type="file" accept=".pdf,application/pdf" data-action-attach="${escapeHtml(scope)}" data-id="${escapeHtml(id)}" data-attach-file="${escapeHtml(config.attachCollection)}" hidden />`
    : "";
  return `
    <div class="action-choice">
      <select class="action-menu" data-action-choice="${escapeHtml(scope)}" data-action-id="${escapeHtml(id)}" aria-label="${escapeHtml(config.label || "Actions")}">
        <option value="">Actions</option>
        ${options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}
      </select>
      <button type="button" data-action-go="${escapeHtml(scope)}" data-action-id="${escapeHtml(id)}">Go</button>
      ${input}
    </div>
  `;
}

function initializePageActionBars() {
  Object.entries(pageFormActions).forEach(([formId, config]) => {
    const form = document.querySelector(`#${formId}`);
    if (!form || document.querySelector(`[data-page-action-bar="${formId}"]`)) return;
    form.classList.add("page-controlled-form", "is-collapsed");
    form.insertAdjacentHTML(
      "beforebegin",
      `
        <div class="page-action-bar" data-page-action-bar="${escapeHtml(formId)}">
          <span>${escapeHtml(config.label)}</span>
          <button type="button" class="page-add-button" data-page-action-add="${escapeHtml(formId)}">${escapeHtml(config.addLabel)}</button>
        </div>
      `
    );
  });
}

function showPageForm(formId) {
  const form = document.querySelector(`#${formId}`);
  if (!form) return;
  form.classList.remove("is-collapsed");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hidePageForm(form) {
  if (form?.classList.contains("page-controlled-form")) {
    form.classList.add("is-collapsed");
  }
}

function prepareNewForm(formId) {
  const form = document.querySelector(`#${formId}`);
  if (!form) return;
  form.reset();
  delete form.dataset.editingId;
  form.querySelector("button[type='submit']").textContent = submitText[form.id] || "Add";
  form.querySelector(".cancel-edit")?.setAttribute("hidden", "");
  clearFormDraft(form.id);
  showPageForm(formId);
  focusFirstField(form);
}

function runPageAction(formId) {
  const menu = document.querySelector(`[data-page-action-choice="${formId}"]`);
  const action = menu?.value || "";
  if (!action) {
    showSaveStatus("Choose an action first");
    return;
  }
  if (action === "add") prepareNewForm(formId);
  if (menu) menu.value = "";
}

function renderRooms() {
  const rooms = activeItems(state.rooms);
  document.querySelector("#roomList").innerHTML = rooms.length
    ? rooms.map(roomTemplate).join("")
    : `<article class="report-card empty-report-card"><h3>No rooms yet. Add your first room.</h3></article>`;
}

function roomTemplate(room) {
  const roomTasks = activeItems(state.tasks).filter((task) => task.room === room.name);
  const roomMaterials = activeItems(state.materials).filter((material) =>
    roomTasks.some((task) => task.id === material.taskId)
  );
  const openTasks = roomTasks.filter((task) => task.status !== "Done").length;
  return `
    <article class="item-card">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(room.name)}</strong>
          <p class="meta">${money.format(room.budget)} budget - ${Number(room.sqft).toLocaleString()} sq ft - ${escapeHtml(room.duration || "Time TBD")}</p>
          <p class="meta">${roomTasks.length} task${roomTasks.length === 1 ? "" : "s"} - ${openTasks} open - ${roomMaterials.length} material${roomMaterials.length === 1 ? "" : "s"}</p>
        </div>
        <span class="pill">${escapeHtml(room.status)}</span>
      </div>
      <div class="row-actions">
        ${actionChoice("rooms", room.id, [
          ["viewTasks", "View tasks"],
          ["addTask", "Add task"],
          ["expense", "Add expense"],
          ["edit", "Edit"],
          ["status", "Next status"],
          ["delete", "Remove"]
        ], { label: `Room actions for ${room.name}` })}
      </div>
    </article>
  `;
}

function renderTasks() {
  const filteredTasks = activeTaskRoomFilter
    ? getProjectItems(activeItems(state.tasks)).filter((task) => task.room === activeTaskRoomFilter)
    : getProjectItems(activeItems(state.tasks));
  const tasks = getProjectItems(activeItems(state.tasks))
    .filter((task) => !activeTaskRoomFilter || task.room === activeTaskRoomFilter)
    .sort((a, b) => taskDate(a).localeCompare(taskDate(b)))
    .map((task) => taskTemplate(task, true));
  const context = activeTaskRoomFilter
    ? `<div class="flow-context"><span>Showing ${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"} for ${escapeHtml(activeTaskRoomFilter)}</span><button data-clear-task-room-filter>Show all tasks</button></div>`
    : "";
  document.querySelector("#taskList").innerHTML =
    context +
    (tasks.length
      ? tasks.join("")
      : `<article class="report-card empty-report-card"><h3>No tasks yet. Add your first task.</h3></article>`);
}

function taskTemplate(task, showMaterialControls) {
  if (isEditMode()) return workflowTaskCard(task, showMaterialControls);
  const isBlocked = task.status === "Blocked";
  const taskMaterials = activeItems(state.materials).filter((material) => material.taskId === task.id);
  const materialCost = taskMaterials.reduce((sum, material) => sum + Number(material.cost), 0);
  return `
    <article class="item-card workflow-card">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(task.title)}</strong>
          <p class="meta">${escapeHtml(task.room)} - starts ${escapeHtml(taskDate(task))} - due ${escapeHtml(task.due)} - ${escapeHtml(task.duration || "Time TBD")}</p>
          <p class="meta">${escapeHtml(task.priority || "Normal")} priority - Estimate ${money.format(task.estimatedCost || 0)} - Contractor ${money.format(task.contractorCost || 0)}</p>
          <p class="meta">${taskMaterials.length} material${taskMaterials.length === 1 ? "" : "s"} - ${money.format(materialCost)}</p>
        </div>
        <span class="pill ${isBlocked ? "warn" : ""}">${escapeHtml(task.status)}</span>
      </div>
      ${task.notes ? `<p>${escapeHtml(task.notes)}</p>` : ""}
      ${attachmentsHtml(task.attachments)}
      <div class="row-actions">
        ${actionChoice("tasks", task.id, [
          ["view", "View"],
          ["edit", "Edit"],
          ["duplicate", "Duplicate"],
          ["attach", "Attach PDF"],
          ["complete", "Mark complete"],
          ...(showMaterialControls ? [["materials", "Show materials"], ["addMaterial", "Add material"]] : []),
          ["expense", "Add expense"],
          ["status", "Next status"],
          ["delete", "Remove"]
        ], { attachCollection: "tasks", label: `Task actions for ${task.title}` })}
      </div>
      <p class="meta">Last updated: ${formatDateTime(task.lastUpdated)}</p>
      ${showMaterialControls && activeMaterialTaskId === task.id ? materialPanel(task, taskMaterials) : ""}
    </article>
  `;
}

function workflowTaskCard(task, showMaterialControls) {
  return `
    <article class="item-card workflow-card edit-card" data-card="tasks" data-id="${task.id}">
      <div class="card-edit-grid">
        ${cardInput("title", "Task title", task.title)}
        ${cardInput("room", "Location / area", task.room)}
        ${cardInput("priority", "Priority", task.priority)}
        ${cardInput("status", "Status", task.status)}
        ${cardInput("estimatedCost", "Estimated cost", task.estimatedCost, "number")}
        ${cardInput("contractorCost", "Contractor cost", task.contractorCost, "number")}
        ${cardInput("due", "Due date", task.due, "date")}
        ${cardInput("duration", "Expected time", task.duration)}
        ${cardTextarea("notes", "Notes", task.notes)}
      </div>
      ${attachmentsHtml(task.attachments)}
      <div class="row-actions">
        ${actionChoice("tasks", task.id, [
          ["view", "View"],
          ["save", "Save changes"],
          ["duplicate", "Duplicate"],
          ["history", "View history"],
          ["attach", "Attach PDF"],
          ["complete", "Mark complete"],
          ...(showMaterialControls ? [["materials", "Show materials"], ["addMaterial", "Add material"]] : []),
          ["expense", "Add expense"],
          ["delete", "Delete"]
        ], { attachCollection: "tasks", label: `Task actions for ${task.title}` })}
      </div>
      <p class="meta">Last updated: ${formatDateTime(task.lastUpdated)}</p>
      ${showMaterialControls && activeMaterialTaskId === task.id ? materialPanel(task, activeItems(state.materials).filter((material) => material.taskId === task.id)) : ""}
    </article>
  `;
}

function renderCalendar() {
  const today = todayDateString();
  const days = Array.from({ length: 14 }, (_, index) => addDays(today, index));
  const upcoming = getUpcomingTasks(21);
  const supplies = getSuppliesToBuy();

  document.querySelector("#calendarToday").textContent = `Starting today: ${formatDate(today)}`;
  document.querySelector("#calendarGrid").innerHTML = days
    .map((date) => {
      const tasks = getProjectItems(activeItems(state.tasks)).filter((task) => task.status !== "Done" && taskDate(task) === date);
      return `
        <article class="calendar-day ${date === today ? "today" : ""}">
          <strong>${formatShortDate(date)}</strong>
          <div class="calendar-items">
            ${
              tasks.length
                ? tasks.map((task) => `<span>${escapeHtml(task.title)}</span>`).join("")
                : `<em>No starts</em>`
            }
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelector("#calendarTaskList").innerHTML = upcoming.length
    ? upcoming.map(calendarTaskTemplate).join("")
    : `<p class="meta">No upcoming tasks scheduled.</p>`;

  document.querySelector("#supplyList").innerHTML = supplies.length
    ? supplies.map(supplyTemplate).join("")
    : `<p class="meta">No supplies need buying before upcoming task starts.</p>`;
}

function calendarTaskTemplate(task) {
  return `
    <article class="item-card compact-card">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(task.title)}</strong>
          <p class="meta">${escapeHtml(task.room)} - starts ${formatDate(taskDate(task))}</p>
        </div>
        <span class="pill">${escapeHtml(task.status)}</span>
      </div>
    </article>
  `;
}

function supplyTemplate(entry) {
  return `
    <article class="item-card compact-card">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(entry.material.item)}</strong>
          <p class="meta">${escapeHtml(entry.material.company)} - for ${escapeHtml(entry.task.title)}</p>
          <p class="meta">Buy before ${formatDate(taskDate(entry.task))}</p>
        </div>
        <span class="pill">${money.format(entry.material.cost)}</span>
      </div>
    </article>
  `;
}

function materialPanel(task, materials) {
  return `
    <div class="material-panel">
      <form class="entry-form material-entry" data-material-form data-task-id="${task.id}">
        <input name="item" placeholder="Material needed" required />
        <input name="company" placeholder="Company / supplier" required />
        <input name="cost" type="number" min="0" step="1" placeholder="Cost" required />
        <select name="status">
          <option>Needed</option>
          <option>Quoted</option>
          <option>Ordered</option>
          <option>Received</option>
        </select>
        <button type="submit">Add material</button>
        <button type="button" class="cancel-edit" data-cancel-material hidden>Cancel edit</button>
      </form>
      <div class="stack">
        ${
          materials.length
            ? materials.map(materialTemplate).join("")
            : `<p class="meta">No materials added for this task yet.</p>`
        }
      </div>
    </div>
  `;
}

function materialTemplate(material) {
  return `
    <div class="material-row">
      <div>
        <strong>${escapeHtml(material.item)}</strong>
        <p class="meta">${escapeHtml(material.company)} - ${escapeHtml(material.status)}</p>
      </div>
      <div class="material-actions">
        <span class="pill">${money.format(material.cost)}</span>
        ${actionChoice("materials", material.id, [
          ["edit", "Edit"],
          ["expense", "Add expense"],
          ["status", "Next status"],
          ["delete", "Remove"]
        ], { label: `Material actions for ${material.item}` })}
      </div>
    </div>
  `;
}

function renderBids() {
  const bids = activeItems(state.bids);
  document.querySelector("#bidList").innerHTML = [...bids]
    .sort((a, b) => Number(a.amount) - Number(b.amount))
    .map(
      (bid) => `
        <article class="item-card">
          <div class="item-head">
            <div>
              <strong>${escapeHtml(bid.contractor)}</strong>
              <p class="meta">${money.format(bid.amount)} - ${escapeHtml(bid.timeline)}</p>
            </div>
            <span class="pill">${escapeHtml(bid.status)}</span>
          </div>
          <p><strong>Included:</strong> ${escapeHtml(bid.included)}</p>
          <p class="meta"><strong>Exclusions:</strong> ${escapeHtml(bid.exclusions || "None listed")}</p>
          <p class="meta"><strong>Allowance:</strong> ${money.format(bid.allowanceAmount || 0)} - <strong>Materials:</strong> ${yesNoOrTbd(bid.materialsIncluded)} - <strong>Labor:</strong> ${yesNoOrTbd(bid.laborIncluded)} - <strong>Permits:</strong> ${yesNoOrTbd(bid.permitFeesIncluded)}</p>
          <p class="meta"><strong>Bid document:</strong> ${escapeHtml(bid.bidDocumentName || "Not added")} ${bid.bidReceivedDate ? `- received ${escapeHtml(bid.bidReceivedDate)}` : ""}</p>
          ${bid.bidPdfUrl ? `<p class="meta"><a class="doc-link" href="${escapeHtml(safeExternalUrl(bid.bidPdfUrl))}" target="_blank" rel="noopener noreferrer">Open bid PDF</a></p>` : ""}
          <p class="meta"><strong>Notes:</strong> ${escapeHtml(bid.notes || "No notes")}</p>
          <p class="meta"><strong>Contact:</strong> ${escapeHtml(bid.contact || "Not added")}</p>
          <div class="row-actions">
            ${actionChoice("bids", bid.id, [
              ["edit", "Edit"],
              ["expense", "Create expense"],
              ["decision", "Create decision"],
              ["followup", "Create follow-up"],
              ["revised", "Request revised bid"],
              ["status", "Next status"],
              ["delete", "Remove"]
            ], { label: `Bid actions for ${bid.contractor}` })}
          </div>
        </article>
      `
    )
    .join("");
}

function renderBidComparison() {
  const bids = activeItems(state.bids);
  const lowest = Math.min(...bids.map((bid) => Number(bid.amount || 0)).filter(Boolean));
  document.querySelector("#bidComparisonList").innerHTML = bids.length
    ? [...bids].sort((a, b) => Number(a.amount) - Number(b.amount)).map((bid) => {
        const flags = [];
        if (Number(bid.amount) === lowest) flags.push("Lowest bid");
        if (!bid.timeline) flags.push("Missing timeline");
        if (!bid.warranty) flags.push("Missing warranty");
        if (!bid.licenseNumber) flags.push("Missing license info");
        if (!bid.insuranceInfo) flags.push("Missing insurance info");
        if (/need|waiting|follow/i.test(`${bid.status} ${bid.notes}`)) flags.push("Needs follow-up");
        return `
          <tr>
            <td>${escapeHtml(bid.contractor)}</td>
            <td>${escapeHtml(bid.included)}</td>
            <td>${money.format(bid.amount)}</td>
            <td>${money.format(bid.laborCost || 0)}</td>
            <td>${money.format(bid.materialsCost || 0)}</td>
            <td>${money.format(bid.permitCost || 0)}</td>
            <td>${money.format(bid.tax || 0)}</td>
            <td>${escapeHtml(bid.timeline || "")}</td>
            <td>${escapeHtml(bid.warranty || "")}</td>
            <td>${escapeHtml(bid.licenseNumber || "")}</td>
            <td>${escapeHtml(bid.insuranceInfo || "")}</td>
            <td>${flags.map((flag) => `<span class="pill ${flag.includes("Missing") ? "warn" : ""}">${escapeHtml(flag)}</span>`).join(" ")}</td>
            <td>${bid.bidPdfUrl ? `<a class="doc-link" href="${escapeHtml(safeExternalUrl(bid.bidPdfUrl))}" target="_blank" rel="noopener noreferrer">Open</a>` : ""}</td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="13">No bids to compare yet.</td></tr>`;
}

function renderExpenses() {
  document.querySelector("#expenseList").innerHTML = activeItems(state.expenses)
    .map(
      (expense) => `
        <article class="item-card">
          <div class="item-head">
            <div>
              <strong>${escapeHtml(expense.item)}</strong>
              <p class="meta">${escapeHtml(expense.type)}</p>
            </div>
            <span class="pill">${money.format(expense.amount)}</span>
          </div>
          <div class="row-actions">
            ${actionChoice("expenses", expense.id, [
              ["edit", "Edit"],
              ["status", "Next type"],
              ["delete", "Remove"]
            ], { label: `Expense actions for ${expense.item}` })}
          </div>
        </article>
      `
    )
    .join("");
}

function renderDecisions() {
  document.querySelector("#decisionList").innerHTML = activeItems(state.decisions)
    .map(
      (decision) => `
        <article class="item-card">
          <div class="item-head">
            <div>
              <strong>${escapeHtml(decision.title)}</strong>
              <p class="meta">Owner: ${escapeHtml(decision.owner)}</p>
            </div>
            <span class="pill">${escapeHtml(decision.status)}</span>
          </div>
          <div class="row-actions">
            ${actionChoice("decisions", decision.id, [
              ["edit", "Edit"],
              ["status", "Next status"],
              ["delete", "Remove"]
            ], { label: `Decision actions for ${decision.title}` })}
          </div>
        </article>
      `
    )
    .join("");
}

function syncRoomSelect() {
  const select = document.querySelector("#taskRoom");
  const currentValue = select.value;
  select.innerHTML = activeItems(state.rooms)
    .map((room) => `<option>${escapeHtml(room.name)}</option>`)
    .join("");
  if ([...select.options].some((option) => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function fillFormFields(form, values) {
  Object.entries(values).forEach(([key, value]) => {
    const field = form?.elements?.namedItem(key);
    if (field && field.type !== "file") field.value = value ?? "";
  });
}

function focusFirstField(form) {
  const field = form?.querySelector("input:not([type='hidden']), select, textarea, button");
  field?.focus({ preventScroll: false });
}

function openTasksForRoom(roomName) {
  activeTaskRoomFilter = roomName || "";
  activeMaterialTaskId = "";
  activateView("tasks", "Tasks");
  renderTasks();
  document.querySelector("#taskList")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function startTaskForRoom(roomName) {
  activeTaskRoomFilter = roomName || "";
  activateView("tasks", "Tasks");
  syncRoomSelect();
  const form = document.querySelector("#taskForm");
  prepareNewForm("taskForm");
  fillFormFields(form, {
    room: roomName,
    start: todayDateString(),
    due: addDays(todayDateString(), 7),
    duration: "",
    priority: "Normal",
    status: "Todo"
  });
  renderTasks();
  focusFirstField(form);
}

function openMaterialsForTask(taskId) {
  const task = activeItems(state.tasks).find((entry) => entry.id === taskId);
  if (!task) return;
  activeTaskRoomFilter = task.room || "";
  activeMaterialTaskId = taskId;
  activateView("tasks", "Tasks");
  renderTasks();
  const panel = document.querySelector(`[data-material-form][data-task-id="${taskId}"]`);
  panel?.scrollIntoView({ behavior: "smooth", block: "center" });
  focusFirstField(panel);
}

function startExpenseFromContext({ item = "", amount = 0, type = "Estimate" } = {}) {
  activateView("budget", "Budget");
  const form = document.querySelector("#expenseForm");
  prepareNewForm("expenseForm");
  fillFormFields(form, { item, amount, type });
  focusFirstField(form);
}

function startExpenseForRoom(roomName) {
  startExpenseFromContext({
    item: roomName ? `${roomName} allowance` : "Room allowance",
    amount: 0,
    type: "Estimate"
  });
}

function startExpenseForTask(taskId) {
  const task = activeItems(state.tasks).find((entry) => entry.id === taskId);
  if (!task) return;
  startExpenseFromContext({
    item: `${task.room || "Task"} - ${task.title}`,
    amount: Number(task.estimatedCost || task.contractorCost || 0),
    type: "Estimate"
  });
}

function startExpenseForMaterial(materialId) {
  const material = activeItems(state.materials).find((entry) => entry.id === materialId);
  if (!material) return;
  const task = activeItems(state.tasks).find((entry) => entry.id === material.taskId);
  startExpenseFromContext({
    item: `${task?.room || "Material"} - ${task?.title || "Task"} - ${material.item}`,
    amount: Number(material.cost || 0),
    type: "Committed"
  });
}

function startExpenseForBid(bidId) {
  const bid = activeItems(state.bids).find((entry) => entry.id === bidId);
  if (!bid) return;
  startExpenseFromContext({
    item: `${bid.contractor} bid`,
    amount: Number(bid.amount || 0),
    type: "Committed"
  });
}

function startDecisionForBid(bidId) {
  const bid = activeItems(state.bids).find((entry) => entry.id === bidId);
  if (!bid) return;
  activateView("decisions", "Decisions");
  const form = document.querySelector("#decisionForm");
  prepareNewForm("decisionForm");
  fillFormFields(form, {
    title: `Choose bid: ${bid.contractor}`,
    owner: state.projectName || "Project owner",
    status: "Open"
  });
  focusFirstField(form);
}

function startBidForContractor(contractorId) {
  const contractor = activeItems(state.contractorLibrary).find((entry) => entry.id === contractorId);
  if (!contractor) return;
  activateView("bids", "Bids");
  const form = document.querySelector("#bidForm");
  prepareNewForm("bidForm");
  fillFormFields(form, {
    contractor: contractor.name,
    amount: 0,
    timeline: "",
    included: contractor.servicesOffered || "",
    exclusions: "",
    contact: contractor.email || contractor.phone || "",
    notes: contractor.notes || "",
    status: "Considering"
  });
  focusFirstField(form);
}

function startExpenseForContractor(contractorId) {
  const contractor = activeItems(state.contractorLibrary).find((entry) => entry.id === contractorId);
  if (!contractor) return;
  startExpenseFromContext({
    item: `${contractor.name} contractor cost`,
    amount: 0,
    type: "Estimate"
  });
}

function createRepairForContractor(contractorId) {
  const contractor = activeItems(state.contractorLibrary).find((entry) => entry.id === contractorId);
  if (!contractor) return;
  const id = crypto.randomUUID();
  state.appSettings.editMode = true;
  saveChange({
    type: "create",
    collection: "repairLog",
    id,
    payload: normalizeRepairLogItem({
      id,
      date: todayDateString(),
      areaSystemVehicle: contractor.servicesOffered || "Contractor work",
      issue: `${contractor.name} follow-up`,
      contractorVendor: contractor.name,
      actionTaken: contractor.notes || "",
      priority: "Normal",
      status: "Assessing",
      notes: contractor.email || contractor.phone || ""
    })
  });
  activateView("repairLog", "Repair Log");
}

function createFollowupTaskForContractor(contractorId) {
  const contractor = activeItems(state.contractorLibrary).find((entry) => entry.id === contractorId);
  if (!contractor) return;
  createLocalTask({
    title: `Follow up: ${contractor.name}`,
    room: "Contractors",
    start: todayDateString(),
    due: addDays(todayDateString(), 2),
    duration: "Follow-up",
    priority: "Normal",
    notes: `${contractor.contactPerson || ""} ${contractor.phone || ""} ${contractor.email || ""}`.trim(),
    status: "Todo"
  });
  activeTaskRoomFilter = "Contractors";
  activateView("tasks", "Tasks");
}

function startExpenseForEquipment(equipmentId) {
  const equipment = activeItems(state.equipment).find((entry) => entry.id === equipmentId);
  if (!equipment) return;
  startExpenseFromContext({
    item: `${equipment.location || "Equipment"} - ${equipment.name}`,
    amount: 0,
    type: "Estimate"
  });
}

function createRepairForEquipment(equipmentId) {
  const equipment = activeItems(state.equipment).find((entry) => entry.id === equipmentId);
  if (!equipment) return;
  const id = crypto.randomUUID();
  state.appSettings.editMode = true;
  saveChange({
    type: "create",
    collection: "repairLog",
    id,
    payload: normalizeRepairLogItem({
      id,
      date: todayDateString(),
      areaSystemVehicle: equipment.location || equipment.name,
      issue: `${equipment.name} repair`,
      contractorVendor: equipment.vendor,
      actionTaken: equipment.notes,
      priority: "Normal",
      status: "Assessing",
      notes: `${equipment.type || ""} ${equipment.modelSerial || ""}`.trim()
    })
  });
  activateView("repairLog", "Repair Log");
}

function scheduleMaintenanceForEquipment(equipmentId) {
  const equipment = activeItems(state.equipment).find((entry) => entry.id === equipmentId);
  if (!equipment) return;
  const id = crypto.randomUUID();
  saveChange({
    type: "create",
    collection: "maintenanceCalendar",
    id,
    payload: normalizeMaintenanceCalendarItem({
      id,
      date: equipment.nextServiceDue || todayDateString(),
      task: `Service ${equipment.name}`,
      frequency: equipment.serviceFrequency || "As needed",
      location: equipment.location,
      category: equipment.type || "Equipment",
      status: "Scheduled",
      notes: equipment.notes
    })
  });
  activateView("maintenanceCalendar", "Maintenance Calendar");
}

function cycleRecord(collection, id) {
  const item = state[collection]?.find((entry) => entry.id === id);
  const field = collection === "expenses" ? "type" : "status";
  const values = cycles[collection];
  if (!item || !values) return;
  saveChange({
    type: "update",
    collection,
    id,
    payload: {
      [field]: values[(values.indexOf(item[field]) + 1) % values.length]
    }
  });
}

function deleteRecord(collection, id, label = "item") {
  if (!confirm(`Are you sure you want to delete this ${label}?`)) return;
  saveChange({ type: "delete", collection, id, payload: {} });
}

function runRecordAction(scope, id, action) {
  if (!action) return showSaveStatus("Choose an action first");

  if (scope === "rooms") {
    const room = activeItems(state.rooms).find((entry) => entry.id === id);
    if (!room) return;
    if (action === "viewTasks") return openTasksForRoom(room.name);
    if (action === "addTask") return startTaskForRoom(room.name);
    if (action === "expense") return startExpenseForRoom(room.name);
    if (action === "edit") return startEdit("roomForm", "rooms", id);
    if (action === "status") return cycleRecord("rooms", id);
    if (action === "delete") return deleteRecord("rooms", id, "room");
  }

  if (scope === "tasks") {
    if (action === "view") return showCardDetails("tasks", id);
    if (action === "edit") return startEdit("taskForm", "tasks", id);
    if (action === "duplicate") return duplicateCard("tasks", id);
    if (action === "attach") return document.querySelector(`[data-action-attach="tasks"][data-id="${id}"]`)?.click();
    if (action === "complete") return markCardComplete("tasks", id);
    if (action === "materials") {
      activeMaterialTaskId = activeMaterialTaskId === id ? "" : id;
      return renderTasks();
    }
    if (action === "addMaterial") return openMaterialsForTask(id);
    if (action === "expense") return startExpenseForTask(id);
    if (action === "status") return cycleRecord("tasks", id);
    if (action === "history") return showCardHistory("tasks", id);
    if (action === "save") return saveCardEdits("tasks", id);
    if (action === "delete") return deleteRecord("tasks", id, "task");
  }

  if (scope === "materials") {
    if (action === "edit") return startMaterialEdit(id);
    if (action === "expense") return startExpenseForMaterial(id);
    if (action === "status") return cycleRecord("materials", id);
    if (action === "delete") return deleteRecord("materials", id, "material");
  }

  if (scope === "bids") {
    if (action === "edit") return startEdit("bidForm", "bids", id);
    if (action === "expense") return startExpenseForBid(id);
    if (action === "decision") return startDecisionForBid(id);
    if (action === "followup") return createBidFollowup(id, "Contractor follow-up");
    if (action === "revised") return createBidFollowup(id, "Request revised bid");
    if (action === "status") return cycleRecord("bids", id);
    if (action === "delete") return deleteRecord("bids", id, "bid");
  }

  if (scope === "expenses") {
    if (action === "edit") return startEdit("expenseForm", "expenses", id);
    if (action === "status") return cycleRecord("expenses", id);
    if (action === "delete") return deleteRecord("expenses", id, "expense");
  }

  if (scope === "decisions") {
    if (action === "edit") return startEdit("decisionForm", "decisions", id);
    if (action === "status") return cycleRecord("decisions", id);
    if (action === "delete") return deleteRecord("decisions", id, "decision");
  }

  if (scope === "maintenanceCalendar") {
    if (action === "repair") return createRepairFromMaintenance(id);
    if (action === "expense") return startExpenseForMaintenance(id);
    if (action === "status") return cycleRecord("maintenanceCalendar", id);
  }

  if (scope === "fleetVehicles") {
    if (action === "repair") return createRepairForFleetVehicle(id);
    if (action === "mileage") return createMileageForFleetVehicle(id);
    if (action === "expense") return startExpenseForFleetVehicle(id);
  }

  if (scope === "equipment") {
    if (action === "repair") return createRepairForEquipment(id);
    if (action === "maintenance") return scheduleMaintenanceForEquipment(id);
    if (action === "expense") return startExpenseForEquipment(id);
    if (action === "edit") return startEdit("equipmentForm", "equipment", id);
    if (action === "status") return cycleRecord("equipment", id);
    if (action === "delete") return deleteRecord("equipment", id, "equipment item");
  }

  if (scope === "repairLog") {
    if (action === "view") return showCardDetails("repairLog", id);
    if (action === "edit") {
      state.appSettings.editMode = true;
      return saveAndRender();
    }
    if (action === "save") return saveCardEdits("repairLog", id);
    if (action === "duplicate") return duplicateCard("repairLog", id);
    if (action === "history") return showCardHistory("repairLog", id);
    if (action === "attach") return document.querySelector(`[data-action-attach="repairLog"][data-id="${id}"]`)?.click();
    if (action === "expense") return startExpenseForRepair(id);
    if (action === "followup") return createFollowupTaskForRepair(id);
    if (action === "complete") return markCardComplete("repairLog", id);
    if (action === "delete") return deleteRecord("repairLog", id, "repair");
  }

  if (scope === "contractorLibrary") {
    if (action === "bid") return startBidForContractor(id);
    if (action === "repair") return createRepairForContractor(id);
    if (action === "expense") return startExpenseForContractor(id);
    if (action === "followup") return createFollowupTaskForContractor(id);
    if (action === "edit") return startEdit("contractorLibraryForm", "contractorLibrary", id);
    if (action === "status") return cycleRecord("contractorLibrary", id);
    if (action === "delete") return deleteRecord("contractorLibrary", id, "contractor");
  }
}

function startExpenseForMaintenance(itemId) {
  const item = activeItems(state.maintenanceCalendar).find((entry) => entry.id === itemId);
  if (!item) return;
  startExpenseFromContext({
    item: `${item.location || "Maintenance"} - ${item.task}`,
    amount: 0,
    type: "Estimate"
  });
}

function startExpenseForFleetVehicle(vehicleId) {
  const vehicle = activeItems(state.fleetVehicles).find((entry) => entry.id === vehicleId);
  if (!vehicle) return;
  startExpenseFromContext({
    item: `${vehicle.vehicle} service`,
    amount: 0,
    type: "Estimate"
  });
}

function startExpenseForRepair(repairId) {
  const repair = activeItems(state.repairLog).find((entry) => entry.id === repairId);
  if (!repair) return;
  startExpenseFromContext({
    item: `${repair.areaSystemVehicle || "Repair"} - ${repair.issue}`,
    amount: Number(repair.contractorCost || repair.estimatedCost || repair.cost || 0),
    type: repair.contractorCost || repair.cost ? "Committed" : "Estimate"
  });
}

function createRepairFromMaintenance(itemId) {
  const item = activeItems(state.maintenanceCalendar).find((entry) => entry.id === itemId);
  if (!item) return;
  const id = crypto.randomUUID();
  state.appSettings.editMode = true;
  saveChange({
    type: "create",
    collection: "repairLog",
    id,
    payload: normalizeRepairLogItem({
      id,
      date: todayDateString(),
      areaSystemVehicle: item.location,
      issue: item.task,
      actionTaken: `Created from maintenance item scheduled ${item.date || "TBD"}.`,
      priority: "Normal",
      status: "Assessing",
      followUpDate: item.date,
      notes: item.notes
    })
  });
  activateView("repairLog", "Repair Log");
}

function createRepairForFleetVehicle(vehicleId) {
  const vehicle = activeItems(state.fleetVehicles).find((entry) => entry.id === vehicleId);
  if (!vehicle) return;
  const id = crypto.randomUUID();
  state.appSettings.editMode = true;
  saveChange({
    type: "create",
    collection: "repairLog",
    id,
    payload: normalizeRepairLogItem({
      id,
      date: todayDateString(),
      areaSystemVehicle: vehicle.vehicle,
      issue: `${vehicle.vehicle} service`,
      actionTaken: vehicle.notes,
      priority: "Normal",
      status: "Assessing",
      notes: `${vehicle.type || ""} ${vehicle.plateVin || ""}`.trim()
    })
  });
  activateView("repairLog", "Repair Log");
}

function createMileageForFleetVehicle(vehicleId) {
  const vehicle = activeItems(state.fleetVehicles).find((entry) => entry.id === vehicleId);
  if (!vehicle) return;
  const id = crypto.randomUUID();
  saveChange({
    type: "create",
    collection: "mileageLog",
    id,
    payload: normalizeMileageLogItem({
      id,
      date: todayDateString(),
      vehicle: vehicle.vehicle,
      startMileage: vehicle.currentMileage || 0,
      endMileage: vehicle.currentMileage || 0,
      driverInitials: "",
      notes: "New mileage entry"
    })
  });
  activateView("mileageLog", "Mileage Log");
}

function createFollowupTaskForRepair(repairId) {
  const repair = activeItems(state.repairLog).find((entry) => entry.id === repairId);
  if (!repair) return;
  const id = crypto.randomUUID();
  saveChange({
    type: "create",
    collection: "tasks",
    id,
    payload: {
      projectId: getActiveProjectId(),
      title: `Follow up: ${repair.issue || "repair"}`,
      room: repair.areaSystemVehicle || "Repair Log",
      start: todayDateString(),
      due: repair.followUpDate || addDays(todayDateString(), 2),
      duration: "Follow-up",
      priority: repair.priority || "Normal",
      estimatedCost: Number(repair.estimatedCost || 0),
      contractorCost: Number(repair.contractorCost || 0),
      notes: repair.notes || repair.actionTaken || "",
      attachments: structuredClone(repair.attachments || []),
      history: [],
      lastUpdated: new Date().toISOString(),
      status: "Todo"
    }
  });
  activeTaskRoomFilter = repair.areaSystemVehicle || "";
  activateView("tasks", "Tasks");
}

function activateView(viewId, label = "") {
  const view = document.querySelector(`#${viewId}`);
  if (!view) return;
  document.querySelectorAll(".tab, .bottom-tab, .view").forEach((el) => el.classList.remove("active"));
  view.classList.add("active");
  document.querySelectorAll(`[data-view="${viewId}"]`).forEach((button) => button.classList.add("active"));
  document.querySelector("#viewTitle").textContent = label || document.querySelector(`.tab[data-view="${viewId}"]`)?.textContent || "Dashboard";
  document.querySelector("#mainNav")?.classList.remove("is-open");
  document.querySelector("#mobileMenuToggle")?.setAttribute("aria-expanded", "false");
}

document.querySelectorAll(".tab, .bottom-tab").forEach((tab) => {
  tab.addEventListener("click", () => activateView(tab.dataset.view, tab.textContent));
});

document.querySelectorAll("[data-open-view]").forEach((button) => {
  button.addEventListener("click", () => activateView(button.dataset.openView));
});

document.querySelector("#mobileMenuToggle")?.addEventListener("click", () => {
  const nav = document.querySelector("#mainNav");
  const isOpen = nav.classList.toggle("is-open");
  document.querySelector("#mobileMenuToggle").setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll("[data-filter]").forEach((filter) => {
  filter.addEventListener("change", (event) => {
    facilityFilters[event.target.dataset.filter] = event.target.value;
    renderFacilities();
  });
});

document.querySelector("#projectName").addEventListener("input", (event) => {
  showSaveStatus("Saving...");
  saveWorkspaceChange({ projectName: event.target.value });
});

document.querySelector("#targetDate").addEventListener("input", (event) => {
  showSaveStatus("Saving...");
  saveWorkspaceChange({ targetDate: event.target.value });
});

document.querySelector("#expectedDuration").addEventListener("input", (event) => {
  showSaveStatus("Saving...");
  saveWorkspaceChange({ expectedDuration: event.target.value });
});

document.querySelector("#projectSelect")?.addEventListener("change", (event) => {
  state.appSettings.activeProjectId = event.target.value;
  const project = getActiveProject();
  if (project) state.projectName = project.name;
  saveAndRender();
});

document.querySelector("#newProjectBtn")?.addEventListener("click", () => {
  const name = prompt("New project name?");
  if (!name) return;
  const now = new Date().toISOString();
  const project = { id: crypto.randomUUID(), name: name.trim(), status: "Active", createdAt: now, updatedAt: now, notes: "" };
  state.projects.push(project);
  state.appSettings.activeProjectId = project.id;
  state.projectName = project.name;
  saveAndRender();
});

document.querySelector("#editModeToggle")?.addEventListener("change", (event) => {
  state.appSettings.editMode = event.target.checked;
  saveAndRender();
});

document.querySelector("#toolbarSaveBtn")?.addEventListener("click", () => {
  saveAndRender();
  if (isAutoSyncEnabled()) saveToGoogle();
});

document.querySelector("#quickActionGo")?.addEventListener("click", () => {
  const select = document.querySelector("#quickActionSelect");
  const action = select?.value || "";
  if (!action) return showSaveStatus("Choose what to create first");
  handleQuickAction(action);
  select.value = "";
});

document.querySelector("#fileActionGo")?.addEventListener("click", () => {
  const select = document.querySelector("#fileActionSelect");
  const action = select?.value || "";
  if (!action) return showSaveStatus("Choose a file action first");
  if (action === "print") {
    renderPrintReport();
    window.print();
  }
  if (action === "export") downloadBackup();
  if (action === "import") document.querySelector("#importFile").click();
  if (action === "reset") {
    state = normalizeState(structuredClone(seedData));
    saveAndRender();
  }
  select.value = "";
});

document.querySelector("#backendUrl").addEventListener("change", (event) => {
  localStorage.setItem(BACKEND_URL_KEY, event.target.value.trim());
  document.querySelector("#bottomBackendUrl").value = event.target.value.trim();
  showSyncStatus("Backup URL saved");
});

document.querySelector("#bottomBackendUrl")?.addEventListener("change", (event) => {
  localStorage.setItem(BACKEND_URL_KEY, event.target.value.trim());
  document.querySelector("#backendUrl").value = event.target.value.trim();
  showSyncStatus("Backup URL saved");
});

document.querySelector("#autoSyncToggle").addEventListener("change", (event) => {
  localStorage.setItem(AUTO_SYNC_KEY, event.target.checked ? "yes" : "no");
  showSyncStatus(event.target.checked ? "Auto-save backup on" : "Auto-save backup off");
  if (event.target.checked) scheduleAutoSync();
});

document.querySelector("#autoLoadToggle").addEventListener("change", (event) => {
  localStorage.setItem(AUTO_LOAD_KEY, event.target.checked ? "yes" : "no");
  showSyncStatus(event.target.checked ? "Auto-load backup on" : "Auto-load backup off");
  if (event.target.checked) loadFromGoogle({ automatic: true });
});

document.querySelectorAll("form").forEach((form) => {
  form.addEventListener("input", () => {
    saveDrafts();
    showSaveStatus("Draft saved");
  });

  form.addEventListener("change", () => {
    saveDrafts();
    showSaveStatus("Draft saved");
  });
});

document.querySelector("#roomForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData(event.target);
  const editingId = event.target.dataset.editingId;
  const id = editingId || crypto.randomUUID();

  saveChange({
    type: editingId ? "update" : "create",
    collection: "rooms",
    id,
    payload: {
      name: data.name,
      budget: Number(data.budget),
      sqft: Number(data.sqft),
      duration: data.duration,
      status: data.status
    }
  });

  resetForm(event.target);
  clearFormDraft("roomForm");
});

document.querySelector("#taskForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData(event.target);
  const editingId = event.target.dataset.editingId;
  const id = editingId || crypto.randomUUID();
  const existingTask = editingId
    ? state.tasks.find((task) => task.id === editingId)
    : null;

  saveChange({
    type: editingId ? "update" : "create",
    collection: "tasks",
    id,
    payload: {
      projectId: getActiveProjectId(),
      title: data.title,
      room: data.room,
      start: data.start,
      due: data.due,
      duration: data.duration,
      priority: data.priority,
      estimatedCost: Number(data.estimatedCost || 0),
      contractorCost: Number(data.contractorCost || 0),
      notes: data.notes,
      attachments: existingTask?.attachments || [],
      history: existingTask?.history || [],
      lastUpdated: new Date().toISOString(),
      status: data.status
    }
  });

  resetForm(event.target);
  clearFormDraft("taskForm");
});

document.querySelector("#bidForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData(event.target);
  const editingId = event.target.dataset.editingId;
  const id = editingId || crypto.randomUUID();
  const bidValues = normalizeBid({
    contractor: data.contractor,
    amount: Number(data.amount),
    timeline: data.timeline,
    included: data.included,
    exclusions: data.exclusions,
    allowanceAmount: Number(data.allowanceAmount || 0),
    materialsIncluded: data.materialsIncluded,
    laborIncluded: data.laborIncluded,
    permitFeesIncluded: data.permitFeesIncluded,
    bidDocumentName: data.bidDocumentName,
    bidPdfUrl: data.bidPdfUrl,
    bidReceivedDate: data.bidReceivedDate,
    contact: data.contact,
    notes: data.notes,
    status: data.status
  });
  delete bidValues.id;

  saveChange({
    type: editingId ? "update" : "create",
    collection: "bids",
    id,
    payload: bidValues
  });

  resetForm(event.target);
  clearFormDraft("bidForm");
});

document.querySelector("#extractBidBtn").addEventListener("click", () => {
  const form = document.querySelector("#bidForm");
  const source = form.elements.namedItem("bidTextSource").value;
  const extracted = extractBidInfo(source);
  Object.entries(extracted).forEach(([key, value]) => {
    if (value === "" || value == null) return;
    const field = form.elements.namedItem(key);
    if (field && !field.value) field.value = value;
  });
  showSaveStatus(Object.keys(extracted).length ? "Bid info extracted" : "No bid info found");
});

document.querySelector("#expenseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData(event.target);
  const editingId = event.target.dataset.editingId;
  const id = editingId || crypto.randomUUID();

  saveChange({
    type: editingId ? "update" : "create",
    collection: "expenses",
    id,
    payload: {
      item: data.item,
      amount: Number(data.amount),
      type: data.type
    }
  });

  resetForm(event.target);
  clearFormDraft("expenseForm");
});

document.querySelector("#decisionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData(event.target);
  const editingId = event.target.dataset.editingId;
  const id = editingId || crypto.randomUUID();

  saveChange({
    type: editingId ? "update" : "create",
    collection: "decisions",
    id,
    payload: {
      title: data.title,
      owner: data.owner,
      status: data.status
    }
  });

  resetForm(event.target);
  clearFormDraft("decisionForm");
});

document.body.addEventListener("click", (event) => {
  const cycleTarget = event.target.closest("[data-cycle]");
  const deleteTarget = event.target.closest("[data-delete]");
  const editTarget = event.target.closest("[data-edit]");
  const cancelTarget = event.target.closest("[data-cancel]");
  const materialToggle = event.target.closest("[data-toggle-materials]");
  const materialEdit = event.target.closest("[data-edit-material]");
  const materialCancel = event.target.closest("[data-cancel-material]");
  const facilityReportTarget = event.target.closest("[data-facility-report]");
  const quickAction = event.target.closest("[data-quick-action]");
  const documentSave = event.target.closest("[data-save-document]");
  const followupTarget = event.target.closest("[data-followup-bid]");
  const duplicateTarget = event.target.closest("[data-duplicate-card]");
  const saveCardTarget = event.target.closest("[data-save-card]");
  const historyTarget = event.target.closest("[data-view-history]");
  const viewTarget = event.target.closest("[data-view-card]");
  const completeTarget = event.target.closest("[data-mark-complete]");
  const editCardModeTarget = event.target.closest("[data-edit-card-mode]");
  const actionGoTarget = event.target.closest("[data-action-go]");
  const pageActionAddTarget = event.target.closest("[data-page-action-add]");
  const pageActionGoTarget = event.target.closest("[data-page-action-go]");
  const viewRoomTasksTarget = event.target.closest("[data-view-room-tasks]");
  const addTaskRoomTarget = event.target.closest("[data-add-task-room]");
  const clearTaskRoomFilterTarget = event.target.closest("[data-clear-task-room-filter]");
  const addMaterialTaskTarget = event.target.closest("[data-add-material-task]");
  const addExpenseContextTarget = event.target.closest("[data-add-expense-context]");
  const addExpenseTaskTarget = event.target.closest("[data-add-expense-task]");
  const addExpenseMaterialTarget = event.target.closest("[data-add-expense-material]");
  const addExpenseBidTarget = event.target.closest("[data-add-expense-bid]");
  const addDecisionBidTarget = event.target.closest("[data-add-decision-bid]");
  const createRepairMaintenanceTarget = event.target.closest("[data-create-repair-maintenance]");
  const addExpenseMaintenanceTarget = event.target.closest("[data-add-expense-maintenance]");
  const createRepairVehicleTarget = event.target.closest("[data-create-repair-vehicle]");
  const addMileageVehicleTarget = event.target.closest("[data-add-mileage-vehicle]");
  const addExpenseVehicleTarget = event.target.closest("[data-add-expense-vehicle]");
  const addExpenseRepairTarget = event.target.closest("[data-add-expense-repair]");
  const followupRepairTarget = event.target.closest("[data-followup-repair]");
  const repairStatusTarget = event.target.closest("[data-repair-status]");
  const createBidContractorTarget = event.target.closest("[data-create-bid-contractor]");
  const createRepairContractorTarget = event.target.closest("[data-create-repair-contractor]");
  const addExpenseContractorTarget = event.target.closest("[data-add-expense-contractor]");
  const followupContractorTarget = event.target.closest("[data-followup-contractor]");
  const createRepairEquipmentTarget = event.target.closest("[data-create-repair-equipment]");
  const addExpenseEquipmentTarget = event.target.closest("[data-add-expense-equipment]");
  const scheduleMaintenanceEquipmentTarget = event.target.closest("[data-schedule-maintenance-equipment]");

  if (actionGoTarget) {
    const scope = actionGoTarget.dataset.actionGo;
    const id = actionGoTarget.dataset.actionId;
    const menu = document.querySelector(`[data-action-choice="${scope}"][data-action-id="${id}"]`);
    const action = menu?.value || "";
    runRecordAction(scope, id, action);
    if (menu) menu.value = "";
  }

  if (pageActionGoTarget) {
    runPageAction(pageActionGoTarget.dataset.pageActionGo);
  }

  if (pageActionAddTarget) {
    prepareNewForm(pageActionAddTarget.dataset.pageActionAdd);
  }

  if (viewRoomTasksTarget) {
    openTasksForRoom(viewRoomTasksTarget.dataset.viewRoomTasks);
  }

  if (addTaskRoomTarget) {
    startTaskForRoom(addTaskRoomTarget.dataset.addTaskRoom);
  }

  if (clearTaskRoomFilterTarget) {
    activeTaskRoomFilter = "";
    renderTasks();
  }

  if (addMaterialTaskTarget) {
    openMaterialsForTask(addMaterialTaskTarget.dataset.addMaterialTask);
  }

  if (addExpenseContextTarget) {
    startExpenseForRoom(addExpenseContextTarget.dataset.addExpenseContext);
  }

  if (addExpenseTaskTarget) {
    startExpenseForTask(addExpenseTaskTarget.dataset.addExpenseTask);
  }

  if (addExpenseMaterialTarget) {
    startExpenseForMaterial(addExpenseMaterialTarget.dataset.addExpenseMaterial);
  }

  if (addExpenseBidTarget) {
    startExpenseForBid(addExpenseBidTarget.dataset.addExpenseBid);
  }

  if (addDecisionBidTarget) {
    startDecisionForBid(addDecisionBidTarget.dataset.addDecisionBid);
  }

  if (createRepairMaintenanceTarget) {
    createRepairFromMaintenance(createRepairMaintenanceTarget.dataset.createRepairMaintenance);
  }

  if (addExpenseMaintenanceTarget) {
    startExpenseForMaintenance(addExpenseMaintenanceTarget.dataset.addExpenseMaintenance);
  }

  if (createRepairVehicleTarget) {
    createRepairForFleetVehicle(createRepairVehicleTarget.dataset.createRepairVehicle);
  }

  if (addMileageVehicleTarget) {
    createMileageForFleetVehicle(addMileageVehicleTarget.dataset.addMileageVehicle);
  }

  if (addExpenseVehicleTarget) {
    startExpenseForFleetVehicle(addExpenseVehicleTarget.dataset.addExpenseVehicle);
  }

  if (addExpenseRepairTarget) {
    startExpenseForRepair(addExpenseRepairTarget.dataset.addExpenseRepair);
  }

  if (followupRepairTarget) {
    createFollowupTaskForRepair(followupRepairTarget.dataset.followupRepair);
  }

  if (repairStatusTarget) {
    saveChange({
      type: "update",
      collection: "repairLog",
      id: repairStatusTarget.dataset.repairStatus,
      payload: {
        status: repairStatusTarget.dataset.status,
        lastUpdated: new Date().toISOString()
      }
    });
  }

  if (createBidContractorTarget) {
    startBidForContractor(createBidContractorTarget.dataset.createBidContractor);
  }

  if (createRepairContractorTarget) {
    createRepairForContractor(createRepairContractorTarget.dataset.createRepairContractor);
  }

  if (addExpenseContractorTarget) {
    startExpenseForContractor(addExpenseContractorTarget.dataset.addExpenseContractor);
  }

  if (followupContractorTarget) {
    createFollowupTaskForContractor(followupContractorTarget.dataset.followupContractor);
  }

  if (createRepairEquipmentTarget) {
    createRepairForEquipment(createRepairEquipmentTarget.dataset.createRepairEquipment);
  }

  if (addExpenseEquipmentTarget) {
    startExpenseForEquipment(addExpenseEquipmentTarget.dataset.addExpenseEquipment);
  }

  if (scheduleMaintenanceEquipmentTarget) {
    scheduleMaintenanceForEquipment(scheduleMaintenanceEquipmentTarget.dataset.scheduleMaintenanceEquipment);
  }

  if (quickAction) {
    handleQuickAction(quickAction.dataset.quickAction);
  }

  if (saveCardTarget) {
    saveCardEdits(saveCardTarget.dataset.saveCard, saveCardTarget.dataset.id);
  }

  if (duplicateTarget) {
    duplicateCard(duplicateTarget.dataset.duplicateCard, duplicateTarget.dataset.id);
  }

  if (historyTarget) {
    showCardHistory(historyTarget.dataset.viewHistory, historyTarget.dataset.id);
  }

  if (viewTarget) {
    showCardDetails(viewTarget.dataset.viewCard, viewTarget.dataset.id);
  }

  if (completeTarget) {
    markCardComplete(completeTarget.dataset.markComplete, completeTarget.dataset.id);
  }

  if (editCardModeTarget) {
    state.appSettings.editMode = true;
    saveAndRender();
  }

  if (documentSave) {
    saveReviewedDocument(documentSave.dataset.saveDocument);
  }

  if (followupTarget) {
    createBidFollowup(followupTarget.dataset.followupBid, followupTarget.dataset.followupType || "Follow up");
  }

  if (facilityReportTarget) {
    activeFacilityReport = facilityReportTarget.dataset.facilityReport;
    renderPrintReport();
    window.print();
    activeFacilityReport = "";
  }

  if (materialToggle) {
    activeMaterialTaskId =
      activeMaterialTaskId === materialToggle.dataset.toggleMaterials ? "" : materialToggle.dataset.toggleMaterials;
    renderTasks();
  }

  if (materialEdit) {
    startMaterialEdit(materialEdit.dataset.editMaterial);
  }

  if (materialCancel) {
    resetMaterialForm(materialCancel.closest("[data-material-form]"));
  }

  if (cycleTarget) {
    const collection = cycleTarget.dataset.cycle;
    const item = state[collection].find((entry) => entry.id === cycleTarget.dataset.id);
    const field = collection === "expenses" ? "type" : "status";
    const values = cycles[collection];
    if (!item || !values) return;

    saveChange({
      type: "update",
      collection,
      id: item.id,
      payload: {
        [field]: values[(values.indexOf(item[field]) + 1) % values.length]
      }
    });
  }

  if (deleteTarget) {
    if (!confirm("Are you sure you want to delete this item?")) return;
    const collection = deleteTarget.dataset.delete;
    const id = deleteTarget.dataset.id;

    saveChange({
      type: "delete",
      collection,
      id,
      payload: {}
    });

    if (collection === "tasks") {
      state.materials
        .filter((material) => material.taskId === id && !material.deletedAt)
        .forEach((material) => {
          saveChange({
            type: "delete",
            collection: "materials",
            id: material.id,
            payload: {}
          });
        });
      if (activeMaterialTaskId === id) activeMaterialTaskId = "";
    }
    clearEditState();
  }

  if (editTarget) {
    startEdit(editTarget.dataset.form, editTarget.dataset.edit, editTarget.dataset.id);
  }

  if (cancelTarget) {
    resetForm(document.querySelector(`#${cancelTarget.dataset.cancel}`));
  }
});

document.body.addEventListener("change", (event) => {
  const field = event.target.closest("[data-card-field]");
  const attachment = event.target.closest("[data-attach-file]");

  if (field) {
    updateCardField(field);
  }
  if (attachment) {
    attachFileToCard(attachment.dataset.attachFile, attachment.dataset.id, attachment.files?.[0]);
    attachment.value = "";
  }
});

document.body.addEventListener("submit", (event) => {
  const materialForm = event.target.closest("[data-material-form]");
  if (!materialForm) return;

  event.preventDefault();
  const data = formData(materialForm);
  const values = {
    taskId: materialForm.dataset.taskId,
    item: data.item,
    company: data.company,
    cost: Number(data.cost),
    status: data.status
  };
  const editingId = materialForm.dataset.editingId;
  const id = editingId || crypto.randomUUID();

  saveChange({
    type: editingId ? "update" : "create",
    collection: "materials",
    id,
    payload: values
  });

  resetMaterialForm(materialForm);
});

document.querySelector("#printBtn").addEventListener("click", () => {
  renderPrintReport();
  window.print();
});

document.querySelector("#exportBtn").addEventListener("click", () => {
  downloadBackup();
});

document.querySelector("#saveCloudBtn").addEventListener("click", () => {
  saveToGoogle();
});

document.querySelector("#loadCloudBtn").addEventListener("click", () => {
  loadFromGoogle();
});

document.querySelector("#bottomSaveCloudBtn")?.addEventListener("click", () => saveToGoogle());
document.querySelector("#bottomLoadCloudBtn")?.addEventListener("click", () => loadFromGoogle());
document.querySelector("#bottomRetrySyncBtn")?.addEventListener("click", () => syncNow());
document.querySelector("#bottomClearSyncedBtn")?.addEventListener("click", () => clearSyncedQueueItems());

document.querySelector("#syncDockToggle")?.addEventListener("click", () => {
  const dock = document.querySelector("#bottomSyncCenter");
  const isOpen = dock.classList.toggle("is-open");
  document.querySelector("#syncDockToggle").setAttribute("aria-expanded", String(isOpen));
});

document.querySelector("#syncDockClose")?.addEventListener("click", () => {
  document.querySelector("#bottomSyncCenter")?.classList.remove("is-open");
  document.querySelector("#syncDockToggle")?.setAttribute("aria-expanded", "false");
});

document.querySelector("#restoreDefaultBackendBtn")?.addEventListener("click", () => {
  localStorage.setItem(BACKEND_URL_KEY, DEFAULT_BACKEND_URL);
  document.querySelector("#backendUrl").value = DEFAULT_BACKEND_URL;
  showSyncStatus("Default backend URL restored");
});

document.querySelector("#retrySyncBtn")?.addEventListener("click", () => {
  syncNow();
});

document.querySelector("#clearSyncedQueueBtn")?.addEventListener("click", () => {
  clearSyncedQueueItems();
});

document.querySelector("#clearLocalCacheBtn")?.addEventListener("click", () => {
  if (!confirm("Clear local cached tracker data on this device? Load from Google afterward to restore shared data.")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = normalizeState(structuredClone(seedData));
  render();
  showSyncStatus("Local cache cleared");
});

document.querySelector("#syncCenterSaveBtn")?.addEventListener("click", () => saveToGoogle());
document.querySelector("#syncCenterLoadBtn")?.addEventListener("click", () => loadFromGoogle());
document.querySelector("#syncCenterRetryBtn")?.addEventListener("click", () => syncNow());
document.querySelector("#syncCenterClearSyncedBtn")?.addEventListener("click", () => clearSyncedQueueItems());
document.querySelector("#syncCenterExportBtn")?.addEventListener("click", () => downloadBackup());
document.querySelector("#syncCenterImportBtn")?.addEventListener("click", () => document.querySelector("#importFile").click());
document.querySelector("#syncCenterClearCacheBtn")?.addEventListener("click", () => {
  if (!confirm("Clear local cached tracker data on this device? Load from Google afterward to restore shared data.")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = normalizeState(structuredClone(seedData));
  render();
  showSyncStatus("Local cache cleared");
});

document.querySelector("#settingsExportBtn").addEventListener("click", () => {
  downloadBackup();
});

document.querySelector("#settingsImportBtn").addEventListener("click", () => {
  document.querySelector("#importFile").click();
});

document.querySelector("#reportBuilder").addEventListener("change", () => {
  renderReportPreview();
});

document.querySelector("#previewReportBtn").addEventListener("click", () => {
  renderReportPreview();
});

document.querySelector("#selectAllReportSections").addEventListener("click", () => {
  document.querySelectorAll("#reportBuilder input[name='sections']").forEach((input) => {
    input.checked = true;
  });
  renderReportPreview();
});

document.querySelector("#clearReportSections").addEventListener("click", () => {
  document.querySelectorAll("#reportBuilder input[name='sections']").forEach((input) => {
    input.checked = false;
  });
  renderReportPreview();
});

document.querySelector("#printCustomReportBtn").addEventListener("click", () => {
  activeCustomReport = true;
  renderPrintReport();
  window.print();
  activeCustomReport = false;
});

document.querySelector("#documentIntakeForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
});

document.querySelector("#extractDocumentBtn")?.addEventListener("click", () => {
  startDocumentExtraction();
});

document.querySelector("#contractorLibraryForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData(event.target);
  const editingId = event.target.dataset.editingId;
  const id = editingId || crypto.randomUUID();
  const contractorValues = normalizeContractorRecord({ id, ...data });
  delete contractorValues.id;

  saveChange({
    type: editingId ? "update" : "create",
    collection: "contractorLibrary",
    id,
    payload: contractorValues
  });

  resetForm(event.target);
  clearFormDraft("contractorLibraryForm");
});

document.querySelector("#equipmentForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formData(event.target);
  const editingId = event.target.dataset.editingId;
  const id = editingId || crypto.randomUUID();
  const equipmentValues = normalizeEquipmentItem({ id, ...data });
  delete equipmentValues.id;

  saveChange({
    type: editingId ? "update" : "create",
    collection: "equipment",
    id,
    payload: equipmentValues
  });

  resetForm(event.target);
  clearFormDraft("equipmentForm");
});

document.querySelector("#importBtn").addEventListener("click", () => {
  document.querySelector("#importFile").click();
});

document.querySelector("#importFile").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (/\.(xlsx|xlsm)$/i.test(file.name)) {
    importFacilitiesWorkbook(file).finally(() => {
      event.target.value = "";
    });
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      state = normalizeState(JSON.parse(reader.result));
      activeMaterialTaskId = "";
      saveAndRender();
      showSaveStatus("Backup loaded");
    } catch (error) {
      showSaveStatus("Backup could not load");
    }
    event.target.value = "";
  });
  reader.readAsText(file);
});

document.querySelector("#resetBtn").addEventListener("click", () => {
  state = normalizeState(structuredClone(seedData));
  saveAndRender();
});

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function saveDrafts() {
  const drafts = {};
  document.querySelectorAll("form[id]").forEach((form) => {
    if (form.dataset.editingId) return;
    const values = formData(form);
    const hasValue = Object.values(values).some((value) => String(value).trim() !== "");
    if (hasValue) drafts[form.id] = values;
  });
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

function restoreDrafts() {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (!saved) return;

  const drafts = JSON.parse(saved);
  Object.entries(drafts).forEach(([formId, values]) => {
    const form = document.querySelector(`#${formId}`);
    if (!form) return;
    Object.entries(values).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field && field.type !== "file" && value) field.value = value;
    });
  });
}

function clearFormDraft(formId) {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (!saved) return;
  const drafts = JSON.parse(saved);
  delete drafts[formId];
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

function downloadBackup() {
  saveState();
  const stamp = todayDateString();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(state.projectName || "remodel-tracker")}-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showSaveStatus("Backup saved");
}

function getBackendUrl() {
  return localStorage.getItem(BACKEND_URL_KEY) || DEFAULT_BACKEND_URL;
}

function isAutoSyncEnabled() {
  return localStorage.getItem(AUTO_SYNC_KEY) === "yes";
}

function isAutoLoadEnabled() {
  return localStorage.getItem(AUTO_LOAD_KEY) === "yes";
}

function scheduleAutoSync() {
  if (!isAutoSyncEnabled() || isCloudSyncing) return;
  clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    saveToGoogle({ automatic: true });
  }, 2500);
}

function showSyncStatus(message, isWarning = false) {
  const status = document.querySelector("#syncStatus");
  if (status) {
    status.textContent = message;
    status.classList.toggle("is-saving", !isWarning && message !== "Room sync ready");
    status.classList.toggle("storage-warning", isWarning);
  }
  state.syncMeta = {
    ...(state.syncMeta || {}),
    status: isWarning ? "Sync Failed" : message
  };
  renderSyncStatus();
}

function renderSyncStatus() {
  const meta = state.syncMeta || {};
  const queueSummary = getSyncQueueSummary();
  const pendingLabel = `${queueSummary.unsynced.toLocaleString()} pending`;
  let status = "Synced";

  if (queueSummary.conflicts > 0) {
    status = "Conflict";
  } else if (queueSummary.failed > 0) {
    status = queueSummary.firstError || "Sync failed. Your changes are saved locally.";
  } else if (queueSummary.syncing > 0) {
    status = "Syncing...";
  } else if (queueSummary.pending > 0) {
    status = "Saved locally - pending sync";
  } else if (!navigator.onLine) {
    status = "Offline Mode";
  } else if (/fail|error|conflict/i.test(meta.status || "")) {
    status = meta.status;
  }

  const lastSync = meta.lastSyncedAt ? new Date(meta.lastSyncedAt).toLocaleString() : "Never";
  const unsynced = queueSummary.unsynced.toLocaleString();
  setText("#globalSyncStatus", status);
  setText("#lastSyncedAt", lastSync);
  setText("#unsyncedCount", unsynced);
  setText("#syncCenterStatus", status);
  setText("#syncCenterLastSync", lastSync);
  setText("#syncCenterUnsynced", unsynced);
  setText("#syncCenterStatusStandalone", status);
  setText("#syncCenterLastSyncStandalone", lastSync);
  setText("#syncCenterUnsyncedStandalone", unsynced);
  setText("#headerSyncStatus", status);
  setText("#syncDockStatus", status);
  setText("#syncDockLastSync", lastSync);
  setText("#syncPendingCount", pendingLabel);
  document.querySelector("#syncDockDot")?.classList.toggle("is-error", /fail|error|offline/i.test(status));
  document.querySelector("#syncDockDot")?.classList.toggle("is-saving", /saving|syncing|unsynced|pending/i.test(status));
}

function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

function logSync(action, status, message = "") {
  state.syncLog = [normalizeSyncLogItem({ action, status, message })].concat(state.syncLog || []).slice(0, 50);
}

function getQueueItemLabel(change) {
  const action = change.type || "change";
  const collection = change.collection || "record";
  const payloadName = change.payload?.name || change.payload?.title || change.payload?.item || change.payload?.contractor || "";
  return `${collection} ${action}${payloadName ? `: ${payloadName}` : ""}`;
}

function queueStatusLabel(status) {
  if (status === "synced") return "Synced";
  if (status === "syncing") return "Syncing";
  if (status === "failed") return "Sync failed";
  if (status === "conflict") return "Conflict";
  return "Pending";
}

function queueItemTime(change) {
  const value = change.syncedAt || change.lastAttemptAt || change.updatedAt || change.createdAt;
  return value ? new Date(value).toLocaleString() : "";
}

async function saveToGoogle(options = {}) {
  const url = getBackendUrl().trim();
  if (!url) {
    showSyncStatus("Add the Google backend URL first", true);
    logSync("save", "failed", "Missing backend URL");
    return;
  }

  isCloudSyncing = true;
  const now = new Date().toISOString();
  state.syncMeta = {
    ...(state.syncMeta || {}),
    lastUpdated: state.syncMeta?.lastUpdated || now,
    updatedByDevice: getDeviceId(),
    appVersion: APP_VERSION,
    syncId: state.syncMeta?.syncId || crypto.randomUUID(),
    status: "Saving..."
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  showSyncStatus(options.automatic ? "Saving..." : "Saving...");
  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        ...state,
        syncedAt: now,
        syncMeta: {
          ...state.syncMeta,
          lastUpdated: now,
          lastSyncedAt: now,
          updatedByDevice: getDeviceId(),
          appVersion: APP_VERSION
        }
      })
    });
    state.syncMeta = {
      ...state.syncMeta,
      lastUpdated: now,
      lastSyncedAt: now,
      unsyncedChanges: 0,
      status: "Synced with Google"
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    logSync("save", "success", "Saved to Google");
    showSyncStatus("Synced with Google");
  } catch (error) {
    state.syncMeta = { ...state.syncMeta, status: navigator.onLine ? "Sync Failed" : "Offline Mode" };
    logSync("save", "failed", "Google save failed");
    showSyncStatus("Google save failed - check the Web App URL and deployment access", true);
  } finally {
    isCloudSyncing = false;
    renderSyncLog();
  }
}

function loadFromGoogle(options = {}) {
  const url = getBackendUrl().trim();
  if (!url) {
    showSyncStatus("Add the Google backend URL first", true);
    return;
  }

  showSyncStatus(options.automatic ? "Auto-loading latest Google save..." : "Loading from Google...");
  isCloudSyncing = true;
  googleJsonp(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`)
    .then((data) => {
      if (!data || typeof data !== "object") throw new Error("No saved tracker data found");
      const googleState = normalizeState(data);
      const localUpdated = Date.parse(state.syncMeta?.lastUpdated || 0) || 0;
      const googleUpdated = Date.parse(googleState.syncMeta?.lastUpdated || data.syncedAt || 0) || 0;

      if (localUpdated > googleUpdated && Number(state.syncMeta?.unsyncedChanges || 0) > 0) {
        const saveLocal = confirm("This device has newer unsynced changes than Google. Press OK to save this device to Google, or Cancel to discard this device cache and load Google.");
        if (saveLocal) {
          logSync("load", "conflict", "Local data newer; user chose save to Google");
          saveToGoogle({ automatic: options.automatic });
          return;
        }
      }

      const now = new Date().toISOString();
      state = normalizeState({
        ...googleState,
        syncMeta: {
          ...googleState.syncMeta,
          lastSyncedAt: now,
          unsyncedChanges: 0,
          status: "Synced with Google"
        }
      });
      activeMaterialTaskId = "";
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      logSync("load", "success", googleUpdated > localUpdated ? "Loaded newer Google data" : "Loaded Google data");
      render();
      showSyncStatus("Synced with Google");
    })
    .catch(() => {
      state.syncMeta = { ...state.syncMeta, status: navigator.onLine ? "Sync Failed" : "Offline Mode" };
      logSync("load", "failed", "Google load failed");
      showSyncStatus("Google load failed - update Apps Script, then redeploy", true);
    })
    .finally(() => {
      isCloudSyncing = false;
      renderSyncLog();
    });
}

function googleJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `trackerSync_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("Google JSONP load failed"));
    };
    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${encodeURIComponent(callbackName)}`;
    document.body.appendChild(script);

    function cleanup() {
      delete window[callbackName];
      script.remove();
    }
  });
}

function upsert(formId, values) {
  const form = document.querySelector(`#${formId}`);
  const collection = formCollections[formId];
  const id = form.dataset.editingId;

  if (id) {
    const item = state[collection].find((entry) => entry.id === id);
    const previousRoomName = collection === "rooms" ? item.name : "";
    Object.assign(item, values);
    if (collection === "rooms" && previousRoomName !== values.name) {
      state.tasks.forEach((task) => {
        if (task.room === previousRoomName) task.room = values.name;
      });
    }
  } else {
    state[collection].push({ id: crypto.randomUUID(), ...values });
  }

  resetForm(form);
  clearFormDraft(formId);
}

function startEdit(formId, collection, id) {
  const form = document.querySelector(`#${formId}`);
  const item = state[collection].find((entry) => entry.id === id);
  if (!item) return;
  showPageForm(formId);

  Object.entries(item).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = value;
  });

  form.dataset.editingId = id;
  form.querySelector("button[type='submit']").textContent = "Save changes";
  form.querySelector(".cancel-edit").hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm(form) {
  form.reset();
  delete form.dataset.editingId;
  form.querySelector("button[type='submit']").textContent = submitText[form.id];
  if (form.querySelector(".cancel-edit")) form.querySelector(".cancel-edit").hidden = true;
  clearFormDraft(form.id);
  hidePageForm(form);
}

function clearEditState() {
  Object.keys(formCollections).forEach((formId) => resetForm(document.querySelector(`#${formId}`)));
}

function startMaterialEdit(id) {
  const material = state.materials.find((entry) => entry.id === id);
  if (!material) return;

  activeMaterialTaskId = material.taskId;
  renderTasks();

  const form = document.querySelector(`[data-material-form][data-task-id="${material.taskId}"]`);
  form.elements.namedItem("item").value = material.item;
  form.elements.namedItem("company").value = material.company;
  form.elements.namedItem("cost").value = material.cost;
  form.elements.namedItem("status").value = material.status;
  form.dataset.editingId = material.id;
  form.querySelector("button[type='submit']").textContent = "Save material";
  form.querySelector(".cancel-edit").hidden = false;
}

function resetMaterialForm(form) {
  form.reset();
  delete form.dataset.editingId;
  form.querySelector("button[type='submit']").textContent = "Add material";
  form.querySelector(".cancel-edit").hidden = true;
}

function saveAndRender(renderEverything = true) {
  saveState();
  scheduleAutoSync();
  if (renderEverything) {
    render();
  } else {
    renderPrintReport();
  }
}

function verifyStorage() {
  try {
    const testKey = "remodel-tracker-storage-test";
    localStorage.setItem(testKey, "ok");
    localStorage.removeItem(testKey);
  } catch (error) {
    showSaveStatus("Storage blocked - use Save Backup");
  }
}

function showSaveStatus(message) {
  const status = document.querySelector("#saveStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-saving", message !== "Saved");
  status.classList.toggle("storage-warning", message.includes("blocked") || message.includes("could not"));
  status.classList.toggle("sync-error", message.includes("Error") || message.includes("Failed") || message.includes("Offline"));
  clearTimeout(saveStatusTimer);
  if (message !== "Saved" && !status.classList.contains("storage-warning")) {
    saveStatusTimer = setTimeout(() => showSaveStatus("Saved"), 1200);
  }
}

function getTotals() {
  const rooms = activeItems(state.rooms);
  const tasks = activeItems(state.tasks);
  const materials = activeItems(state.materials);
  const bids = activeItems(state.bids);
  const expenses = activeItems(state.expenses);
  const totalBudget = rooms.reduce((sum, room) => sum + Number(room.budget), 0);
  const totalSqft = rooms.reduce((sum, room) => sum + Number(room.sqft || 0), 0);
  const totalEstimate = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const materialCosts = materials.reduce((sum, material) => sum + Number(material.cost), 0);
  const doneTasks = tasks.filter((task) => task.status === "Done").length;
  const progress = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;
  const bestBid = [...bids].sort((a, b) => Number(a.amount) - Number(b.amount))[0];
  return { totalBudget, totalSqft, totalEstimate, materialCosts, progress, bestBid };
}

function getUpcomingTasks(dayCount) {
  const today = todayDateString();
  const end = addDays(today, dayCount);
  return [...getProjectItems(activeItems(state.tasks))]
    .filter((task) => task.status !== "Done" && taskDate(task) >= today && taskDate(task) <= end)
    .sort((a, b) => taskDate(a).localeCompare(taskDate(b)));
}

function getSuppliesToBuy() {
  const today = todayDateString();
  return activeItems(state.materials)
    .map((material) => ({
      material,
      task: activeItems(state.tasks).find((task) => task.id === material.taskId)
    }))
    .filter(({ material, task }) => {
      if (!task || task.status === "Done") return false;
      const stillNeedsPurchase = ["Needed", "Quoted"].includes(material.status);
      return stillNeedsPurchase && taskDate(task) >= today;
    })
    .sort((a, b) => taskDate(a.task).localeCompare(taskDate(b.task)));
}

function taskDate(task) {
  return task.start || task.due || todayDateString();
}

function todayDateString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatShortDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderPrintReport() {
  if (activeCustomReport) {
    document.querySelector("#printReport").innerHTML = customReportHtml();
    return;
  }

  if (activeFacilityReport) {
    document.querySelector("#printReport").innerHTML = facilityReportHtml(activeFacilityReport);
    return;
  }

  const totals = getTotals();
  const supplies = getSuppliesToBuy();
  const rooms = activeItems(state.rooms);
  const tasks = activeItems(state.tasks);
  const materials = activeItems(state.materials);
  const bids = activeItems(state.bids);
  const expenses = activeItems(state.expenses);
  const decisions = activeItems(state.decisions);

  document.querySelector("#printReport").innerHTML = `
    <h1>${escapeHtml(state.projectName || "Remodel Project")}</h1>
    <p><strong>Target finish:</strong> ${escapeHtml(state.targetDate || "TBD")}</p>
    <p><strong>Expected time to finish:</strong> ${escapeHtml(state.expectedDuration || "TBD")}</p>
    <div class="print-grid">
      <div class="print-stat"><span>Total budget</span><strong>${money.format(totals.totalBudget)}</strong></div>
      <div class="print-stat"><span>Estimated spend</span><strong>${money.format(totals.totalEstimate)}</strong></div>
      <div class="print-stat"><span>Tasks complete</span><strong>${totals.progress}%</strong></div>
      <div class="print-stat"><span>Best bid</span><strong>${totals.bestBid ? `${escapeHtml(totals.bestBid.contractor)} ${money.format(totals.bestBid.amount)}` : "TBD"}</strong></div>
      <div class="print-stat"><span>Total sq ft</span><strong>${totals.totalSqft.toLocaleString()}</strong></div>
      <div class="print-stat"><span>Budget / sq ft</span><strong>${totals.totalSqft ? money.format(totals.totalBudget / totals.totalSqft) : "TBD"}</strong></div>
      <div class="print-stat"><span>Material costs</span><strong>${money.format(totals.materialCosts)}</strong></div>
    </div>
    ${printTable("Rooms", ["Room", "Budget", "Sq ft", "Cost / sq ft", "Expected time", "Status"], rooms.map((room) => [room.name, money.format(room.budget), Number(room.sqft || 0).toLocaleString(), room.sqft ? money.format(Number(room.budget) / Number(room.sqft)) : "TBD", room.duration || "TBD", room.status]))}
    ${printTable("Tasks", ["Task", "Room", "Start", "Due", "Expected time", "Status"], tasks.map((task) => [task.title, task.room, taskDate(task), task.due, task.duration || "TBD", task.status]))}
    ${printTable("Buy Before Start", ["Task", "Start", "Supply", "Company", "Cost", "Status"], supplies.map(({ task, material }) => [task.title, taskDate(task), material.item, material.company, money.format(material.cost), material.status]))}
    ${printTable("Materials", ["Task", "Material", "Company", "Cost", "Status"], materials.map((material) => [getTaskTitle(material.taskId), material.item, material.company, money.format(material.cost), material.status]))}
    ${printTable("Contractor Bids", ["Contractor", "Bid", "Timeline", "Included", "Exclusions", "Allowance", "Materials", "Labor", "Permits", "Document", "PDF Link", "Contact", "Status", "Notes"], bids.map((bid) => [bid.contractor, money.format(bid.amount), bid.timeline, bid.included, bid.exclusions || "None listed", money.format(bid.allowanceAmount || 0), yesNoOrTbd(bid.materialsIncluded), yesNoOrTbd(bid.laborIncluded), yesNoOrTbd(bid.permitFeesIncluded), bid.bidDocumentName || "", bid.bidPdfUrl || "", bid.contact || "Not added", bid.status, bid.notes || ""]))}
    ${printTable("Budget", ["Item", "Amount", "Type"], expenses.map((expense) => [expense.item, money.format(expense.amount), expense.type]))}
    ${printTable("Decisions", ["Decision", "Owner", "Status"], decisions.map((decision) => [decision.title, decision.owner, decision.status]))}
    ${facilityReportHtml("summary", false)}
  `;
}

function renderReportPreview() {
  const preview = document.querySelector("#reportPreview");
  if (!preview) return;
  preview.innerHTML = reportCardsHtml();
}

function reportCardsHtml() {
  const { start, end, sections } = getReportOptions();
  const cards = [];
  const activeProject = getActiveProject();
  const rangeText = start || end ? `${start || "Any start"} through ${end || "Any end"}` : "All dates";

  if (sections.includes("summary")) {
    const totals = getTotals();
    cards.push(reportCard({
      title: `${activeProject?.name || state.projectName || "Project"} Summary`,
      location: activeProject?.name || "All projects",
      type: "Project summary",
      status: "Current",
      priority: "Normal",
      summary: `Date range: ${rangeText}. ${totals.progress}% of tasks complete.`,
      estimatedCost: totals.totalEstimate,
      contractorCost: totals.bestBid?.amount || 0,
      updated: state.syncMeta?.lastUpdated
    }));
  }

  if (sections.includes("tasks")) {
    getProjectItems(activeItems(state.tasks))
      .filter((task) => filterByDateRange([task], start, end, (entry) => taskDate(entry)).length)
      .forEach((task) => cards.push(reportCard({
        id: task.id,
        collection: "tasks",
        title: task.title,
        location: task.room,
        type: "Task",
        status: task.status,
        priority: task.priority,
        summary: task.notes || `Due ${task.due || "TBD"} - ${task.duration || "Time TBD"}`,
        estimatedCost: task.estimatedCost,
        contractorCost: task.contractorCost,
        attachments: task.attachments,
        updated: task.lastUpdated
      })));
  }

  if (sections.includes("repairs")) {
    getProjectItems(state.repairLog)
      .filter((item) => filterByDateRange([item], start, end, (entry) => entry.date || entry.followUpDate).length)
      .forEach((item) => cards.push(reportCard({
        id: item.id,
        collection: "repairLog",
        title: item.issue || "Repair item",
        location: item.areaSystemVehicle,
        type: "Repair",
        status: item.status || "Open",
        priority: item.priority,
        summary: item.actionTaken || item.notes,
        estimatedCost: item.estimatedCost || item.cost,
        contractorCost: item.contractorCost || item.cost,
        attachments: item.attachments,
        updated: item.lastUpdated
      })));
  }

  if (sections.includes("bids")) {
    activeItems(state.bids).forEach((bid) => cards.push(reportCard({
      title: bid.contractor,
      location: activeProject?.name || state.projectName,
      type: "Contractor bid",
      status: bid.status,
      priority: bid.amount ? "Cost review" : "Needs details",
      summary: bid.included || bid.notes,
      estimatedCost: bid.allowanceAmount || 0,
      contractorCost: bid.amount,
      attachments: bid.bidPdfUrl ? [{ fileName: bid.bidDocumentName || "Bid PDF", fileUrl: bid.bidPdfUrl }] : [],
      updated: bid.bidReceivedDate || state.syncMeta?.lastUpdated
    })));
  }

  return cards.length
    ? `<div class="report-card-grid">${cards.join("")}</div>`
    : `<article class="report-card empty-report-card"><h3>No reports yet. Add your first report.</h3></article>`;
}

function reportCard({ id = "", collection = "", title, location, type, status, priority, summary, estimatedCost = 0, contractorCost = 0, attachments = [], updated }) {
  const actionAttrs = collection && id ? `data-card-report="${collection}" data-id="${id}"` : "";
  return `
    <article class="report-card" ${actionAttrs}>
      <div class="report-card-accent"></div>
      <div class="item-head">
        <div>
          <h3>${escapeHtml(title || "Untitled report")}</h3>
          <p class="meta">${escapeHtml(location || "No location")} - ${escapeHtml(type || "Report")}</p>
        </div>
        <span class="pill">${escapeHtml(status || "Open")}</span>
      </div>
      <span class="priority-badge">${escapeHtml(priority || "Normal")}</span>
      <p>${escapeHtml(summary || "No summary added.")}</p>
      <div class="report-costs">
        <span>Internal <strong>${money.format(estimatedCost || 0)}</strong></span>
        <span>Contractor <strong>${money.format(contractorCost || 0)}</strong></span>
      </div>
      ${attachmentsHtml(attachments)}
      <p class="meta">Last updated: ${formatDateTime(updated)}</p>
      <div class="row-actions">
        ${collection && id ? `
          ${actionChoice(collection, id, [
            ["view", "View"],
            ["edit", "Edit"],
            ["duplicate", "Duplicate"],
            ["attach", "Attach file"],
            ["complete", "Mark complete"],
            ["delete", "Delete"]
          ], { attachCollection: collection, label: `Report actions for ${title || "item"}` })}
        ` : `<button type="button">View</button>`}
      </div>
    </article>
  `;
}

function getReportOptions() {
  const start = document.querySelector("#reportStartDate")?.value || "";
  const end = document.querySelector("#reportEndDate")?.value || "";
  const sections = [...document.querySelectorAll("#reportBuilder input[name='sections']:checked")].map((input) => input.value);
  return { start, end, sections };
}

function customReportHtml(isPreview = false) {
  const { start, end, sections } = getReportOptions();
  const totals = getTotals();
  const rangeText = start || end ? `${start || "Any start"} through ${end || "Any end"}` : "All dates";
  const parts = [
    `<h1>${escapeHtml(state.projectName || "Project")} Custom Report</h1>`,
    `<p><strong>Date range:</strong> ${escapeHtml(rangeText)}</p>`
  ];

  if (!sections.length) {
    parts.push(`<p>No report sections selected.</p>`);
    return parts.join("");
  }

  if (sections.includes("summary")) {
    const facilityStats = getFacilitiesStats();
    parts.push(`
      <div class="print-grid">
        <div class="print-stat"><span>Total budget</span><strong>${money.format(totals.totalBudget)}</strong></div>
        <div class="print-stat"><span>Estimated spend</span><strong>${money.format(totals.totalEstimate)}</strong></div>
        <div class="print-stat"><span>Tasks complete</span><strong>${totals.progress}%</strong></div>
        <div class="print-stat"><span>Open repairs</span><strong>${facilityStats.openRepairs.length}</strong></div>
        <div class="print-stat"><span>Fleet items due</span><strong>${facilityStats.fleetDue.length}</strong></div>
        <div class="print-stat"><span>Walkthrough issues</span><strong>${facilityStats.walkthroughIssues.length}</strong></div>
      </div>
    `);
  }

  if (sections.includes("rooms")) parts.push(printTable("Rooms", ["Room", "Budget", "Sq ft", "Expected time", "Status"], activeItems(state.rooms).map((room) => [room.name, money.format(room.budget), Number(room.sqft || 0).toLocaleString(), room.duration || "TBD", room.status])));
  if (sections.includes("tasks")) parts.push(printTable("Tasks", ["Task", "Room", "Start", "Due", "Expected time", "Status"], filterByDateRange(activeItems(state.tasks), start, end, (task) => taskDate(task)).map((task) => [task.title, task.room, taskDate(task), task.due, task.duration || "TBD", task.status])));
  if (sections.includes("materials")) parts.push(printTable("Materials", ["Task", "Material", "Company", "Cost", "Status"], activeItems(state.materials).map((material) => [getTaskTitle(material.taskId), material.item, material.company, money.format(material.cost), material.status])));
  if (sections.includes("bids")) parts.push(printTable("Contractor Bids", ["Contractor", "Bid", "Timeline", "Included", "Exclusions", "Document", "PDF Link", "Status"], filterByDateRange(activeItems(state.bids), start, end, (bid) => bid.bidReceivedDate).map((bid) => [bid.contractor, money.format(bid.amount), bid.timeline, bid.included, bid.exclusions || "", bid.bidDocumentName || "", bid.bidPdfUrl || "", bid.status])));
  if (sections.includes("budget")) parts.push(printTable("Budget / Expenses", ["Item", "Amount", "Type"], activeItems(state.expenses).map((expense) => [expense.item, money.format(expense.amount), expense.type])));
  if (sections.includes("maintenance")) parts.push(printTable("Maintenance Calendar", ["Date", "Task", "Frequency", "Location", "Category", "Status", "Notes"], filterByDateRange(state.maintenanceCalendar, start, end, (item) => item.date).map((item) => [item.date, item.task, item.frequency, item.location, item.category, item.status, item.notes])));
  if (sections.includes("recurring")) parts.push(printTable("Recurring Maintenance", ["Frequency", "Location / Area", "Task", "Assigned To", "Timing", "Notes"], state.recurringMaintenance.map((item) => [item.frequency, item.locationArea, item.task, item.assignedTo, item.timing, item.notes])));
  if (sections.includes("fleet")) {
    parts.push(printTable("Fleet Vehicles", ["Vehicle", "Type", "Plate / VIN", "Mileage", "Service", "Status", "Notes"], state.fleetVehicles.map((item) => [item.vehicle, item.type, item.plateVin, formatNumber(item.currentMileage), item.lastServiceDate, item.status, item.notes])));
    parts.push(printTable("Fleet Schedule", ["Frequency", "Task", "Applies To", "Timing", "Trigger", "Assigned To"], state.fleetSchedule.map((item) => [item.frequency, item.task, item.appliesTo, item.suggestedTiming, item.trigger, item.assignedTo])));
  }
  if (sections.includes("equipment")) parts.push(printTable("Equipment", ["Equipment", "Type", "Location", "Model / Serial", "Frequency", "Last Service", "Next Due", "Vendor", "Status", "Notes"], state.equipment.map((item) => [item.name, item.type, item.location, item.modelSerial, item.serviceFrequency, item.lastServiceDate, item.nextServiceDue, item.vendor, item.status, item.notes])));
  if (sections.includes("mileage")) parts.push(printTable("Mileage Log", ["Date", "Vehicle", "Start", "End", "Miles Driven", "Driver", "Notes"], filterByDateRange(state.mileageLog, start, end, (item) => item.date).map((item) => [item.date, item.vehicle, formatNumber(item.startMileage), formatNumber(item.endMileage), formatNumber(item.milesDriven), item.driverInitials, item.notes])));
  if (sections.includes("repairs")) parts.push(printTable("Repair Log", ["Date", "Area / System / Vehicle", "Issue", "Action", "Vendor", "Cost", "Status", "Follow-up", "Notes"], filterByDateRange(state.repairLog, start, end, (item) => item.date || item.followUpDate).map((item) => [item.date, item.areaSystemVehicle, item.issue, item.actionTaken, item.contractorVendor, money.format(item.cost || 0), item.status, item.followUpDate, item.notes])));
  if (sections.includes("walkthrough")) parts.push(printTable("Walkthrough Checklist", ["Location", "Check Area", "Item", "Status", "Notes / Follow-up"], state.walkthroughChecklist.map((item) => [item.location, item.checkArea, item.itemToInspect, item.status, item.notesFollowUp])));
  if (sections.includes("decisions")) parts.push(printTable("Decisions", ["Decision", "Owner", "Status"], activeItems(state.decisions).map((decision) => [decision.title, decision.owner, decision.status])));
  if (sections.includes("instructions")) parts.push(printTable("Facilities Instructions", ["Topic", "Instruction"], state.facilitiesInstructions.map((item) => [item.topic, item.instruction])));

  return isPreview ? parts.join("") : parts.join("");
}

function filterByDateRange(items, start, end, getDate) {
  if (!start && !end) return items;
  return items.filter((item) => {
    const date = getDate(item);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  });
}

function facilityReportHtml(reportType, includeTitle = true) {
  const stats = getFacilitiesStats();
  const heading = includeTitle ? `<h1>${escapeHtml(state.projectName || "Remodel Project")} Facilities Report</h1>` : "";
  if (reportType === "monthly") {
    const month = todayDateString().slice(0, 7);
    const rows = state.maintenanceCalendar.filter((item) => String(item.date).startsWith(month));
    return `
      ${heading}
      ${printTable("Monthly Facilities Report", ["Date", "Task", "Frequency", "Location", "Category", "Status", "Notes"], rows.map((item) => [item.date, item.task, item.frequency, item.location, item.category, item.status, item.notes]))}
      ${printTable("Facilities Instructions", ["Topic", "Instruction"], state.facilitiesInstructions.map((item) => [item.topic, item.instruction]))}
    `;
  }
  if (reportType === "openIssues") {
    return `
      ${heading}
      ${printTable("Open Issues Report", ["Type", "Date / Location", "Issue", "Status", "Notes"], [
        ...stats.overdue.map((item) => ["Overdue maintenance", item.date, item.task, item.status, item.notes]),
        ...stats.openRepairs.map((item) => ["Repair", item.date || item.areaSystemVehicle, item.issue, item.status, item.notes]),
        ...stats.walkthroughIssues.map((item) => ["Walkthrough", item.location, item.itemToInspect, item.status, item.notesFollowUp])
      ])}
    `;
  }
  if (reportType === "fleet") {
    return `
      ${heading}
      ${printTable("Fleet Report", ["Vehicle", "Type", "Plate / VIN", "Current Mileage", "Oil Change", "Tire Rotation", "Last Service", "Status", "Notes"], state.fleetVehicles.map((item) => [item.vehicle, item.type, item.plateVin, formatNumber(item.currentMileage), `${formatNumber(item.lastOilChangeMileage)} / ${item.nextOilChangeDue}`, `${item.lastTireRotation} / ${item.nextTireRotationDue}`, item.lastServiceDate, item.status, item.notes]))}
      ${printTable("Fleet Schedule", ["Frequency", "Task", "Applies To", "Suggested Timing", "Wear / Tear Items", "Trigger", "Assigned To", "Notes"], state.fleetSchedule.map((item) => [item.frequency, item.task, item.appliesTo, item.suggestedTiming, item.wearTearItems, item.trigger, item.assignedTo, item.notes]))}
      ${printTable("Mileage Log", ["Date", "Vehicle", "Start", "End", "Miles Driven", "Driver", "Notes"], state.mileageLog.map((item) => [item.date, item.vehicle, formatNumber(item.startMileage), formatNumber(item.endMileage), formatNumber(item.milesDriven), item.driverInitials, item.notes]))}
    `;
  }
  if (reportType === "walkthrough") {
    return `
      ${heading}
      ${printTable("Walkthrough Report", ["Location", "Check Area", "Item to Inspect", "Status", "Notes / Follow-up"], state.walkthroughChecklist.map((item) => [item.location, item.checkArea, item.itemToInspect, item.status, item.notesFollowUp]))}
    `;
  }
  return `
    <h2>Facilities Summary</h2>
    <div class="print-grid">
      <div class="print-stat"><span>Scheduled this week</span><strong>${stats.thisWeek.length}</strong></div>
      <div class="print-stat"><span>Overdue tasks</span><strong>${stats.overdue.length}</strong></div>
      <div class="print-stat"><span>Open repairs</span><strong>${stats.openRepairs.length}</strong></div>
      <div class="print-stat"><span>Fleet items due</span><strong>${stats.fleetDue.length}</strong></div>
      <div class="print-stat"><span>Walkthrough issues</span><strong>${stats.walkthroughIssues.length}</strong></div>
      <div class="print-stat"><span>Completed this month</span><strong>${stats.completedThisMonth.length}</strong></div>
    </div>
    ${printTable("Maintenance Calendar", ["Date", "Task", "Frequency", "Location", "Category", "Status"], state.maintenanceCalendar.slice(0, 80).map((item) => [item.date, item.task, item.frequency, item.location, item.category, item.status]))}
  `;
}

function getTaskTitle(taskId) {
  return activeItems(state.tasks).find((task) => task.id === taskId)?.title || "Unassigned task";
}

function renderFacilities() {
  renderFacilityFilterOptions();
  renderFacilitiesDashboard();
  renderMaintenanceCalendar();
  renderRecurringMaintenance();
  renderFleet();
  renderMileageLog();
  renderRepairLog();
  renderWalkthroughChecklist();
}

function renderDocumentIntake() {
  const node = document.querySelector("#documentIntakeList");
  if (!node) return;
  node.innerHTML = state.documentIntake.length
    ? [...state.documentIntake].sort((a, b) => String(b.uploadDate).localeCompare(String(a.uploadDate))).map((doc) => `
      <article class="item-card">
        <div class="item-head">
          <div>
            <strong>${escapeHtml(doc.originalFileName || doc.sourceFileName || doc.documentType)}</strong>
            <p class="meta">${escapeHtml(doc.contractorVendor || "Unknown vendor")} - ${escapeHtml(doc.documentType)}</p>
            <p class="meta">${escapeHtml(doc.projectRoomCategory || "")}</p>
          </div>
          <span class="pill">${escapeHtml(doc.status || "Needs Review")}</span>
        </div>
        ${doc.sourceFileUrl ? `<p class="meta"><a class="doc-link" href="${escapeHtml(safeExternalUrl(doc.sourceFileUrl))}" target="_blank" rel="noopener noreferrer">Open source file</a></p>` : ""}
        <p class="meta">${escapeHtml(doc.notes || "")}</p>
      </article>
    `).join("")
    : `<p class="meta">Nothing is waiting for review yet.</p>`;
}

function renderContractorLibrary() {
  const node = document.querySelector("#contractorLibraryList");
  if (!node) return;
  const contractors = activeItems(state.contractorLibrary);
  node.innerHTML = contractors.length
    ? [...contractors].sort((a, b) => a.name.localeCompare(b.name)).map((contractor) => {
      const contractorBids = activeItems(state.bids).filter((bid) => normalizeDuplicateKey(bid.contractor) === normalizeDuplicateKey(contractor.name));
      const contractorRepairs = activeItems(state.repairLog).filter((repair) => normalizeDuplicateKey(repair.contractorVendor) === normalizeDuplicateKey(contractor.name));
      const bidTotal = contractorBids.reduce((sum, bid) => sum + Number(bid.amount || 0), 0);
      return `
      <article class="item-card">
        <div class="item-head">
          <div>
            <strong>${escapeHtml(contractor.name)}</strong>
            <p class="meta">${escapeHtml(contractor.contactPerson || "")} ${escapeHtml(contractor.phone || "")} ${escapeHtml(contractor.email || "")}</p>
            <p class="meta">License: ${escapeHtml(contractor.licenseNumber || "Not added")} - Insurance: ${escapeHtml(contractor.insuranceStatus || "Not added")}</p>
            <p class="meta">${contractorBids.length} bid${contractorBids.length === 1 ? "" : "s"} - ${contractorRepairs.length} repair${contractorRepairs.length === 1 ? "" : "s"} - ${money.format(bidTotal)} bid total</p>
          </div>
          <span class="pill">${escapeHtml(contractor.status)}</span>
        </div>
        <p class="meta"><strong>Services:</strong> ${escapeHtml(contractor.servicesOffered || "Not added")}</p>
        <p class="meta">${escapeHtml(contractor.notes || "")}</p>
        <div class="row-actions">
          ${actionChoice("contractorLibrary", contractor.id, [
            ["bid", "Create bid"],
            ["repair", "Create repair"],
            ["expense", "Add expense"],
            ["followup", "Follow up"],
            ["edit", "Edit"],
            ["status", "Next status"],
            ["delete", "Remove"]
          ], { label: `Contractor actions for ${contractor.name}` })}
        </div>
      </article>
    `;
    }).join("")
    : `<p class="meta">No contractors saved yet.</p>`;
}

function renderSyncLog() {
  const queueItems = getSyncQueue()
    .slice()
    .sort((a, b) => Date.parse(b.syncedAt || b.lastAttemptAt || b.updatedAt || b.createdAt || 0) - Date.parse(a.syncedAt || a.lastAttemptAt || a.updatedAt || a.createdAt || 0))
    .slice(0, 12)
    .map((change) => `
      <article class="item-card compact-card">
        <div class="item-head">
          <div>
            <strong>${escapeHtml(getQueueItemLabel(change))}</strong>
            <p class="meta">${escapeHtml(change.errorMessage || "No issues")}</p>
            <p class="meta">${escapeHtml(queueItemTime(change))}</p>
          </div>
          <span class="pill">${escapeHtml(queueStatusLabel(change.status))}</span>
        </div>
      </article>
    `);
  const legacyItems = (state.syncLog || []).slice(0, 6).map((item) => `
    <article class="item-card compact-card">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(item.action || "sync")} - ${escapeHtml(item.status || "")}</strong>
          <p class="meta">${escapeHtml(item.message || "")}</p>
          <p class="meta">${item.timestamp ? new Date(item.timestamp).toLocaleString() : ""}</p>
        </div>
        <span class="pill">${escapeHtml(item.updatedByDevice || "")}</span>
      </div>
    </article>
  `);
  const html = queueItems.concat(legacyItems).join("") || `<p class="meta">No sync history yet.</p>`;
  const list = document.querySelector("#syncLogList");
  const standalone = document.querySelector("#syncLogListStandalone");
  if (list) list.innerHTML = html;
  if (standalone) standalone.innerHTML = html;
}

function renderFacilityFilterOptions() {
  setFilterOptions("#maintenanceLocationFilter", state.maintenanceCalendar.map((item) => item.location), facilityFilters.maintenanceLocation, "All locations");
  setFilterOptions("#maintenanceFrequencyFilter", state.maintenanceCalendar.map((item) => item.frequency), facilityFilters.maintenanceFrequency, "All frequencies");
  setFilterOptions("#maintenanceStatusFilter", state.maintenanceCalendar.map((item) => item.status), facilityFilters.maintenanceStatus, "All statuses");
  setFilterOptions("#recurringLocationFilter", state.recurringMaintenance.map((item) => item.locationArea), facilityFilters.recurringLocation, "All locations");
  setFilterOptions("#recurringFrequencyFilter", state.recurringMaintenance.map((item) => item.frequency), facilityFilters.recurringFrequency, "All frequencies");
  setFilterOptions("#recurringAssignedFilter", state.recurringMaintenance.map((item) => item.assignedTo), facilityFilters.recurringAssigned, "All assigned");
  setFilterOptions("#fleetVehicleFilter", [...state.fleetVehicles.map((item) => item.vehicle), ...state.fleetSchedule.map((item) => item.appliesTo)], facilityFilters.fleetVehicle, "All vehicles");
  setFilterOptions("#fleetStatusFilter", state.fleetVehicles.map((item) => item.status), facilityFilters.fleetStatus, "All statuses");
  setFilterOptions("#mileageVehicleFilter", state.mileageLog.map((item) => item.vehicle), facilityFilters.mileageVehicle, "All vehicles");
  setFilterOptions("#repairStatusFilter", state.repairLog.map((item) => item.status), facilityFilters.repairStatus, "All statuses");
  setFilterOptions("#walkthroughLocationFilter", state.walkthroughChecklist.map((item) => item.location), facilityFilters.walkthroughLocation, "All locations");
  setFilterOptions("#walkthroughStatusFilter", state.walkthroughChecklist.map((item) => item.status), facilityFilters.walkthroughStatus, "All statuses");
}

function setFilterOptions(selector, values, selected, label) {
  const select = document.querySelector(selector);
  if (!select) return;
  const unique = [...new Set(values.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = `<option value="">${escapeHtml(label)}</option>${unique.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  select.value = unique.includes(selected) ? selected : "";
}

function renderFacilitiesDashboard() {
  const stats = getFacilitiesStats();
  setText("#facilityWeekTasks", stats.thisWeek.length.toLocaleString());
  setText("#facilityOverdueTasks", stats.overdue.length.toLocaleString());
  setText("#facilityOpenRepairs", stats.openRepairs.length.toLocaleString());
  setText("#facilityFleetDue", stats.fleetDue.length.toLocaleString());
  setText("#facilityWalkthroughIssues", stats.walkthroughIssues.length.toLocaleString());
  setText("#facilityCompletedMonth", stats.completedThisMonth.length.toLocaleString());
  document.querySelector("#facilityWeekList").innerHTML = stats.thisWeek.length
    ? stats.thisWeek.slice(0, 8).map(facilityTaskCard).join("")
    : `<p class="meta">No scheduled facilities tasks this week.</p>`;
}

function facilityTaskCard(item) {
  return `
    <article class="item-card compact-card">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(item.task)}</strong>
          <p class="meta">${escapeHtml(formatDate(item.date))} - ${escapeHtml(item.location || "No location")} - ${escapeHtml(item.frequency || "No frequency")}</p>
        </div>
        <span class="pill">${escapeHtml(item.status)}</span>
      </div>
    </article>
  `;
}

function renderMaintenanceCalendar() {
  const rows = state.maintenanceCalendar
    .filter((item) => !facilityFilters.maintenanceLocation || item.location === facilityFilters.maintenanceLocation)
    .filter((item) => !facilityFilters.maintenanceFrequency || item.frequency === facilityFilters.maintenanceFrequency)
    .filter((item) => !facilityFilters.maintenanceStatus || item.status === facilityFilters.maintenanceStatus)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  document.querySelector("#maintenanceCalendarList").innerHTML = rows.length
    ? rows.map((item) => `
      <tr>
        <td>${escapeHtml(item.date || "")}</td>
        <td><strong>${escapeHtml(item.task)}</strong></td>
        <td>${escapeHtml(item.frequency || "")}</td>
        <td>${escapeHtml(item.location || "")}</td>
        <td>${escapeHtml(item.category || "")}</td>
        <td><span class="pill">${escapeHtml(item.status)}</span></td>
        <td>${escapeHtml(item.notes || "")}</td>
        <td class="table-actions">
          ${actionChoice("maintenanceCalendar", item.id, [
            ["repair", "Create repair"],
            ["expense", "Add expense"],
            ["status", "Next status"]
          ], { label: `Maintenance actions for ${item.task}` })}
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="8">No maintenance calendar items found.</td></tr>`;
}

function renderRecurringMaintenance() {
  const rows = state.recurringMaintenance
    .filter((item) => !facilityFilters.recurringLocation || item.locationArea === facilityFilters.recurringLocation)
    .filter((item) => !facilityFilters.recurringFrequency || item.frequency === facilityFilters.recurringFrequency)
    .filter((item) => !facilityFilters.recurringAssigned || item.assignedTo === facilityFilters.recurringAssigned);

  document.querySelector("#recurringMaintenanceList").innerHTML = rows.length
    ? rows.map((item) => `<tr><td>${escapeHtml(item.frequency)}</td><td>${escapeHtml(item.locationArea)}</td><td><strong>${escapeHtml(item.task)}</strong></td><td>${escapeHtml(item.assignedTo)}</td><td>${escapeHtml(item.timing)}</td><td>${escapeHtml(item.notes)}</td></tr>`).join("")
    : `<tr><td colspan="6">No recurring maintenance rows found.</td></tr>`;
}

function renderFleet() {
  const scheduleRows = state.fleetSchedule
    .filter((item) => !facilityFilters.fleetVehicle || item.appliesTo === facilityFilters.fleetVehicle);
  const vehicleRows = state.fleetVehicles
    .filter((item) => !facilityFilters.fleetVehicle || item.vehicle === facilityFilters.fleetVehicle)
    .filter((item) => !facilityFilters.fleetStatus || item.status === facilityFilters.fleetStatus);

  document.querySelector("#fleetScheduleList").innerHTML = scheduleRows.length
    ? scheduleRows.map((item) => `<tr><td>${escapeHtml(item.frequency)}</td><td><strong>${escapeHtml(item.task)}</strong></td><td>${escapeHtml(item.appliesTo)}</td><td>${escapeHtml(item.suggestedTiming)}</td><td>${escapeHtml(item.wearTearItems)}</td><td>${escapeHtml(item.trigger)}</td><td>${escapeHtml(item.assignedTo)}</td><td>${escapeHtml(item.notes)}</td></tr>`).join("")
    : `<tr><td colspan="8">No fleet schedule rows found.</td></tr>`;

  document.querySelector("#fleetVehicleList").innerHTML = vehicleRows.length
    ? vehicleRows.map((item) => `<tr><td><strong>${escapeHtml(item.vehicle)}</strong></td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.plateVin)}</td><td>${formatNumber(item.currentMileage)}</td><td>${formatNumber(item.lastOilChangeMileage)} / ${escapeHtml(item.nextOilChangeDue)}</td><td>${escapeHtml(item.lastTireRotation)} / ${escapeHtml(item.nextTireRotationDue)}</td><td>${escapeHtml(item.lastServiceDate)}</td><td><span class="pill ${isDueText(item.status) ? "warn" : ""}">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.notes)}</td><td class="table-actions">${actionChoice("fleetVehicles", item.id, [["repair", "Create repair"], ["mileage", "Add mileage"], ["expense", "Add expense"]], { label: `Fleet actions for ${item.vehicle}` })}</td></tr>`).join("")
    : `<tr><td colspan="10">No fleet vehicles found.</td></tr>`;
}

function renderEquipment() {
  const node = document.querySelector("#equipmentList");
  if (!node) return;
  const rows = activeItems(state.equipment).sort((a, b) => String(a.nextServiceDue || "9999").localeCompare(String(b.nextServiceDue || "9999")));
  node.innerHTML = rows.length
    ? rows.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${escapeHtml(item.type)}</td>
        <td>${escapeHtml(item.location)}</td>
        <td>${escapeHtml(item.modelSerial)}</td>
        <td>${escapeHtml(item.serviceFrequency)}</td>
        <td>${escapeHtml(item.lastServiceDate)}</td>
        <td>${escapeHtml(item.nextServiceDue)}</td>
        <td>${escapeHtml(item.vendor)}</td>
        <td><span class="pill ${isDueText(`${item.status} ${item.nextServiceDue}`) ? "warn" : ""}">${escapeHtml(item.status)}</span></td>
        <td>${escapeHtml(item.notes)}</td>
        <td class="table-actions">
          ${actionChoice("equipment", item.id, [
            ["repair", "Create repair"],
            ["maintenance", "Schedule maintenance"],
            ["expense", "Add expense"],
            ["edit", "Edit"],
            ["status", "Next status"],
            ["delete", "Remove"]
          ], { label: `Equipment actions for ${item.name}` })}
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="11">No equipment added yet.</td></tr>`;
}

function renderMileageLog() {
  const rows = state.mileageLog
    .filter((item) => !facilityFilters.mileageVehicle || item.vehicle === facilityFilters.mileageVehicle)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  document.querySelector("#mileageLogList").innerHTML = rows.length
    ? rows.map((item) => `<tr><td>${escapeHtml(item.date)}</td><td><strong>${escapeHtml(item.vehicle)}</strong></td><td>${formatNumber(item.startMileage)}</td><td>${formatNumber(item.endMileage)}</td><td>${formatNumber(item.milesDriven)}</td><td>${escapeHtml(item.driverInitials)}</td><td>${escapeHtml(item.notes)}</td></tr>`).join("")
    : `<tr><td colspan="7">No mileage log rows found.</td></tr>`;
}

function renderRepairLog() {
  const rows = getProjectItems(state.repairLog)
    .filter((item) => !facilityFilters.repairStatus || item.status === facilityFilters.repairStatus)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  document.querySelector("#repairLogList").innerHTML = rows.length
    ? rows.map(repairCardTemplate).join("")
    : `<p class="meta">No repair cards found for this project.</p>`;
}

function repairCardTemplate(item) {
  const statusFlow = ["Assessing", "Need quote", "Scheduled", "In progress", "Waiting", "Complete"];
  const costText = `Estimate ${money.format(item.estimatedCost || item.cost || 0)} - Contractor ${money.format(item.contractorCost || item.cost || 0)}`;
  if (isEditMode()) {
    return `
      <article class="item-card workflow-card edit-card" data-card="repairLog" data-id="${item.id}">
        <div class="repair-summary">
          <span>${escapeHtml(item.areaSystemVehicle || "No location")}</span>
          <span>${escapeHtml(item.contractorVendor || "No vendor")}</span>
          <span>${escapeHtml(item.followUpDate ? `Follow-up ${item.followUpDate}` : "No follow-up date")}</span>
          <span>${escapeHtml(costText)}</span>
        </div>
        <div class="card-edit-grid">
          ${cardInput("issue", "Repair title", item.issue)}
          ${cardInput("areaSystemVehicle", "Location / area", item.areaSystemVehicle)}
          ${cardInput("priority", "Priority", item.priority)}
          ${cardInput("status", "Status", item.status)}
          ${cardInput("estimatedCost", "Estimated cost", item.estimatedCost, "number")}
          ${cardInput("contractorCost", "Contractor cost", item.contractorCost, "number")}
          ${cardInput("contractorVendor", "Contractor / vendor", item.contractorVendor)}
          ${cardInput("followUpDate", "Follow-up date", item.followUpDate, "date")}
          ${cardTextarea("actionTaken", "Description / action taken", item.actionTaken)}
          ${cardTextarea("notes", "Notes", item.notes)}
        </div>
        <div class="repair-status-flow" aria-label="Repair status">
          ${statusFlow.map((status) => `<button type="button" class="${item.status === status ? "active" : ""}" data-repair-status="${item.id}" data-status="${escapeHtml(status)}">${escapeHtml(status)}</button>`).join("")}
        </div>
        ${attachmentsHtml(item.attachments)}
        <div class="row-actions">
          ${actionChoice("repairLog", item.id, [
            ["view", "View"],
            ["save", "Save changes"],
            ["duplicate", "Duplicate"],
            ["history", "View history"],
            ["attach", "Attach PDF"],
            ["expense", "Add expense"],
            ["followup", "Create follow-up"],
            ["complete", "Mark complete"],
            ["delete", "Delete"]
          ], { attachCollection: "repairLog", label: `Repair actions for ${item.issue}` })}
        </div>
        <p class="meta">Last updated: ${formatDateTime(item.lastUpdated)}</p>
      </article>
    `;
  }
  return `
    <article class="item-card workflow-card">
      <div class="item-head">
        <div>
          <strong>${escapeHtml(item.issue || "Repair item")}</strong>
          <p class="meta">${escapeHtml(item.areaSystemVehicle || "No location")} - ${escapeHtml(item.priority || "Normal")} priority</p>
          <p class="meta">${escapeHtml(costText)}</p>
          <p class="meta">Vendor: ${escapeHtml(item.contractorVendor || "Not assigned")} - Follow-up: ${escapeHtml(item.followUpDate || "Not set")}</p>
        </div>
        <span class="pill ${isOpenStatus(item.status) ? "warn" : ""}">${escapeHtml(item.status || "Open")}</span>
      </div>
      <p>${escapeHtml(item.actionTaken || item.notes || "No description added.")}</p>
      <div class="repair-status-flow" aria-label="Repair status">
        ${statusFlow.map((status) => `<button type="button" class="${item.status === status ? "active" : ""}" data-repair-status="${item.id}" data-status="${escapeHtml(status)}">${escapeHtml(status)}</button>`).join("")}
      </div>
      ${attachmentsHtml(item.attachments)}
      <div class="row-actions">
        ${actionChoice("repairLog", item.id, [
          ["view", "View"],
          ["edit", "Edit details"],
          ["duplicate", "Duplicate"],
          ["attach", "Attach PDF"],
          ["expense", "Add expense"],
          ["followup", "Create follow-up"],
          ["complete", "Mark complete"],
          ["delete", "Delete"]
        ], { attachCollection: "repairLog", label: `Repair actions for ${item.issue}` })}
      </div>
      <p class="meta">Last updated: ${formatDateTime(item.lastUpdated)}</p>
    </article>
  `;
}

function renderWalkthroughChecklist() {
  const rows = state.walkthroughChecklist
    .filter((item) => !facilityFilters.walkthroughLocation || item.location === facilityFilters.walkthroughLocation)
    .filter((item) => !facilityFilters.walkthroughStatus || item.status === facilityFilters.walkthroughStatus);

  document.querySelector("#walkthroughChecklistList").innerHTML = rows.length
    ? rows.map((item) => `<tr><td>${escapeHtml(item.location)}</td><td>${escapeHtml(item.checkArea)}</td><td><strong>${escapeHtml(item.itemToInspect)}</strong></td><td><span class="pill ${isOpenStatus(item.status) ? "warn" : ""}">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.notesFollowUp)}</td></tr>`).join("")
    : `<tr><td colspan="5">No walkthrough checklist rows found.</td></tr>`;
}

async function startDocumentExtraction() {
  const form = document.querySelector("#documentIntakeForm");
  const data = formData(form);
  const file = form.elements.namedItem("sourceFile").files[0];
  const fileText = file ? await extractTextFromFile(file) : "";
  const sourceText = `${data.documentText || ""}\n${fileText || ""}`.trim();
  const extracted = extractContractorDocumentInfo(sourceText);
  pendingDocumentReview = normalizeDocumentRecord({
    contractorVendor: data.contractorVendor || extracted.vendorName,
    originalFileName: file?.name || "",
    sourceFileName: file?.name || "",
    sourceFileUrl: data.sourceFileUrl,
    documentType: data.documentType,
    projectRoomCategory: data.category,
    status: "Needs Review",
    notes: extracted.notes || "",
    extracted
  });
  fillDocumentReview(extracted, pendingDocumentReview);
  document.querySelector("#documentReviewPanel").hidden = false;
  document.querySelector("#documentReviewPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function extractTextFromFile(file) {
  if (/text|json|csv/i.test(file.type) || /\.(txt|csv)$/i.test(file.name)) return file.text();
  if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return new TextDecoder("latin1").decode(bytes).replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ");
  }
  return "";
}

function extractContractorDocumentInfo(text) {
  const base = extractBidInfo(text);
  const email = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = String(text).match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0] || "";
  const license = String(text).match(/(?:license|lic\.?|contractor)\s*(?:#|no\.?|number)?\s*[:#]?\s*([A-Z0-9-]{4,})/i)?.[1] || "";
  const insurance = extractSection(String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean), ["insurance", "insured"]);
  const warranty = extractSection(String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean), ["warranty", "guarantee"]);
  const paymentTerms = extractSection(String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean), ["payment", "deposit", "terms"]);
  const vendorName = inferVendorName(text);
  return {
    vendorName,
    phone,
    email,
    address: "",
    licenseNumber: license,
    insuranceInfo: insurance,
    estimateNumber: String(text).match(/(?:estimate|invoice|proposal|bid)\s*(?:#|no\.?|number)?\s*[:#]?\s*([A-Z0-9-]+)/i)?.[1] || "",
    date: extractDate(text),
    expirationDate: "",
    scope: base.included || "",
    laborCost: extractCostByLabel(text, "labor"),
    materialsCost: extractCostByLabel(text, "materials?"),
    permitCost: extractCostByLabel(text, "permit"),
    tax: extractCostByLabel(text, "tax"),
    totalCost: base.amount || "",
    paymentTerms,
    warranty,
    timeline: base.timeline || "",
    notes: base.notes || ""
  };
}

function fillDocumentReview(extracted, doc) {
  const form = document.querySelector("#documentReviewForm");
  const values = { ...extracted, vendorName: extracted.vendorName || doc.contractorVendor, status: "Needs Review" };
  Object.entries(values).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = value || "";
  });
  const duplicate = findDocumentDuplicate(doc, extracted);
  document.querySelector("#duplicateNotice").textContent = duplicate
    ? "This looks similar to an existing bid/document. Review before creating a new record."
    : "";
}

function findDocumentDuplicate(doc, extracted = {}) {
  const total = Number(extracted.totalCost || 0);
  return state.documentIntake.find((existing) => {
    const sameFile = doc.originalFileName && existing.originalFileName === doc.originalFileName;
    const sameVendor = doc.contractorVendor && existing.contractorVendor && doc.contractorVendor.toLowerCase() === existing.contractorVendor.toLowerCase();
    const sameTotal = total && Number(existing.extracted?.totalCost || 0) === total;
    const sameNumber = extracted.estimateNumber && existing.extracted?.estimateNumber === extracted.estimateNumber;
    return sameFile || (sameVendor && (sameTotal || sameNumber));
  });
}

function saveReviewedDocument(destination) {
  if (!pendingDocumentReview) return;
  const review = formData(document.querySelector("#documentReviewForm"));
  const now = new Date().toISOString();
  const doc = normalizeDocumentRecord({
    ...pendingDocumentReview,
    contractorVendor: review.vendorName || pendingDocumentReview.contractorVendor,
    status: "Approved",
    notes: review.notes,
    extracted: review,
    updatedAt: now
  });
  const duplicate = findDocumentDuplicate(doc, review);
  if (duplicate && !confirm("This looks similar to an existing bid/document. Create a new one anyway?")) return;
  saveChange({
    type: "create",
    collection: "documentIntake",
    id: doc.id,
    payload: doc
  });
  saveDocumentDestination(destination, doc, review);
  pendingDocumentReview = null;
  document.querySelector("#documentReviewPanel").hidden = true;
  document.querySelector("#documentIntakeForm").reset();
  document.querySelector("#documentReviewForm").reset();
  showSaveStatus("Reviewed item saved locally - pending sync");
}

function saveDocumentDestination(destination, doc, review) {
  if (destination === "bids") {
    const bid = normalizeBid({
      id: crypto.randomUUID(),
      contractor: review.vendorName,
      amount: Number(review.totalCost || 0),
      timeline: review.timeline,
      included: review.scope,
      exclusions: "",
      laborCost: Number(review.laborCost || 0),
      materialsCost: Number(review.materialsCost || 0),
      permitCost: Number(review.permitCost || 0),
      tax: Number(review.tax || 0),
      warranty: review.warranty,
      licenseNumber: review.licenseNumber,
      insuranceInfo: review.insuranceInfo,
      bidDocumentName: doc.originalFileName,
      bidPdfUrl: doc.sourceFileUrl,
      bidReceivedDate: review.date,
      notes: review.notes,
      status: "Need details"
    });
    saveChange({ type: "create", collection: "bids", id: bid.id, payload: bid });
  }
  if (destination === "budget") {
    const expense = { id: crypto.randomUUID(), item: `${review.vendorName || doc.documentType} ${doc.documentType}`, amount: Number(review.totalCost || 0), type: "Estimate" };
    saveChange({ type: "create", collection: "expenses", id: expense.id, payload: expense });
  }
  if (destination === "repairLog") {
    const repair = normalizeRepairLogItem({ date: review.date, areaSystemVehicle: doc.projectRoomCategory, issue: review.scope || doc.documentType, actionTaken: "Review Queue", contractorVendor: review.vendorName, cost: Number(review.totalCost || 0), status: "Assessing", notes: review.notes });
    saveChange({ type: "create", collection: "repairLog", id: repair.id, payload: repair });
  }
  if (destination === "maintenanceCalendar") {
    const maintenance = normalizeMaintenanceCalendarItem({ date: review.date || todayDateString(), task: review.scope || `${doc.documentType} follow-up`, location: doc.projectRoomCategory, status: "Scheduled", notes: review.notes });
    saveChange({ type: "create", collection: "maintenanceCalendar", id: maintenance.id, payload: maintenance });
  }
  if (destination === "equipment") {
    const equipment = normalizeEquipmentItem({ name: doc.projectRoomCategory || review.scope || doc.documentType, type: doc.documentType, vendor: review.vendorName, nextServiceDue: review.date, sourceFileUrl: doc.sourceFileUrl, status: "Needs Repair", notes: `${review.notes || ""} ${doc.sourceFileUrl || ""}`.trim() });
    saveChange({ type: "create", collection: "equipment", id: equipment.id, payload: equipment });
  }
  if (destination === "contractorLibrary") upsertContractorFromReview(review);
  if (destination === "reports") {
    const report = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), title: `${doc.documentType} - ${review.vendorName || "Vendor"}`, notes: review.notes, sourceFileUrl: doc.sourceFileUrl, status: "Saved" };
    saveChange({ type: "create", collection: "reports", id: report.id, payload: report });
  }
}

function upsertContractorFromReview(review) {
  const existing = state.contractorLibrary.find((item) => item.name && review.vendorName && item.name.toLowerCase() === review.vendorName.toLowerCase());
  const values = normalizeContractorRecord({ name: review.vendorName, phone: review.phone, email: review.email, address: review.address, licenseNumber: review.licenseNumber, insuranceStatus: review.insuranceInfo, servicesOffered: review.scope, status: "Needs Follow-Up", notes: review.notes });
  if (existing) {
    saveChange({ type: "update", collection: "contractorLibrary", id: existing.id, payload: { ...values, id: existing.id, createdAt: existing.createdAt } });
  } else {
    saveChange({ type: "create", collection: "contractorLibrary", id: values.id, payload: values });
  }
}

function inferVendorName(text) {
  const firstLines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 5);
  return firstLines.find((line) => /LLC|Inc|Co\.|Company|Construction|Plumbing|Electric|Services|Contractor/i.test(line)) || firstLines[0] || "";
}

function extractCostByLabel(text, label) {
  const match = String(text).match(new RegExp(`${label}[^$\\d]{0,40}\\$?\\s*([\\d,]+(?:\\.\\d{2})?)`, "i"));
  return match ? numberFromText(match[1]) : "";
}

function handleQuickAction(action) {
  const viewMap = {
    task: "tasks",
    repair: "repairLog",
    mileage: "mileageLog",
    walkthrough: "walkthroughChecklist",
    document: "documentIntake",
    equipment: "equipment"
  };
  const viewId = viewMap[action] || "overview";
  activateView(viewId);
  if (action === "task") {
    prepareNewForm("taskForm");
    return;
  }
  if (action === "equipment") {
    prepareNewForm("equipmentForm");
    return;
  }
  if (action === "document") {
    const form = document.querySelector("#documentIntakeForm");
    form?.scrollIntoView({ behavior: "smooth", block: "start" });
    focusFirstField(form);
    return;
  }
  if (action === "repair") {
    const id = crypto.randomUUID();
    state.appSettings.editMode = true;
    saveChange({ type: "create", collection: "repairLog", id, payload: normalizeRepairLogItem({ id, date: todayDateString(), issue: "New repair", status: "Assessing" }) });
  }
  if (action === "mileage") {
    const id = crypto.randomUUID();
    saveChange({ type: "create", collection: "mileageLog", id, payload: normalizeMileageLogItem({ id, date: todayDateString(), status: "Open" }) });
  }
  if (action === "walkthrough") {
    const id = crypto.randomUUID();
    saveChange({ type: "create", collection: "walkthroughChecklist", id, payload: normalizeWalkthroughItem({ id, status: "Needs Follow-Up" }) });
  }
}

function createBidFollowup(bidId, followupType) {
  const bid = activeItems(state.bids).find((item) => item.id === bidId);
  if (!bid) return;
  const taskId = crypto.randomUUID();
  saveChange({
    type: "create",
    collection: "tasks",
    id: taskId,
    payload: {
      projectId: getActiveProjectId(),
      title: `${followupType}: ${bid.contractor}`,
      room: "Contractor Bids",
      start: todayDateString(),
      due: addDays(todayDateString(), 2),
      duration: "Follow-up",
      priority: "Normal",
      estimatedCost: 0,
      contractorCost: Number(bid.amount || 0),
      notes: bid.notes || bid.included || "",
      attachments: [],
      history: [],
      lastUpdated: new Date().toISOString(),
      status: "Todo"
    }
  });
  saveChange({
    type: "update",
    collection: "bids",
    id: bid.id,
    payload: {
      status: "Need details",
      notes: `${bid.notes || ""} ${followupType} created ${todayDateString()}.`.trim()
    }
  });
  activeTaskRoomFilter = "Contractor Bids";
  activateView("tasks", "Tasks");
}

function syncedCollectionPayload(collection, item) {
  const clone = structuredClone(item);
  delete clone.id;
  delete clone.createdAt;
  delete clone.updatedAt;
  delete clone.deletedAt;
  return clone;
}

function saveSyncedRecordUpdate(collection, id, payload) {
  if (SYNCED_COLLECTIONS.includes(collection)) {
    saveChange({ type: "update", collection, id, payload });
    return true;
  }
  return false;
}

function saveSyncedRecordCreate(collection, id, payload) {
  if (SYNCED_COLLECTIONS.includes(collection)) {
    saveChange({ type: "create", collection, id, payload });
    return true;
  }
  return false;
}

function createLocalTask(values) {
  const id = values.id || crypto.randomUUID();
  saveChange({
    type: "create",
    collection: "tasks",
    id,
    payload: {
      projectId: getActiveProjectId(),
      title: values.title || "New task",
      room: values.room || "",
      start: values.start || todayDateString(),
      due: values.due || addDays(todayDateString(), 2),
      duration: values.duration || "",
      priority: values.priority || "Normal",
      estimatedCost: Number(values.estimatedCost || 0),
      contractorCost: Number(values.contractorCost || 0),
      notes: values.notes || "",
      attachments: values.attachments || [],
      history: values.history || [],
      lastUpdated: new Date().toISOString(),
      status: values.status || "Todo"
    }
  });
  return id;
}

function getActiveProjectId() {
  return state?.appSettings?.activeProjectId || state?.projects?.[0]?.id || "default-project";
}

function getActiveProject() {
  return state.projects.find((project) => project.id === getActiveProjectId());
}

function isEditMode() {
  return Boolean(state.appSettings?.editMode);
}

function getProjectItems(items) {
  const activeProjectId = getActiveProjectId();
  return items.filter((item) => !item.projectId || item.projectId === activeProjectId);
}

function cardInput(field, label, value, type = "text") {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input data-card-field="${escapeHtml(field)}" type="${escapeHtml(type)}" value="${escapeHtml(value ?? "")}" />
    </label>
  `;
}

function cardTextarea(field, label, value) {
  return `
    <label class="full-span">
      <span>${escapeHtml(label)}</span>
      <textarea data-card-field="${escapeHtml(field)}" rows="3">${escapeHtml(value || "")}</textarea>
    </label>
  `;
}

function attachmentsHtml(attachments = []) {
  if (!attachments.length) return `<p class="meta">No PDFs attached.</p>`;
  return `
    <div class="attachment-list">
      ${attachments.map((file) => `
        <span class="attachment-chip">
          ${escapeHtml(file.fileName)}
          ${file.fileUrl ? `<a href="${escapeHtml(safeExternalUrl(file.fileUrl))}" target="_blank" rel="noopener noreferrer">Open</a>` : ""}
        </span>
      `).join("")}
    </div>
  `;
}

function updateCardField(field) {
  const card = field.closest("[data-card]");
  if (!card) return;
  const collection = card.dataset.card;
  const item = state[collection]?.find((entry) => entry.id === card.dataset.id);
  if (!item) return;
  const key = field.dataset.cardField;
  const oldValue = item[key] ?? "";
  const newValue = field.type === "number" ? Number(field.value || 0) : field.value;
  if (String(oldValue) === String(newValue)) return;
  item[key] = newValue;
  recordHistory(item, key, oldValue, newValue);
  scheduleLocalAutosave();
}

function saveCardEdits(collection, id) {
  const card = document.querySelector(`[data-card="${collection}"][data-id="${id}"]`);
  if (card) card.querySelectorAll("[data-card-field]").forEach(updateCardField);
  const item = state[collection]?.find((entry) => entry.id === id);
  if (item && saveSyncedRecordUpdate(collection, id, syncedCollectionPayload(collection, item))) return;
  saveAndRender();
}

function duplicateCard(collection, id) {
  const item = state[collection]?.find((entry) => entry.id === id);
  if (!item) return;
  const copyAttachments = confirm("Copy attached PDF metadata to the duplicate?");
  const now = new Date().toISOString();
  const duplicate = {
    ...structuredClone(item),
    id: crypto.randomUUID(),
    title: item.title ? `${item.title} Copy` : item.title,
    issue: item.issue ? `${item.issue} Copy` : item.issue,
    attachments: copyAttachments ? structuredClone(item.attachments || []) : [],
    history: [],
    lastUpdated: now
  };
  if (saveSyncedRecordCreate(collection, duplicate.id, syncedCollectionPayload(collection, duplicate))) return;
  state[collection].unshift(duplicate);
  saveAndRender();
}

function attachFileToCard(collection, id, file) {
  if (!file) return;
  const item = state[collection]?.find((entry) => entry.id === id);
  if (!item) return;
  const attachment = normalizeAttachment({
    fileName: file.name,
    uploadDate: new Date().toISOString(),
    relatedProjectId: item.projectId || getActiveProjectId(),
    relatedTaskId: id,
    type: file.type || "PDF"
  });
  item.attachments = [...(item.attachments || []), attachment];
  recordHistory(item, "attachments", "", file.name);
  saveAndRender();
}

function recordHistory(item, field, previousValue, newValue) {
  const now = new Date().toISOString();
  item.history = [
    {
      id: crypto.randomUUID(),
      timestamp: now,
      field,
      previousValue,
      newValue
    },
    ...(item.history || [])
  ].slice(0, 25);
  item.lastUpdated = now;
}

function showCardHistory(collection, id) {
  const item = state[collection]?.find((entry) => entry.id === id);
  if (!item) return;
  const history = (item.history || [])
    .slice(0, 10)
    .map((entry) => `${formatDateTime(entry.timestamp)}: ${entry.field} changed from "${entry.previousValue || ""}" to "${entry.newValue || ""}"`)
    .join("\n");
  alert(history || "No history has been recorded for this card yet.");
}

function showCardDetails(collection, id) {
  const item = state[collection]?.find((entry) => entry.id === id);
  if (!item) return;
  const title = item.title || item.issue || "Card details";
  const location = item.room || item.areaSystemVehicle || "";
  const description = item.notes || item.actionTaken || "";
  alert(`${title}\n${location}\nStatus: ${item.status || "Open"}\nPriority: ${item.priority || "Normal"}\n\n${description || "No description added."}`);
}

function markCardComplete(collection, id) {
  const item = state[collection]?.find((entry) => entry.id === id);
  if (!item) return;
  const previous = item.status || "";
  item.status = collection === "tasks" ? "Done" : "Complete";
  recordHistory(item, "status", previous, item.status);
  if (saveSyncedRecordUpdate(collection, id, syncedCollectionPayload(collection, item))) return;
  saveAndRender();
}

function scheduleLocalAutosave() {
  showSaveStatus("Saving...");
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveState();
    scheduleAutoSync();
    renderSyncStatus();
    showSaveStatus("Saved");
  }, 800);
}

function getFacilitiesStats() {
  const today = todayDateString();
  const weekEnd = addDays(today, 7);
  const monthStart = today.slice(0, 8) + "01";
  const thisWeek = state.maintenanceCalendar.filter((item) => item.date >= today && item.date <= weekEnd && item.status !== "Complete");
  const overdue = state.maintenanceCalendar.filter((item) => item.date && item.date < today && item.status !== "Complete");
  const openRepairs = state.repairLog.filter((item) => isOpenStatus(item.status));
  const fleetDue = state.fleetVehicles.filter((item) => isDueText(`${item.status} ${item.nextOilChangeDue} ${item.nextTireRotationDue} ${item.notes}`));
  const equipmentDue = state.equipment.filter((item) => item.nextServiceDue && item.nextServiceDue <= weekEnd || isDueText(`${item.status} ${item.notes}`));
  const walkthroughIssues = state.walkthroughChecklist.filter((item) => isOpenStatus(item.status) || item.notesFollowUp);
  const completedThisMonth = state.maintenanceCalendar.filter((item) => item.status === "Complete" && item.date >= monthStart && item.date <= today);
  return { thisWeek, overdue, openRepairs, fleetDue, equipmentDue, walkthroughIssues, completedThisMonth };
}

async function importFacilitiesWorkbook(file) {
  try {
    const workbook = await readXlsxWorkbook(file);
    const imported = mapFacilitiesWorkbook(workbook);
    state.maintenanceCalendar = imported.maintenanceCalendar;
    state.recurringMaintenance = imported.recurringMaintenance;
    state.fleetSchedule = imported.fleetSchedule;
    state.fleetVehicles = imported.fleetVehicles;
    state.mileageLog = imported.mileageLog;
    state.repairLog = imported.repairLog;
    state.walkthroughChecklist = imported.walkthroughChecklist;
    state.facilitiesInstructions = imported.facilitiesInstructions;
    saveAndRender();
    showSaveStatus("Facilities workbook imported");
  } catch (error) {
    console.error(error);
    showSaveStatus("Excel import could not load");
  }
}

function mapFacilitiesWorkbook(workbook) {
  const data = {
    maintenanceCalendar: [],
    recurringMaintenance: [],
    fleetSchedule: [],
    fleetVehicles: [],
    mileageLog: [],
    repairLog: [],
    walkthroughChecklist: [],
    facilitiesInstructions: []
  };

  Object.entries(workbook).forEach(([sheetName, rows]) => {
    if (isMonthlySheet(sheetName)) {
      data.maintenanceCalendar.push(...parseMonthlyCalendarSheet(sheetName, rows));
    }
  });

  data.recurringMaintenance = rowsToObjects(workbook["Recurring Schedule"] || [], {
    frequency: ["frequency"],
    locationArea: ["location", "area", "location area", "location/area"],
    task: ["task", "maintenance task"],
    assignedTo: ["assigned", "assigned to", "owner"],
    timing: ["timing", "suggested timing", "when"],
    notes: ["notes", "comments"]
  }).map(normalizeRecurringMaintenanceItem);

  data.fleetSchedule = rowsToObjects(workbook["Fleet Schedule"] || [], {
    frequency: ["frequency"],
    task: ["task"],
    appliesTo: ["applies to", "vehicle", "type"],
    suggestedTiming: ["suggested timing", "timing"],
    wearTearItems: ["wear", "wear tear", "wear/tear items", "wear tear items"],
    trigger: ["trigger"],
    assignedTo: ["assigned", "assigned to"],
    notes: ["notes"]
  }).map(normalizeFleetScheduleItem);

  data.fleetVehicles = rowsToObjects(workbook["Fleet Master"] || [], {
    vehicle: ["vehicle", "name"],
    type: ["type"],
    plateVin: ["plate", "vin", "plate/vin", "plate vin"],
    currentMileage: ["current mileage", "mileage"],
    lastOilChangeMileage: ["last oil change", "last oil change mileage"],
    nextOilChangeDue: ["next oil change", "next oil change due"],
    lastTireRotation: ["last tire rotation"],
    nextTireRotationDue: ["next tire rotation", "next tire rotation due"],
    lastServiceDate: ["last service", "last service date"],
    status: ["status"],
    notes: ["notes"]
  }).map(normalizeFleetVehicleItem);

  data.mileageLog = rowsToObjects(workbook["Mileage Log"] || [], {
    date: ["date"],
    vehicle: ["vehicle"],
    startMileage: ["start", "start mileage"],
    endMileage: ["end", "end mileage"],
    milesDriven: ["miles", "miles driven"],
    driverInitials: ["driver", "driver initials", "initials"],
    notes: ["notes"]
  }).map(normalizeMileageLogItem);

  data.repairLog = rowsToObjects(workbook["Repair Log"] || [], {
    date: ["date"],
    areaSystemVehicle: ["area", "system", "vehicle", "area/system/vehicle", "area system vehicle"],
    issue: ["issue", "problem"],
    actionTaken: ["action", "action taken"],
    contractorVendor: ["contractor", "vendor", "contractor/vendor"],
    cost: ["cost"],
    status: ["status"],
    followUpDate: ["follow", "follow-up", "follow up date", "follow-up date"],
    notes: ["notes"]
  }).map(normalizeRepairLogItem);

  data.walkthroughChecklist = rowsToObjects(workbook["Walkthrough Checklist"] || [], {
    location: ["location"],
    checkArea: ["check area", "area"],
    itemToInspect: ["item", "item to inspect", "inspect"],
    status: ["status"],
    notesFollowUp: ["notes", "follow", "notes/follow-up", "notes follow up"]
  }).map(normalizeWalkthroughItem);

  data.facilitiesInstructions = rowsToObjects(workbook["Instructions"] || [], {
    topic: ["topic", "section"],
    instruction: ["instruction", "instructions", "details"]
  }).map(normalizeFacilityInstruction);

  return data;
}

function parseMonthlyCalendarSheet(sheetName, rows) {
  const monthDate = monthFromSheetName(sheetName);
  if (!monthDate) return [];
  const items = [];
  rows.flat().forEach((cell) => {
    const text = String(cell || "").trim();
    const match = text.match(/^(\d{1,2})(?:\s+|[\r\n]+)([\s\S]+)/);
    if (!match) return;
    const day = Number(match[1]);
    if (!day) return;
    const date = `${monthDate.year}-${String(monthDate.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    splitBulletTasks(match[2]).forEach((task) => {
      items.push(normalizeMaintenanceCalendarItem({
        date,
        task,
        frequency: inferFrequency(task),
        location: inferLocation(task),
        category: inferCategory(task),
        status: "Scheduled",
        notes: ""
      }));
    });
  });
  return items;
}

function splitBulletTasks(value) {
  return String(value)
    .split(/\r?\n|•|·|‣|▪|-\s+/)
    .map((entry) => entry.replace(/^[*-]\s*/, "").trim())
    .filter(Boolean);
}

function rowsToObjects(rows, fieldMap) {
  const headerIndex = rows.findIndex((row) => row.filter(Boolean).length >= 2);
  if (headerIndex === -1) return [];
  const headers = rows[headerIndex].map(normalizeHeader);
  return rows.slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => {
      const object = {};
      Object.entries(fieldMap).forEach(([field, aliases]) => {
        const index = headers.findIndex((header) => aliases.some((alias) => header.includes(normalizeHeader(alias))));
        object[field] = index >= 0 ? row[index] || "" : "";
      });
      return object;
    });
}

async function readXlsxWorkbook(file) {
  const entries = await unzipXlsx(await file.arrayBuffer());
  const xml = (name) => entries[name] || entries[name.replace(/^\//, "")] || "";
  const sharedStrings = parseSharedStrings(xml("xl/sharedStrings.xml"));
  const workbookXml = parseXml(xml("xl/workbook.xml"));
  const relsXml = parseXml(xml("xl/_rels/workbook.xml.rels"));
  const rels = {};
  [...relsXml.querySelectorAll("Relationship")].forEach((rel) => {
    rels[rel.getAttribute("Id")] = `xl/${rel.getAttribute("Target").replace(/^\/?xl\//, "")}`;
  });
  const workbook = {};
  [...workbookXml.querySelectorAll("sheet")].forEach((sheet) => {
    const name = sheet.getAttribute("name");
    const relId = sheet.getAttribute("r:id") || sheet.getAttribute("id");
    const path = rels[relId];
    if (name && path && xml(path)) workbook[name] = parseSheet(xml(path), sharedStrings);
  });
  return workbook;
}

async function unzipXlsx(buffer) {
  const bytes = new Uint8Array(buffer);
  const entries = {};
  const eocd = findEndOfCentralDirectory(bytes);
  if (eocd < 0) throw new Error("Excel file is missing a ZIP directory.");
  const entryCount = readUint16(bytes, eocd + 10);
  let centralOffset = readUint32(bytes, eocd + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(bytes, centralOffset) !== 0x02014b50) break;
    const compression = readUint16(bytes, centralOffset + 10);
    const compressedSize = readUint32(bytes, centralOffset + 20);
    const fileNameLength = readUint16(bytes, centralOffset + 28);
    const extraLength = readUint16(bytes, centralOffset + 30);
    const commentLength = readUint16(bytes, centralOffset + 32);
    const localOffset = readUint32(bytes, centralOffset + 42);
    const name = decodeBytes(bytes.slice(centralOffset + 46, centralOffset + 46 + fileNameLength));
    const localNameLength = readUint16(bytes, localOffset + 26);
    const localExtraLength = readUint16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    if (!name.endsWith("/")) {
      entries[name] = compression === 0 ? decodeBytes(data) : decodeBytes(await inflateRaw(data));
    }
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function findEndOfCentralDirectory(bytes) {
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (readUint32(bytes, offset) === 0x06054b50) return offset;
  }
  return -1;
}

async function inflateRaw(data) {
  if (!("DecompressionStream" in window)) throw new Error("This browser cannot decompress Excel files offline.");
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseSharedStrings(xmlText) {
  if (!xmlText) return [];
  return [...parseXml(xmlText).querySelectorAll("si")].map((item) => [...item.querySelectorAll("t")].map((t) => t.textContent).join(""));
}

function parseSheet(xmlText, sharedStrings) {
  const xmlDoc = parseXml(xmlText);
  const rows = [];
  [...xmlDoc.querySelectorAll("row")].forEach((row) => {
    const values = [];
    [...row.querySelectorAll("c")].forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const index = columnIndex(ref.replace(/\d+/g, ""));
      values[index] = cellValue(cell, sharedStrings);
    });
    rows.push(values.map((value) => value ?? ""));
  });
  return rows;
}

function cellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") return cell.querySelector("is t")?.textContent || "";
  const value = cell.querySelector("v")?.textContent || "";
  if (type === "s") return sharedStrings[Number(value)] || "";
  return value;
}

function parseXml(xmlText) {
  return new DOMParser().parseFromString(xmlText, "application/xml");
}

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function decodeBytes(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

function columnIndex(column) {
  return [...column].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function isMonthlySheet(name) {
  return Boolean(monthFromSheetName(name));
}

function monthFromSheetName(name) {
  const match = String(name).match(/^(May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December|Jan|January|Feb|February|Mar|March|Apr|April)\s+20(26|27)$/i);
  if (!match) return null;
  const monthNames = { may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12, jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4 };
  return { month: monthNames[match[1].toLowerCase()], year: Number(`20${match[2]}`) };
}

function inferFrequency(task) {
  const match = String(task).trim().match(/^(Daily|Weekly|Monthly|Quarterly|Semi-Annual|Semi Annual|Annual)\b/i);
  return match ? match[1].replace("Semi Annual", "Semi-Annual") : "";
}

function inferLocation(task) {
  const withoutFrequency = String(task).trim().replace(/^(Daily|Weekly|Monthly|Quarterly|Semi-Annual|Semi Annual|Annual)\b[:\s-]*/i, "");
  const locations = ["Cold Storage/Plumbing", "Cold Storage", "Ventilation", "Valley", "Francis", "Kitchen", "Fleet", "EV", "Plumbing", "Warehouse", "Office"];
  const found = locations.find((location) => withoutFrequency.toLowerCase().startsWith(location.toLowerCase()));
  return found || "";
}

function inferCategory(task) {
  const value = String(task).toLowerCase();
  if (value.includes("vehicle") || value.includes("fleet") || value.includes("oil") || value.includes("tire")) return "Fleet";
  if (value.includes("clean") || value.includes("sanitize")) return "Cleaning";
  if (value.includes("inspect") || value.includes("check")) return "Inspection";
  if (value.includes("plumb") || value.includes("cold storage")) return "Facilities";
  if (value.includes("ev") || value.includes("electrical")) return "Electrical";
  if (value.includes("ventilation") || value.includes("hvac")) return "HVAC";
  return "Maintenance";
}

function normalizeHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeDateValue(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value))) {
    const serial = Number(value);
    if (serial > 25000 && serial < 60000) {
      const date = new Date(Date.UTC(1899, 11, 30 + serial));
      return date.toISOString().slice(0, 10);
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString().slice(0, 10);
}

function toNumberOrBlank(value) {
  return value === "" || value == null ? "" : Number(value);
}

function calculateMilesDriven(startMileage, endMileage) {
  return startMileage !== "" && endMileage !== "" ? Math.max(0, Number(endMileage) - Number(startMileage)) : "";
}

function formatNumber(value) {
  return value === "" || value == null || Number.isNaN(Number(value)) ? "" : Number(value).toLocaleString();
}

function extractBidInfo(source) {
  const text = String(source || "").replace(/\u00a0/g, " ");
  if (!text.trim()) return {};
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const amount = extractBidAmount(text);
  const timeline = extractTimeline(text);
  const allowanceAmount = extractAllowanceAmount(text);
  const included = extractSection(lines, ["included", "includes", "scope of work", "scope included", "work included"]);
  const exclusions = extractSection(lines, ["excluded", "exclusions", "not included", "does not include"]);
  const notes = extractSection(lines, ["notes", "clarifications", "assumptions", "conditions"]);
  const date = extractDate(text);
  return removeBlankFields({
    amount,
    timeline,
    allowanceAmount,
    included,
    exclusions,
    materialsIncluded: inferIncludedFlag(text, "material"),
    laborIncluded: inferIncludedFlag(text, "labor"),
    permitFeesIncluded: inferIncludedFlag(text, "permit"),
    bidReceivedDate: date,
    notes
  });
}

function extractBidAmount(text) {
  const priority = text.match(/(?:total|bid|proposal|estimate|contract)\s*(?:amount|price|total)?[^$\d]{0,24}\$?\s*([\d,]+(?:\.\d{2})?)/i);
  if (priority) return numberFromText(priority[1]);
  const amounts = [...text.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)].map((match) => numberFromText(match[1])).filter(Boolean);
  return amounts.length ? Math.max(...amounts) : "";
}

function extractAllowanceAmount(text) {
  const match = text.match(/allowance[^$\d]{0,40}\$?\s*([\d,]+(?:\.\d{2})?)/i);
  return match ? numberFromText(match[1]) : "";
}

function extractTimeline(text) {
  const match = text.match(/(?:timeline|schedule|duration|completion|complete|work period)[^\n\r]{0,40}?(\d+(?:\.\d+)?)\s*(business\s*)?(day|days|week|weeks|month|months)/i);
  if (match) return `${match[1]} ${match[3].toLowerCase()}`;
  const loose = text.match(/(\d+(?:\.\d+)?)\s*(business\s*)?(day|days|week|weeks|month|months)/i);
  return loose ? `${loose[1]} ${loose[3].toLowerCase()}` : "";
}

function extractDate(text) {
  const match = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i);
  return match ? normalizeDateValue(match[1]) : "";
}

function extractSection(lines, labels) {
  const start = lines.findIndex((line) => labels.some((label) => line.toLowerCase().includes(label)));
  if (start < 0) return "";
  const collected = [];
  for (let index = start; index < Math.min(lines.length, start + 7); index += 1) {
    const line = lines[index].replace(/^(included|includes|scope of work|scope included|work included|excluded|exclusions|not included|does not include|notes|clarifications|assumptions|conditions)\s*:?\s*/i, "").trim();
    if (index > start && /^(included|includes|scope|excluded|exclusions|allowance|total|price|timeline|schedule|notes|clarifications)\b/i.test(line)) break;
    if (line) collected.push(line);
  }
  return collected.join("; ").slice(0, 420);
}

function inferIncludedFlag(text, keyword) {
  const nearby = new RegExp(`(?:${keyword}s?|${keyword} fees?)[^\\n\\r]{0,60}`, "ig");
  const snippets = [...text.matchAll(nearby)].map((match) => match[0].toLowerCase()).join(" ");
  if (!snippets) return "";
  if (/not included|excluded|by owner|owner provided|separate/i.test(snippets)) return "no";
  if (/included|includes|provided|part of/i.test(snippets)) return "yes";
  return "";
}

function numberFromText(value) {
  return Number(String(value || "").replace(/,/g, ""));
}

function removeBlankFields(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "" && value != null && !Number.isNaN(value)));
}

function yesNoOrTbd(value) {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return "TBD";
}

function safeExternalUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "#";
}

function isOpenStatus(status) {
  return !status || !/complete|closed|done|resolved|pass|ok/i.test(String(status));
}

function isDueText(value) {
  return /due|overdue|service|repair|attention/i.test(String(value || ""));
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function printTable(title, headers, rows) {
  return `
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>
        ${
          rows.length
            ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
            : `<tr><td colspan="${headers.length}">No entries yet</td></tr>`
        }
      </tbody>
    </table>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

initializePageActionBars();
render();
verifyStorage();

if (isAutoLoadEnabled()) {
  setTimeout(() => {
    loadFromGoogle({ automatic: true });
  }, 600);
}

window.addEventListener("pagehide", () => {
  saveState();
  saveDrafts();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveState();
    saveDrafts();
  }
});

setInterval(() => {
  renderStats();
  renderCalendar();
  renderPrintReport();
}, 60 * 60 * 1000);

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    // The tracker still works without offline caching when opened as a local file.
  });
}
