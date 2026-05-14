const FCC_SCHEMA_VERSION = 2;

function migrateAppState(input = {}) {
  const base = input && typeof input === "object" ? input : {};
  const now = new Date().toISOString();
  const projects = Array.isArray(base.projects) ? base.projects : [];
  const bids = Array.isArray(base.bids) ? base.bids : [];
  const tasks = Array.isArray(base.tasks) ? base.tasks : [];
  const vehicles = Array.isArray(base.vehicles) ? base.vehicles : [];
  const fuelReceipts = Array.isArray(base.fuelReceipts) ? base.fuelReceipts : [];
  const files = Array.isArray(base.files) ? base.files : deriveFiles(base);

  const appState = {
    ...base,
    schemaVersion: FCC_SCHEMA_VERSION,
    workspace: {
      id: base.workspace?.id || "facilities-main",
      name: base.workspace?.name || base.settings?.workspaceName || "Facilities Command Center",
      note: base.workspace?.note || base.settings?.workspaceNote || "Daily facilities operations and project planning"
    },
    projects,
    bids,
    tasks,
    vehicles,
    fuelReceipts,
    workItems: mergeWorkItems(base.workItems, tasks),
    submissions: Array.isArray(base.submissions) ? base.submissions : [],
    files,
    vendors: Array.isArray(base.vendors) && base.vendors.length
      ? base.vendors
      : deriveVendors(bids),
    calendar: {
      mode: base.calendar?.mode || "list"
    },
    settings: {
      workspaceName: base.settings?.workspaceName || base.workspace?.name || "Facilities Command Center",
      workspaceNote: base.settings?.workspaceNote || base.workspace?.note || "Daily facilities operations and project planning"
    },
    updatedAt: base.updatedAt || now
  };

  return appState;
}

function mergeWorkItems(existingWorkItems, tasks = []) {
  const existing = Array.isArray(existingWorkItems) ? existingWorkItems : [];
  const seen = new Set(existing.map((item) => item.id).filter(Boolean));
  const derived = tasks
    .filter((task) => task.id && !seen.has(task.id))
    .map(taskToWorkItem);

  return existing.concat(derived);
}

function taskToWorkItem(task = {}) {
  return {
    id: task.id,
    title: task.name || task.title || "Untitled work item",
    type: task.frequency && task.frequency !== "One-time" ? "maintenance" : "work",
    status: task.status || "Open",
    priority: task.priority || "Normal",
    location: task.location || "",
    dueDate: task.date || "",
    assignedTo: task.assignedTo || "",
    submittedBy: task.submittedBy || "",
    source: task.source || "legacy-task",
    relatedProjectId: task.projectId || "",
    relatedVehicleId: task.vehicleId || "",
    relatedVendorId: task.vendorId || "",
    relatedFileIds: task.fileIds || [],
    notes: task.notes || "",
    history: task.history || [],
    createdAt: task.createdAt || task.updatedAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString()
  };
}

function deriveFiles(base = {}) {
  const bidFiles = (base.bids || [])
    .filter((bid) => bid.file)
    .map((bid) => ({
      id: `file-${bid.id}`,
      fileName: bid.file,
      fileType: "Bid",
      source: "vendor-bid",
      storagePath: "",
      url: /^https?:\/\//i.test(bid.file) ? bid.file : "",
      previewText: "",
      relatedProjectId: bid.projectId || "",
      relatedWorkItemId: "",
      relatedVendorId: "",
      relatedBidId: bid.id,
      relatedVehicleId: "",
      notes: bid.notes || "",
      createdAt: bid.date || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

  return bidFiles;
}

function deriveVendors(bids = []) {
  const seen = new Map();
  bids.forEach((bid) => {
    const name = (bid.vendor || "").trim();
    if(!name) return;
    const key = name.toLowerCase();
    if(seen.has(key)) return;
    seen.set(key, {
      id: `vendor-${bid.id}`,
      name,
      status: "Active",
      notes: "",
      fileIds: [],
      createdAt: bid.date || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });
  return [...seen.values()];
}

function getDailyRhythm(appState) {
  const today = new Date().toISOString().slice(0, 10);
  const tasks = activeStateRecords(appState.tasks);
  const submissions = appState.submissions || [];
  const vehicles = activeStateRecords(appState.vehicles);
  const fuelReceipts = activeStateRecords(appState.fuelReceipts);
  const bids = activeStateRecords(appState.bids);
  const projects = activeStateRecords(appState.projects);

  const reviewCount = submissions.filter((item) => !["Approved", "Archived", "Rejected"].includes(item.status)).length;
  const dueToday = tasks.filter((task) => task.date === today && task.status !== "Complete").length;
  const urgentCount = tasks.filter((task) => ["Urgent", "High"].includes(task.priority) && task.status !== "Complete").length;
  const fleetCount = vehicles.filter((vehicle) => vehicle.status !== "Active" || isUpcomingDate(vehicle.serviceDate, 30) || isUpcomingDate(vehicle.registration, 30)).length;
  const bidCount = bids.filter((bid) => ["Received", "Needs review", "Recommended"].includes(bid.status)).length;
  const activeProjectCount = projects.filter((project) => project.status !== "Complete").length;

  return {
    reviewCount,
    dueToday,
    urgentCount,
    fleetCount,
    fuelCount: fuelReceipts.length,
    bidCount,
    activeProjectCount,
    lines: [
      reviewCount ? `${reviewCount} review item${reviewCount === 1 ? "" : "s"} waiting.` : "No review items waiting.",
      dueToday ? `${dueToday} maintenance item${dueToday === 1 ? "" : "s"} due today.` : "No maintenance due today.",
      urgentCount ? `${urgentCount} urgent/high item${urgentCount === 1 ? "" : "s"} need attention.` : "No urgent facility failures.",
      fleetCount ? `${fleetCount} fleet item${fleetCount === 1 ? "" : "s"} to check.` : "Fleet is quiet."
    ]
  };
}

function isUpcomingDate(value, daysAhead = 30) {
  if(!value) return false;
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);
  const futureString = future.toISOString().slice(0, 10);
  return value >= today && value <= futureString;
}

function activeStateRecords(records = []) {
  return (records || []).filter((item) => {
    if(item?.archivedAt || item?.deletedAt) return false;
    return !["Archived", "Deleted"].includes(item?.status);
  });
}
