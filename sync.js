const STORAGE_KEYS = {
  records: "facilities_sync_records_v1",
  queue: "facilities_sync_queue_v1",
  conflicts: "facilities_sync_conflicts_v1",
  duplicateWarnings: "facilities_sync_duplicate_warnings_v1",
  deviceId: "facilities_sync_device_id_v1"
};

const DEFAULT_TABLES = {
  facility: "facilities",
  room: "rooms",
  space: "rooms",
  asset: "assets",
  equipment: "assets",
  workOrder: "work_orders",
  work_order: "work_orders",
  recurringMaintenance: "recurring_maintenance",
  recurring_maintenance: "recurring_maintenance",
  vehicle: "vehicles",
  vendor: "vendors",
  project: "projects",
  material: "materials",
  invoice: "invoices",
  bid: "vendor_bids",
  vendorBid: "vendor_bids",
  vendor_bid: "vendor_bids",
  cost: "costs",
  document: "documents",
  note: "notes",
  followUp: "notes",
  follow_up: "notes"
};

const DUPLICATE_WARNING = "This may already exist. Review before creating.";

const DUPLICATE_RULES = {
  asset: [
    { label: "asset tag", fields: ["asset_tag"] },
    { label: "serial number", fields: ["serial_number"] }
  ],
  equipment: [
    { label: "asset tag", fields: ["asset_tag"] },
    { label: "serial number", fields: ["serial_number"] }
  ],
  vehicle: [
    { label: "VIN", fields: ["vin"] },
    { label: "plate number", fields: ["plate_number"] },
    { label: "license plate", fields: ["license_plate"] }
  ],
  vendor: [
    { label: "vendor name", fields: ["normalized_name"], normalizedFrom: "name" }
  ],
  project: [
    { label: "project number", fields: ["project_number"] },
    { label: "project name at facility", fields: ["facility_id", "normalized_name"], normalizedFrom: "name" }
  ],
  room: [
    { label: "room number at facility", fields: ["facility_id", "room_number"] },
    { label: "room name at facility", fields: ["facility_id", "normalized_name"], normalizedFrom: "name" }
  ],
  space: [
    { label: "space number at facility", fields: ["facility_id", "room_number"] },
    { label: "space name at facility", fields: ["facility_id", "normalized_name"], normalizedFrom: "name" }
  ],
  document: [
    { label: "file hash", fields: ["file_hash"] },
    { label: "document id", fields: ["document_id"] },
    { label: "storage path", fields: ["storage_bucket", "storage_path"] }
  ],
  invoice: [
    { label: "vendor invoice number", fields: ["vendor_id", "invoice_number"] }
  ],
  bid: [
    { label: "vendor bid number", fields: ["vendor_id", "bid_number"] }
  ],
  vendorBid: [
    { label: "vendor bid number", fields: ["vendor_id", "bid_number"] }
  ],
  vendor_bid: [
    { label: "vendor bid number", fields: ["vendor_id", "bid_number"] }
  ]
};

let supabaseClient = null;
let currentUserId = null;
let tableMap = { ...DEFAULT_TABLES };
let statusHandler = null;
let afterSyncHandler = null;
let syncTimer = null;
let isProcessing = false;

export function configureSync({
  supabase,
  userId = null,
  tables = {},
  onStatusChange = null,
  onAfterSync = null
} = {}) {
  supabaseClient = supabase || supabaseClient;
  currentUserId = userId || currentUserId;
  tableMap = { ...tableMap, ...tables };
  statusHandler = onStatusChange || statusHandler;
  afterSyncHandler = onAfterSync || afterSyncHandler;

  window.addEventListener("online", () => {
    emitSyncStatus("saving");
    processSyncQueue();
  });

  window.addEventListener("offline", () => {
    emitSyncStatus("unsynced");
  });

  emitSyncStatus(getQueue().length > 0 ? "unsynced" : "synced");
}

export async function saveChange(recordType, recordId, action, payload = {}) {
  const now = new Date().toISOString();
  const normalizedAction = action === "delete" ? "update" : action;
  const allowDuplicateCreate = payload.__allowDuplicateCreate === true;
  const linkToExistingId = payload.__linkToExistingId || null;
  const localPayload =
    action === "delete"
      ? { ...payload, deletedAt: payload.deletedAt || now, deleted_at: payload.deleted_at || now }
      : { ...payload };
  delete localPayload.__allowDuplicateCreate;
  delete localPayload.__linkToExistingId;

  const localId = recordId || crypto.randomUUID();
  if (action === "create" && linkToExistingId) {
    return linkLocalDraftToExisting(recordType, localId, linkToExistingId, localPayload);
  }

  if (action === "create" && !allowDuplicateCreate) {
    const duplicateWarning = await preflightDuplicateCheck(recordType, localId, localPayload);
    if (duplicateWarning.hasDuplicates) {
      return duplicateWarning;
    }
  }

  const existing = getLocalRecord(recordType, localId);
  const baseUpdatedAt = getRecordUpdatedAt(existing?.remote || existing?.data || payload);
  const deviceId = getDeviceId();

  const localRecord = {
    recordType,
    recordId: localId,
    action: normalizedAction,
    syncStatus: "unsynced",
    data: {
      ...(existing?.data || {}),
      ...localPayload,
      id: localId,
      updatedAt: now,
      updated_at: now,
      updatedBy: currentUserId,
      updated_by: currentUserId,
      updatedByDevice: deviceId,
      updated_by_device: deviceId
    },
    remote: existing?.remote || null,
    baseUpdatedAt,
    updatedAt: now,
    updatedByDevice: deviceId
  };

  putLocalRecord(localRecord);

  enqueueChange({
    id: crypto.randomUUID(),
    recordType,
    recordId: localId,
    action: normalizedAction,
    originalAction: action,
    payload: localRecord.data,
    baseUpdatedAt,
    status: "pending",
    retryCount: 0,
    lastError: null,
    nextRetryAt: null,
    createdAt: now,
    updatedAt: now,
    updatedBy: currentUserId,
    updatedByDevice: deviceId
  });

  emitSyncStatus(navigator.onLine ? "saving" : "unsynced");

  if (navigator.onLine) {
    scheduleSync();
  }

  return localRecord;
}

export async function processSyncQueue() {
  if (isProcessing) return getSyncSummary();
  if (!supabaseClient) throw new Error("sync.js has not been configured with a Supabase client.");
  if (!navigator.onLine) {
    emitSyncStatus("unsynced");
    return getSyncSummary();
  }

  isProcessing = true;
  emitSyncStatus("saving");

  try {
    const queue = getQueue();

    for (const item of queue) {
      if (!["pending", "failed"].includes(item.status)) continue;
      if (item.nextRetryAt && new Date(item.nextRetryAt) > new Date()) continue;

      await processQueueItem(item);
    }

    const summary = getSyncSummary();
    emitSyncStatus(
      summary.possibleDuplicates > 0
        ? "possible_duplicate"
        : summary.conflicts > 0
          ? "conflict"
          : summary.failed > 0
            ? "failed"
            : summary.pending > 0
              ? "unsynced"
              : "synced"
    );

    if (typeof afterSyncHandler === "function") {
      afterSyncHandler(summary);
    }

    return summary;
  } finally {
    isProcessing = false;
  }
}

export function getSyncSummary() {
  const queue = getQueue();
  const duplicateWarnings = getDuplicateWarnings();
  return {
    synced: queue.filter((item) => item.status === "synced").length,
    saving: queue.filter((item) => item.status === "syncing").length,
    pending: queue.filter((item) => item.status === "pending").length,
    failed: queue.filter((item) => item.status === "failed").length,
    conflicts: queue.filter((item) => item.status === "conflict").length,
    possibleDuplicates: duplicateWarnings.filter((item) => item.status === "possible_duplicate").length
  };
}

export function getVisibleSyncStatus(recordType = null, recordId = null) {
  if (recordType && recordId) {
    return getLocalRecord(recordType, recordId)?.syncStatus || "synced";
  }

  const summary = getSyncSummary();
  if (summary.possibleDuplicates > 0) return "possible_duplicate";
  if (summary.conflicts > 0) return "conflict";
  if (summary.failed > 0) return "failed";
  if (summary.saving > 0) return "saving";
  if (summary.pending > 0) return "unsynced";
  return "synced";
}

export function getSyncLabel(status = getVisibleSyncStatus()) {
  const labels = {
    synced: "Synced",
    saving: "Saving...",
    unsynced: "Unsynced",
    failed: "Sync failed",
    conflict: "Conflict",
    possible_duplicate: DUPLICATE_WARNING
  };

  return labels[status] || "Unsynced";
}

export function getLocalRecords(recordType) {
  return Object.values(readJson(STORAGE_KEYS.records, {}))
    .filter((record) => record.recordType === recordType)
    .filter((record) => !record.data?.deletedAt && !record.data?.deleted_at);
}

export function getLocalRecord(recordType, recordId) {
  return readJson(STORAGE_KEYS.records, {})[recordKey(recordType, recordId)] || null;
}

export function getDuplicateWarnings() {
  return readJson(STORAGE_KEYS.duplicateWarnings, []);
}

export async function createAnyway(duplicateWarningId) {
  const warning = getDuplicateWarnings().find((item) => item.id === duplicateWarningId);
  if (!warning) throw new Error("Duplicate warning not found.");

  updateDuplicateWarning(duplicateWarningId, { status: "overridden", resolvedAt: new Date().toISOString() });

  return saveChange(warning.recordType, warning.recordId, "create", {
    ...warning.payload,
    __allowDuplicateCreate: true
  });
}

export function linkDuplicateToExisting(duplicateWarningId, existingRecordId) {
  const warning = getDuplicateWarnings().find((item) => item.id === duplicateWarningId);
  if (!warning) throw new Error("Duplicate warning not found.");

  updateDuplicateWarning(duplicateWarningId, {
    status: "linked",
    linkedRecordId: existingRecordId,
    resolvedAt: new Date().toISOString()
  });

  return linkLocalDraftToExisting(warning.recordType, warning.recordId, existingRecordId, warning.payload);
}

async function processQueueItem(item) {
  updateQueueItem(item.id, { status: "syncing", updatedAt: new Date().toISOString() });
  updateLocalRecordStatus(item.recordType, item.recordId, "saving");

  try {
    const table = tableFor(item.recordType);
    const remote = item.action === "create" ? null : await fetchRemoteRecord(table, item.recordId);

    if (remote && isRemoteNewer(remote, item.baseUpdatedAt)) {
      markConflict(item, remote);
      return;
    }

    const saved = await writeRemoteRecord(table, item, remote);
    markSynced(item, saved);
  } catch (error) {
    markRetry(item, error);
  }
}

async function fetchRemoteRecord(table, recordId) {
  const { data, error } = await supabaseClient
    .from(table)
    .select("*")
    .eq("id", recordId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function writeRemoteRecord(table, item) {
  const payload = toServerPayload(item.payload);

  if (item.action === "create") {
    const { data, error } = await supabaseClient
      .from(table)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabaseClient
    .from(table)
    .update(payload)
    .eq("id", item.recordId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

function markSynced(item, remoteRecord) {
  updateQueueItem(item.id, {
    status: "synced",
    lastError: null,
    syncedAt: new Date().toISOString()
  });

  const local = getLocalRecord(item.recordType, item.recordId);
  putLocalRecord({
    ...(local || {}),
    recordType: item.recordType,
    recordId: item.recordId,
    syncStatus: "synced",
    data: fromServerPayload(remoteRecord),
    remote: remoteRecord,
    baseUpdatedAt: getRecordUpdatedAt(remoteRecord),
    updatedAt: getRecordUpdatedAt(remoteRecord)
  });
}

function markConflict(item, remoteRecord) {
  updateQueueItem(item.id, {
    status: "conflict",
    lastError: "Remote record is newer than the local change.",
    conflictAt: new Date().toISOString()
  });

  updateLocalRecordStatus(item.recordType, item.recordId, "conflict", {
    conflict: {
      queueItemId: item.id,
      localPayload: item.payload,
      remoteRecord,
      baseUpdatedAt: item.baseUpdatedAt,
      detectedAt: new Date().toISOString()
    }
  });

  const conflicts = readJson(STORAGE_KEYS.conflicts, []);
  conflicts.push({
    queueItemId: item.id,
    recordType: item.recordType,
    recordId: item.recordId,
    localPayload: item.payload,
    remoteRecord,
    detectedAt: new Date().toISOString()
  });
  writeJson(STORAGE_KEYS.conflicts, conflicts);
}

function markRetry(item, error) {
  const retryCount = item.retryCount + 1;
  const status = isRetryableError(error) ? "pending" : "failed";

  updateQueueItem(item.id, {
    status,
    retryCount,
    lastError: error.message || String(error),
    nextRetryAt: status === "pending" ? getNextRetryAt(retryCount) : null,
    updatedAt: new Date().toISOString()
  });

  updateLocalRecordStatus(item.recordType, item.recordId, status === "pending" ? "unsynced" : "failed");
}

async function preflightDuplicateCheck(recordType, recordId, payload) {
  const rules = DUPLICATE_RULES[recordType] || [];
  if (rules.length === 0) return { hasDuplicates: false };

  const duplicateMatches = [
    ...findLocalDuplicateMatches(recordType, recordId, payload, rules),
    ...(await findRemoteDuplicateMatches(recordType, recordId, payload, rules))
  ];

  if (duplicateMatches.length === 0) return { hasDuplicates: false };

  const warning = {
    id: crypto.randomUUID(),
    status: "possible_duplicate",
    message: DUPLICATE_WARNING,
    recordType,
    recordId,
    payload,
    matches: duplicateMatches,
    createdAt: new Date().toISOString()
  };

  const warnings = getDuplicateWarnings();
  warnings.push(warning);
  writeJson(STORAGE_KEYS.duplicateWarnings, warnings);
  emitSyncStatus("possible_duplicate");

  return {
    ...warning,
    hasDuplicates: true,
    syncStatus: "possible_duplicate"
  };
}

function findLocalDuplicateMatches(recordType, recordId, payload, rules) {
  return getLocalRecords(recordType)
    .filter((record) => record.recordId !== recordId)
    .flatMap((record) => matchingRules(payload, record.data, rules).map((rule) => ({
      source: "local",
      recordType,
      recordId: record.recordId,
      rule: rule.label,
      record: record.data
    })));
}

async function findRemoteDuplicateMatches(recordType, recordId, payload, rules) {
  if (!navigator.onLine || !supabaseClient) return [];

  const remoteQueries = buildRemoteDuplicateQueries(payload, rules);
  if (remoteQueries.length === 0) return [];

  try {
    const { data, error } = await supabaseClient
      .from(tableFor(recordType))
      .select("*")
      .is("deleted_at", null)
      .or(remoteQueries.join(","))
      .limit(10);

    if (error) throw error;

    return (data || [])
      .filter((record) => record.id !== recordId)
      .flatMap((record) => matchingRules(payload, fromServerPayload(record), rules).map((rule) => ({
        source: "remote",
        recordType,
        recordId: record.id,
        rule: rule.label,
        record
      })));
  } catch (error) {
    return [];
  }
}

function buildRemoteDuplicateQueries(payload, rules) {
  return rules.flatMap((rule) => {
    const comparablePayload = withNormalizedFields(payload, rule);
    if (!rule.fields.every((field) => hasComparableValue(comparablePayload[field]))) return [];

    return rule.fields.map((field) => `${field}.eq.${escapeSupabaseFilterValue(comparablePayload[field])}`).join(",");
  });
}

function matchingRules(left, right, rules) {
  return rules.filter((rule) => {
    const comparableLeft = withNormalizedFields(left, rule);
    const comparableRight = withNormalizedFields(right, rule);

    return rule.fields.every((field) => {
      if (!hasComparableValue(comparableLeft[field]) || !hasComparableValue(comparableRight[field])) return false;
      return normalizeComparable(comparableLeft[field]) === normalizeComparable(comparableRight[field]);
    });
  });
}

function withNormalizedFields(record, rule) {
  if (!rule.normalizedFrom) return record;
  return {
    ...record,
    normalized_name: record.normalized_name || normalizeName(record[rule.normalizedFrom])
  };
}

function linkLocalDraftToExisting(recordType, recordId, existingRecordId, payload) {
  const now = new Date().toISOString();
  const linkedRecord = {
    recordType,
    recordId,
    action: "link",
    syncStatus: "synced",
    data: {
      ...payload,
      id: recordId,
      linkedRecordId: existingRecordId,
      duplicateResolvedAt: now
    },
    linkedRecordId: existingRecordId,
    updatedAt: now
  };

  putLocalRecord(linkedRecord);
  emitSyncStatus(getVisibleSyncStatus());
  return linkedRecord;
}

function updateDuplicateWarning(id, patch) {
  writeJson(
    STORAGE_KEYS.duplicateWarnings,
    getDuplicateWarnings().map((item) => (item.id === id ? { ...item, ...patch } : item))
  );
}

function enqueueChange(item) {
  const queue = getQueue();
  queue.push(item);
  writeJson(STORAGE_KEYS.queue, queue);
}

function getQueue() {
  return readJson(STORAGE_KEYS.queue, []);
}

function updateQueueItem(id, patch) {
  writeJson(
    STORAGE_KEYS.queue,
    getQueue().map((item) => (item.id === id ? { ...item, ...patch } : item))
  );
}

function putLocalRecord(record) {
  const records = readJson(STORAGE_KEYS.records, {});
  records[recordKey(record.recordType, record.recordId)] = record;
  writeJson(STORAGE_KEYS.records, records);
}

function updateLocalRecordStatus(recordType, recordId, syncStatus, patch = {}) {
  const local = getLocalRecord(recordType, recordId);
  if (!local) return;
  putLocalRecord({ ...local, ...patch, syncStatus });
}

function hasComparableValue(value) {
  return value !== undefined && value !== null && `${value}`.trim() !== "";
}

function normalizeComparable(value) {
  return `${value}`.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeName(value) {
  return normalizeComparable(value)
    .replace(/[^\w\s]/g, "")
    .replace(/\b(inc|llc|ltd|co|company|corp|corporation)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeSupabaseFilterValue(value) {
  return encodeURIComponent(`${value}`);
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    processSyncQueue();
  }, 250);
}

function emitSyncStatus(status) {
  if (typeof statusHandler === "function") {
    statusHandler({
      status,
      label: getSyncLabel(status),
      summary: getSyncSummary()
    });
  }
}

function tableFor(recordType) {
  const table = tableMap[recordType];
  if (!table) throw new Error(`No Supabase table mapped for record type: ${recordType}`);
  return table;
}

function isRemoteNewer(remoteRecord, baseUpdatedAt) {
  if (!baseUpdatedAt) return false;
  const remoteUpdatedAt = getRecordUpdatedAt(remoteRecord);
  return remoteUpdatedAt && new Date(remoteUpdatedAt).getTime() > new Date(baseUpdatedAt).getTime();
}

function getRecordUpdatedAt(record = {}) {
  return record.updatedAt || record.updated_at || null;
}

function toServerPayload(payload) {
  const output = { ...payload };

  if (output.updatedAt && !output.updated_at) output.updated_at = output.updatedAt;
  if (output.updatedBy && !output.updated_by) output.updated_by = output.updatedBy;
  if (output.updatedByDevice && !output.updated_by_device) output.updated_by_device = output.updatedByDevice;
  if (output.deletedAt && !output.deleted_at) output.deleted_at = output.deletedAt;

  delete output.updatedAt;
  delete output.updatedBy;
  delete output.updatedByDevice;
  delete output.deletedAt;

  return output;
}

function fromServerPayload(payload = {}) {
  return {
    ...payload,
    updatedAt: payload.updated_at || payload.updatedAt,
    deletedAt: payload.deleted_at || payload.deletedAt
  };
}

function getNextRetryAt(retryCount) {
  const delays = [10_000, 30_000, 120_000, 600_000, 1_800_000];
  return new Date(Date.now() + delays[Math.min(retryCount - 1, delays.length - 1)]).toISOString();
}

function isRetryableError(error) {
  const message = `${error?.message || error}`.toLowerCase();
  return (
    !navigator.onLine ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("failed to fetch") ||
    message.includes("rate limit") ||
    message.includes("temporarily") ||
    error?.status >= 500
  );
}

function getDeviceId() {
  let deviceId = localStorage.getItem(STORAGE_KEYS.deviceId);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.deviceId, deviceId);
  }
  return deviceId;
}

function recordKey(recordType, recordId) {
  return `${recordType}:${recordId}`;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
