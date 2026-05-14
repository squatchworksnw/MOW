const {
  DOCUMENT_BUCKET,
  supabaseClient,
  selectActive: selectActiveFromSupabase,
  selectArchived: selectArchivedFromSupabase,
  selectVehicleAlerts,
  insertRow,
  updateRow,
  archiveRow,
  restoreRow,
  insertDocumentMetadata,
  uploadDocument
} = window.FieldOps.Services.supabase;
const {
  esc,
  money,
  compact,
  titleize,
  tone,
  card,
  detailRow,
  documentPreviewCard,
  relatedSummaryCard,
  linkedButton,
  empty
} = window.FieldOps.Components;
const Mappers = window.FieldOps.Services.mappers;
const ImportReviewService = window.FieldOps.Services.importReview;
const AuthService = window.FieldOps.Services.auth;
const SyncService = window.FieldOps.Services.sync;
const InteractionService = window.FieldOps.Services.interactions || {
  hydrateFromCache(){},
  seedDemoDataIfEmpty(){ return false; },
  localInsert(){ throw new Error("Local interaction service unavailable"); },
  clearLocalPilotData(){},
  showToast(){},
  init(){}
};
const AppState = window.FieldOps.State;
const { renderers: VIEW_RENDERERS } = window.FieldOps.Views;

const runtimeState = AppState.bindRuntimeGlobals(AppState.createRuntimeState({
  pendingWrites: SyncService.loadPendingWrites()
}));
const app = runtimeState.app;

function id(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()); }
function activeItems(section){ return AppState.activeItems(app, section); }
function authState(){ return { currentSession, currentWorkspace }; }
function authContext(){ return { supabaseClient, app, getState:authState, setSession:value => { currentSession = value; }, setWorkspace:value => { currentWorkspace = value; }, createEmptyAppState:AppState.createEmptyAppState, titleize, setStatus, render, applyRoleVisibility, loadWorkspaceData, flushPendingWrites, startAutoRefresh }; }
function syncContext(){ return { getPendingWrites:() => pendingWrites, setPendingWrites:value => { pendingWrites = value; }, workspaceId, id, card, titleize, insertRow, updateRow, archiveRow, requireAuth, loadWorkspaceData }; }
function isAuthenticated(){ return AuthService.isAuthenticated(authState()); }
function workspaceId(){ return AuthService.workspaceId(authState()); }
function currentRole(){ return AuthService.currentRole(authState()); }
function isOwner(){ return AuthService.isOwner(authState()); }
function canManageOperations(){ return AuthService.canManageOperations(authState()); }
function canSubmitOnly(){ return AuthService.canSubmitOnly(authState()); }
function allowedViewsForRole(){ return AuthService.allowedViewsForRole(authState()); }
function defaultViewForRole(){ return AuthService.defaultViewForRole(authState()); }
function canAccessView(id){ return AuthService.canAccessView(id, authState()); }

function showAccessDenied(targetView){
  const message = document.getElementById("accessDeniedMessage");
  const role = titleize(currentRole() || "signed-out");
  if(message) message.textContent = `${role} access does not include ${titleize(targetView)}. Supabase RLS remains the source of truth; this screen is hidden to prevent mistakes.`;
  setStatus("Access limited by role");
  setActiveView("accessDenied");
}

function noteTimestamp(){
  return new Date().toLocaleString();
}

function actorLabel(){
  return currentSession?.user?.email || currentRole() || "Unknown user";
}

function appendHistory(existingNotes, message){
  const line = `[${noteTimestamp()}] ${actorLabel()}: ${message}`;
  return compact([existingNotes, line]).join("\n");
}

function assignedFromNotes(notes){
  const match = String(notes || "").match(/(?:^|\n)Assigned:\s*([^\n]+)/i);
  return match ? match[1].trim() : "";
}

function replaceAssignedInNotes(notes, assignee){
  const cleaned = String(notes || "").replace(/(?:^|\n)Assigned:\s*[^\n]+/i, "").trim();
  return compact([assignee ? `Assigned: ${assignee}` : "", cleaned]).join("\n");
}

function setWorkOrderDetailState(text, state = ""){
  const el = document.getElementById("workOrderDetailSaveState");
  if(!el) return;
  el.textContent = text;
  el.dataset.state = state;
}

function setInlineState(idValue, text, state = ""){
  const el = document.getElementById(idValue);
  if(!el) return;
  el.textContent = text;
  el.dataset.state = state;
}

function savePendingWrites(){ return SyncService.savePendingWrites(syncContext()); }
function renderPendingQueueState(){ return SyncService.renderPendingQueueState(syncContext()); }
function queueWrite(operation){ return SyncService.queueWrite(operation, syncContext()); }
async function applyQueuedWrite(item){ return SyncService.applyQueuedWrite(item, syncContext()); }
async function flushPendingWrites(showAlert = false){ return SyncService.flushPendingWrites(showAlert, syncContext()); }
function setStatus(text){ return SyncService.setStatus(text, syncContext()); }
function requireAuth(showAlert = false){ return AuthService.requireAuth(showAlert, authContext()); }
function isLocalPilotMode(){ return !isAuthenticated() || !currentWorkspace; }
function requireInsertPermission(table, actionLabel = "create records"){ if(isLocalPilotMode()) return true; return AuthService.requireInsertPermission(table, actionLabel, authContext()); }
function requireUpdatePermission(table, actionLabel = "change records"){ return AuthService.requireUpdatePermission(table, actionLabel, authContext()); }
function requireArchivePermission(actionLabel = "archive records"){ return AuthService.requireArchivePermission(actionLabel, authContext()); }
function requireOperationsPermission(actionLabel = "manage operations"){ if(isLocalPilotMode()) return true; return AuthService.requireOperationsPermission(actionLabel, authContext()); }
function requireOwnerPermission(actionLabel = "change workspace settings"){ return AuthService.requireOwnerPermission(actionLabel, authContext()); }

async function initializeAuth(){ return AuthService.initializeAuth(authContext()); }
function renderAuthState(){ return AuthService.renderAuthState(authContext()); }
async function signInForSync(){ return AuthService.signInForSync(authContext()); }
async function signOutForSync(){ return AuthService.signOutForSync(authContext()); }
async function bootstrapWorkspace(){ return AuthService.bootstrapWorkspace(authContext()); }

async function loadWorkspaceData(){
  if(!requireAuth(false)) return;
  setStatus("Loading Supabase data...");
  const wid = workspaceId();
  const queries = await Promise.all([
    selectActive("field_ops_buildings"),
    selectActive("field_ops_spaces"),
    selectActive("field_ops_assets"),
    selectActive("field_ops_projects"),
    selectActive("field_ops_vendors"),
    selectActive("field_ops_budget_items"),
    selectActive("field_ops_work_orders"),
    selectActive("field_ops_vehicles"),
    selectActive("field_ops_fuel_receipts"),
    selectActive("field_ops_documents"),
    selectActive("field_ops_import_reviews"),
    selectVehicleAlerts(wid),
    selectArchived("field_ops_work_orders")
  ]);

  for(const result of queries){
    if(result.error) throw result.error;
  }

  const vendors = (queries[4].data || []).map(fromVendor);
  AppState.setLoadedCollections(app, {
    buildings: (queries[0].data || []).map(fromBuilding),
    spaces: (queries[1].data || []).map(fromSpace),
    assets: (queries[2].data || []).map(fromAsset),
    projects: (queries[3].data || []).map(fromProject),
    vendors,
    budgetItems: (queries[5].data || []).map(fromBudgetItem),
    bids: (queries[5].data || []).filter(row => row.item_type === "bid").map(row => fromBudgetBid(row, vendors)),
    tasks: (queries[6].data || []).map(fromWorkOrder),
    vehicles: (queries[7].data || []).map(fromVehicle),
    fuelReceipts: (queries[8].data || []).map(fromFuelReceipt),
    files: (queries[9].data || []).map(fromDocument),
    submissions: (queries[10].data || []).map(fromImportReview),
    vehicleAlerts: queries[11].data || [],
    archivedTasks: (queries[12].data || []).map(fromWorkOrder)
  });

  setStatus("Supabase loaded");
  render();
}

function selectActive(table){
  return selectActiveFromSupabase(workspaceId(), table);
}

function selectArchived(table){
  return selectArchivedFromSupabase(workspaceId(), table);
}

async function syncNow(showAlert = true){
  try{
    await flushPendingWrites(false);
    await loadWorkspaceData();
    if(showAlert) alert("Refreshed from Supabase.");
  }catch(err){
    console.error(err);
    setStatus("Refresh failed");
    if(showAlert) alert("Refresh failed: " + err.message);
  }
}

async function loadFromCloud(){ await syncNow(true); }

function startAutoRefresh(){
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if(document.visibilityState === "visible" && isAuthenticated() && currentWorkspace) {
      loadWorkspaceData().catch(console.error);
    }
  }, 45000);
}

document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && isAuthenticated() && currentWorkspace) {
    flushPendingWrites(false).catch(console.error);
  }
});

window.addEventListener("online", () => {
  if(isAuthenticated() && currentWorkspace) flushPendingWrites(false).catch(console.error);
});

window.addEventListener("offline", () => {
  if(pendingWrites.length) setStatus(`${pendingWrites.length} pending - offline`);
  else setStatus("Offline");
});

async function insertRecord(table, payload){
  if(isLocalPilotMode()){
    const row = InteractionService.localInsert(table, payload, app, Mappers);
    setStatus("Saved locally — pilot mode");
    InteractionService.showToast("Saved locally — pilot mode", "saved");
    render();
    return row;
  }
  if(!requireInsertPermission(table, `create records in ${titleize(table.replace("field_ops_",""))}`)) throw new Error("Role cannot create this record");
  setStatus("Saving...");
  try{
    const { data, error } = await insertRow(table, { workspace_id: workspaceId(), ...payload });
    if(error) throw error;
    setStatus("Saved to Supabase");
    await loadWorkspaceData();
    return data;
  }catch(err){
    if(!SyncService.isRetryableWriteError(err)) throw err;
    const queued = queueWrite({ action:"insert", table, payload });
    return { ...payload, id:payload.id || queued.id, _queued:true };
  }
}

async function updateRecord(table, idValue, payload){
  if(!requireUpdatePermission(table, `change records in ${titleize(table.replace("field_ops_",""))}`)) throw new Error("Role cannot update this record");
  setStatus("Saving...");
  try{
    const { data, error } = await updateRow(table, idValue, payload, workspaceId());
    if(error) throw error;
    setStatus("Saved to Supabase");
    await loadWorkspaceData();
    return data;
  }catch(err){
    if(!SyncService.isRetryableWriteError(err)) throw err;
    const queued = queueWrite({ action:"update", table, recordId:idValue, payload });
    return { id:queued.id, _queued:true };
  }
}

async function archiveRecord(table, idValue){
  if(!requireArchivePermission("archive operational records")) throw new Error("Role cannot archive this record");
  setStatus("Archiving...");
  const archivedAt = new Date().toISOString();
  const archivedBy = currentSession.user.id;
  try{
    const { error } = await archiveRow(table, idValue, workspaceId(), archivedAt, archivedBy);
    if(error) throw error;
    setStatus("Archived");
    await loadWorkspaceData();
  }catch(err){
    if(!SyncService.isRetryableWriteError(err)) throw err;
    queueWrite({ action:"archive", table, recordId:idValue, archivedAt, archivedBy });
  }
}

async function restoreRecord(table, idValue){
  if(!requireArchivePermission("restore operational records")) throw new Error("Role cannot restore this record");
  setStatus("Restoring...");
  try{
    const { error } = await restoreRow(table, idValue, workspaceId());
    if(error) throw error;
    setStatus("Restored");
    await loadWorkspaceData();
  }catch(err){
    if(!SyncService.isRetryableWriteError(err)) throw err;
    queueWrite({ action:"update", table, recordId:idValue, payload:Mappers.restorePayload() });
  }
}

async function addTask(e){ e.preventDefault(); if(!requireOperationsPermission("create work orders")) return; try{ await insertRecord("field_ops_work_orders", Mappers.workOrderPayloadFromForm({ name:taskName.value, frequency:taskFrequency.value, status:taskStatus.value, priority:taskPriority.value, date:taskDate.value, projectId:taskProject.value, buildingId:taskBuilding.value, spaceId:taskSpace.value, assetId:taskAsset.value, vehicleId:taskVehicle.value, vendorId:taskVendorBid.value, location:taskLocation.value, notes:taskNotes.value })); e.target.reset(); }catch(err){ handleWriteError(err); } }
async function addBuilding(e){ e.preventDefault(); try{ await insertRecord("field_ops_buildings", Mappers.buildingPayloadFromForm({ name:buildingName.value, code:buildingCode.value, address:buildingAddress.value, status:buildingStatus.value, notes:buildingNotes.value })); e.target.reset(); }catch(err){ handleWriteError(err); } }
async function addSpace(e){ e.preventDefault(); try{ await insertRecord("field_ops_spaces", Mappers.spacePayloadFromForm({ buildingId:spaceBuilding.value, name:spaceName.value, spaceType:spaceType.value, floor:spaceFloor.value, status:spaceStatus.value, notes:spaceNotes.value })); e.target.reset(); }catch(err){ handleWriteError(err); } }
async function addAsset(e){ e.preventDefault(); try{ await insertRecord("field_ops_assets", Mappers.assetPayloadFromForm({ buildingId:assetBuilding.value, spaceId:assetSpace.value, name:assetName.value, assetTag:assetTag.value, category:assetCategory.value, status:assetStatus.value, notes:assetNotes.value })); e.target.reset(); }catch(err){ handleWriteError(err); } }
async function addVendor(e){ e.preventDefault(); try{ await insertRecord("field_ops_vendors", Mappers.vendorPayloadFromForm({ name:vendorName.value, vendorType:vendorType.value, contactName:vendorContact.value, phone:vendorPhone.value, email:vendorEmail.value, status:vendorStatus.value, insuranceExpiresOn:vendorInsurance.value, notes:vendorNotes.value })); e.target.reset(); }catch(err){ handleWriteError(err); } }
function handleWriteError(err){
  console.error(err);
  setStatus("Save failed");
}

function createViewHelpers(){
  return {
    activeItems,
    todayString,
    esc,
    card,
    empty,
    titleize,
    tone,
    renderVehicleAlertCard: window.FieldOps.Views.FleetWorkspace.renderVehicleAlertCard,
    workOrderCardWithActions,
    projectCard: window.FieldOps.Views.ProjectsBudget.projectCard,
    bidCard: window.FieldOps.Views.ProjectsBudget.bidCard
  };
}
globalThis.createViewHelpers = createViewHelpers;

function render(){
  if(isLocalPilotMode()) InteractionService.seedDemoDataIfEmpty(app, Mappers);
  window.FieldOps.Views.TodayDashboard.render(app, createViewHelpers());
  window.FieldOps.Views.ProjectsBudget.render(app, createViewHelpers());
  VIEW_RENDERERS.forEach(rendererName => {
    const renderer = globalThis[rendererName];
    if(typeof renderer === "function") renderer();
  });
  renderPermissionState();
  window.FieldOps.Views.ProjectsBudget.buildReport(false);
}

function renderPermissionState(){
  const operationsAllowed = canManageOperations();
  const submitterOnly = canSubmitOnly();
  applyRoleVisibility();
  if(document.getElementById("taskForm")){
    document.querySelectorAll("#taskForm input,#taskForm select,#taskForm textarea,#taskForm button").forEach(el => {
      el.disabled = isAuthenticated() && currentWorkspace ? !operationsAllowed : false;
    });
  }
  if(document.getElementById("workspaceName")) workspaceName.disabled = isAuthenticated() && currentWorkspace ? !isOwner() : false;
  if(document.getElementById("workspaceNote")) workspaceNote.disabled = isAuthenticated() && currentWorkspace ? !isOwner() : false;
  document.querySelectorAll("[data-admin-only]").forEach(el => {
    el.classList.toggle("hidden", isAuthenticated() && currentWorkspace ? !operationsAllowed : false);
  });
  document.querySelectorAll("[data-submitter-optional]").forEach(el => {
    el.classList.toggle("hidden", isAuthenticated() && currentWorkspace ? submitterOnly : false);
  });
  ["fileBuilding","fileSpace","fileAsset","fileProject","fileWorkOrder","fileVehicle","fileBid","fileFuelReceipt","fileBudgetItem"].forEach(idValue => {
    const field = document.getElementById(idValue)?.closest("label");
    if(field) field.classList.toggle("hidden", submitterOnly);
  });
  const importTitle = document.querySelector("#importReview h2");
  const importMeta = document.querySelector("#importReview .meta");
  const submitButton = document.querySelector("#submissionForm button[type='submit']");
  if(importTitle) importTitle.textContent = submitterOnly ? "Submit Request" : "Import Review";
  if(importMeta) importMeta.textContent = submitterOnly
    ? "Send a work request, receipt note, photo/document note, or field issue to the operations team."
    : "Extracted PDF, Excel, CSV, and incoming field notes wait here before becoming live records.";
  if(submitButton) submitButton.textContent = submitterOnly ? "Submit Request" : "Add to Import Review";
  const reviewListTitle = document.querySelector("#importReview .panel:nth-of-type(2) h3");
  const reviewListMeta = document.querySelector("#importReview .panel:nth-of-type(2) .meta");
  if(reviewListTitle) reviewListTitle.textContent = submitterOnly ? "My Submissions" : "Waiting for Review";
  if(reviewListMeta) reviewListMeta.textContent = submitterOnly ? "Requests and uploaded items visible to your account." : "Approve when it is ready to become operational work.";
  const documentsTitle = document.querySelector("#documents h2");
  const documentsMeta = document.querySelector("#documents .meta");
  const documentsListTitle = document.querySelector("#documents .panel:nth-of-type(2) h3");
  if(documentsTitle) documentsTitle.textContent = submitterOnly ? "Uploads" : "Documents";
  if(documentsMeta) documentsMeta.textContent = submitterOnly ? "Upload photos, PDFs, spreadsheets, and receipts for the operations team." : "PDF, Excel, CSV, photos, estimates, and reports stored in Supabase Storage and linked to records.";
  if(documentsListTitle) documentsListTitle.textContent = submitterOnly ? "My Uploads" : "Document Library";
}

function applyRoleVisibility(){
  const allowed = allowedViewsForRole();
  document.querySelectorAll(".tab").forEach(tab => {
    const viewId = tab.dataset.view;
    const visible = allowed.has(viewId);
    tab.classList.toggle("hidden", !visible);
    if(viewId === "importReview"){
      tab.textContent = canSubmitOnly() ? "Submit Request" : "Import Review";
    }
    if(viewId === "documents"){
      tab.textContent = canSubmitOnly() ? "Uploads" : "Documents";
    }
  });

  if(isAuthenticated() && currentWorkspace && !canAccessView(activeViewId)){
    showView(defaultViewForRole(), { skipHistory:true });
  }
}

function renderBuildings(){
  const buildings = activeItems("buildings");
  document.getElementById("buildingList").innerHTML = buildings.length ? buildings.map((b)=>card(b.name,[b.address,b.notes],[b.code,b.status],tone(b.status)) + rowActions("buildings", b)).join("") : empty("No buildings yet.");
  const options = `<option value="">No building</option>` + buildings.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join("");
  ["spaceBuilding","assetBuilding","taskBuilding","fileBuilding"].forEach(el => { if(document.getElementById(el)) document.getElementById(el).innerHTML = options; });
}

function renderSpaces(){
  const spaces = activeItems("spaces");
  document.getElementById("spaceList").innerHTML = spaces.length ? spaces.map((s)=>{ const building = app.buildings.find(b => b.id === s.buildingId); return card(s.name,[building ? `Building: ${building.name}` : "", s.notes],[s.spaceType,s.floor,s.status],tone(s.status)) + rowActions("spaces", s); }).join("") : empty("No spaces yet.");
  const options = `<option value="">No space</option>` + spaces.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  ["assetSpace","taskSpace","fileSpace"].forEach(el => { if(document.getElementById(el)) document.getElementById(el).innerHTML = options; });
}

function renderAssets(){
  const assets = activeItems("assets");
  document.getElementById("assetList").innerHTML = assets.length ? assets.map((a)=>{ const space = app.spaces.find(s => s.id === a.spaceId); return card(a.name,[space ? `Space: ${space.name}` : "", a.notes],[a.assetTag,a.category,a.status],tone(a.status)) + rowActions("assets", a); }).join("") : empty("No assets yet.");
  const options = `<option value="">No asset</option>` + assets.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
  ["taskAsset","fileAsset"].forEach(el => { if(document.getElementById(el)) document.getElementById(el).innerHTML = options; });
}

function renderVendors(){
  const vendors = activeItems("vendors");
  document.getElementById("vendorList").innerHTML = vendors.length ? vendors.map(v => card(v.name,[v.contactName, v.phone, v.email, v.notes],[v.vendorType, v.status, v.insuranceExpiresOn ? `Insurance: ${v.insuranceExpiresOn}` : ""],tone(v.status)) + rowActions("vendors", v)).join("") : empty("No vendors yet.");
  const options = `<option value="">No related vendor</option>` + vendors.map(v => `<option value="${v.id}">${esc(v.name)}</option>`).join("");
  ["taskVendorBid","fileBid","budgetVendor"].forEach(el => { if(document.getElementById(el)) document.getElementById(el).innerHTML = options; });
}

function rowActions(section, item){
  if(!canManageOperations()) return "";
  return `<div class="actions no-print"><button class="ghost" onclick="openEditModal('${section}',${app[section].indexOf(item)})">Edit</button><button class="ghost" onclick="deleteItem('${section}',${app[section].indexOf(item)})">Archive</button></div>`;
}

const editConfig = {
  buildings:{ table:"field_ops_buildings", fields:[["name","Building name","text"],["code","Code","text"],["address","Address","text"],["status","Status","select:active|inactive|under_construction|archived"],["notes","Notes","textarea"]], toDb:Mappers.buildingEditPayload },
  spaces:{ table:"field_ops_spaces", fields:[["buildingId","Building","buildingSelect"],["name","Space name","text"],["spaceType","Type","text"],["floor","Floor / area","text"],["status","Status","select:active|inactive|needs_attention|archived"],["notes","Notes","textarea"]], toDb:Mappers.spaceEditPayload },
  assets:{ table:"field_ops_assets", fields:[["buildingId","Building","buildingSelect"],["spaceId","Space","spaceSelect"],["name","Asset name","text"],["assetTag","Asset tag","text"],["category","Category","text"],["status","Status","select:active|needs_service|out_of_service|retired|archived"],["notes","Notes","textarea"]], toDb:Mappers.assetEditPayload },
  ...window.FieldOps.Views.ProjectsBudget.editConfig,
  vendors:{ table:"field_ops_vendors", fields:[["name","Vendor name","text"],["vendorType","Type","text"],["contactName","Contact name","text"],["phone","Phone","text"],["email","Email","text"],["status","Status","select:active|needs_review|inactive|archived"],["insuranceExpiresOn","Insurance expires","date"],["notes","Notes","textarea"]], toDb:Mappers.vendorEditPayload },
  tasks:{ table:"field_ops_work_orders", fields:[["name","Work order","text"],["status","Status","select:open|scheduled|in_progress|waiting|complete|canceled|archived"],["priority","Priority","select:low|normal|high|urgent"],["date","Due date","date"],["projectId","Project","projectSelect"],["buildingId","Building","buildingSelect"],["spaceId","Space","spaceSelect"],["assetId","Asset","assetSelect"],["vehicleId","Vehicle","vehicleSelect"],["vendorBidId","Vendor","vendorSelect"],["location","Location/description","text"],["notes","Notes","textarea"]], toDb:Mappers.workOrderEditPayload },
  vehicles:{ table:"field_ops_vehicles", fields:[["name","Vehicle name","text"],["vehicleNumber","Vehicle number","text"],["plate","License plate","text"],["vin","VIN","text"],["mileage","Odometer","number"],["status","Status","select:active|due_for_service|overdue_for_service|in_maintenance|out_of_service|retired|archived"],["lastServiceDate","Last service date","date"],["serviceDate","Next service date","date"],["registration","Registration due","date"],["notes","Notes","textarea"]], toDb:Mappers.vehicleEditPayload },
  fuelReceipts:{ table:"field_ops_fuel_receipts", fields:[["vehicleId","Vehicle","vehicleSelect"],["date","Date","date"],["vendor","Gas station / vendor","text"],["gallons","Gallons","number"],["totalAmount","Total amount","number"],["pricePerGallon","Price per gallon","number"],["odometer","Odometer","number"],["notes","Notes","textarea"]], toDb:Mappers.fuelReceiptEditPayload },
  files:{ table:"field_ops_documents", fields:[["fileName","File name","text"],["fileType","Type","text"],["relatedBuildingId","Building","buildingSelect"],["relatedSpaceId","Space","spaceSelect"],["relatedAssetId","Asset","assetSelect"],["relatedProjectId","Project","projectSelect"],["relatedWorkItemId","Work order","workOrderSelect"],["relatedVehicleId","Vehicle","vehicleSelect"],["relatedVendorId","Vendor","vendorSelect"],["relatedFuelReceiptId","Fuel receipt","fuelReceiptSelect"],["relatedBudgetItemId","Budget item","budgetItemSelect"],["notes","Notes","textarea"]], toDb:Mappers.documentEditPayload }
};

function openEditModal(section,index){
  if(!requireOperationsPermission("edit operational records")) return;
  const item = app[section][index];
  const config = editConfig[section];
  if(!item || !config) return;
  AppState.setCurrentEdit(runtimeState, section, index);
  editModalTitle.textContent = `Edit ${titleize(section)}`;
  editForm.innerHTML = config.fields.map(([key,label,type]) => fieldHtml(key,label,type,item[key] ?? "")).join("") +
    `<div class="actions full"><button type="submit">Save Changes</button><button class="ghost" type="button" onclick="closeEditModal()">Cancel</button></div>`;
  editModal.classList.add("active");
}

function fieldHtml(key,label,type,value){
  const lists = { projectSelect:app.projects, vehicleSelect:app.vehicles, vendorSelect:app.vendors, buildingSelect:app.buildings, spaceSelect:app.spaces, assetSelect:app.assets, workOrderSelect:app.tasks, fuelReceiptSelect:app.fuelReceipts, budgetItemSelect:app.budgetItems };
  return window.FieldOps.Components.Forms.fieldHtml({ key, label, type, value, lists, esc, titleize, money });
}

function closeEditModal(){
  editModal.classList.remove("active");
  AppState.setCurrentEdit(runtimeState);
}

editForm.addEventListener("submit", async e => {
  e.preventDefault();
  const { section, index } = currentEdit;
  const config = editConfig[section];
  const item = app[section]?.[index];
  if(!config || !item) return;
  const formData = new FormData(editForm);
  config.fields.forEach(([key]) => { item[key] = formData.get(key) || ""; });
  try{
    if(section === "bids" && item.vendor){
      const vendor = await findOrCreateVendor(item.vendor);
      item.vendorId = vendor.id;
      await updateRecord(config.table, item.id, { ...config.toDb(item), vendor_id: vendor.id });
    } else {
      await updateRecord(config.table, item.id, config.toDb(item));
    }
    closeEditModal();
  }catch(err){ handleWriteError(err); }
});

async function deleteItem(section,index){
  if(!requireOperationsPermission("archive operational records")) return;
  const item = app[section]?.[index];
  const config = editConfig[section];
  if(!item || !config) return;
  if(!confirm("Archive this item? It will be hidden from active lists but kept for history.")) return;
  try{ await archiveRecord(config.table, item.id); }
  catch(err){ handleWriteError(err); }
}

async function approveSubmissionById(reviewId){
  const item = app.submissions.find(s => s.id === reviewId);
  if(!item) return;
  try{
    await ImportReviewService.approveReview({ reviewId, review:item, type:item.importTarget, data:item.importedRecord || {}, documentId:item.documentId, reviewerId:currentSession.user.id }, { app, insertRecord, updateRecord, archiveRecord, id });
  }catch(err){ handleWriteError(err); }
}

function renderSettings(){
  workspaceName.value = app.settings.workspaceName || "";
  workspaceNote.value = app.settings.workspaceNote || "";
  const settingsWorkspaceId = document.getElementById("settingsWorkspaceId");
  if(settingsWorkspaceId) settingsWorkspaceId.textContent = currentWorkspace ? `${currentWorkspace.name} (${currentWorkspace.id})` : "Not loaded";
  renderPendingQueueState();
}

function printBoardReport(){ buildReport(false); window.print(); }
function downloadBackup(){ const blob = new Blob([JSON.stringify(app,null,2)], {type:"application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `field-ops-cache-${todayString()}.json`; a.click(); URL.revokeObjectURL(url); }
function uploadBackup(){ alert("Backups are read-only now. Supabase field_ops_* tables are the source of truth."); }
function resetLocalData(){ InteractionService.clearLocalPilotData(app); AppState.resetRuntimeApp(runtimeState); render(); setStatus("Temporary cache cleared"); InteractionService.showToast("Temporary local data cleared", "saved"); }
function setActiveView(id){
  activeViewId = id;
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  updateBackButton();
  window.scrollTo({top:0,behavior:"smooth"});
}

function showView(id, options = {}){
  if(!document.getElementById(id)) return;
  if(!canAccessView(id)){
    if(id !== activeViewId && !options.skipHistory){
      AppState.pushViewHistory(runtimeState, activeViewId);
    }
    showAccessDenied(id);
    return;
  }
  if(id !== activeViewId && !options.skipHistory){
    AppState.pushViewHistory(runtimeState, activeViewId);
  }
  setActiveView(id);
}

function goBackView(){
  const previous = AppState.popViewHistory(runtimeState);
  showView(previous || defaultViewForRole(), { skipHistory:true });
}

function updateBackButton(){
  const button = document.getElementById("appBackBtn");
  if(!button) return;
  button.classList.toggle("hidden", !viewHistory.length || activeViewId === defaultViewForRole());
}

function normalizeKey(key){ return String(key || "").toLowerCase().replace(/[^a-z0-9]/g,""); }
function getValue(row, possibleNames){ const lookup = {}; Object.keys(row).forEach(k => lookup[normalizeKey(k)] = row[k]); for(const name of possibleNames){ const found = lookup[normalizeKey(name)]; if(found !== undefined && found !== null && String(found).trim() !== "") return String(found).trim(); } return ""; }

function inferImportType(headers){
  const joined = headers.map(normalizeKey).join(" ");
  if(joined.includes("vin") || joined.includes("plate") || joined.includes("odometer")) return "vehicle";
  if(joined.includes("gallons") || joined.includes("pricepergallon") || joined.includes("gasstation")) return "fuel_receipt";
  if(joined.includes("vendor") || joined.includes("contractor") || joined.includes("company")) {
    if(joined.includes("amount") || joined.includes("bid") || joined.includes("invoice")) return "budget_item";
    return "vendor";
  }
  if(joined.includes("asset") || joined.includes("tag") || joined.includes("serial")) return "asset";
  if(joined.includes("project") || joined.includes("budget")) return "project";
  return "work_order";
}

function targetFieldsForImport(type){
  const normalized = normalizeProposedType(type);
  const fields = {
    work_order:["title","priority","date","location","notes"],
    project:["name","priority","date","location","amount","notes"],
    budget_item:["vendor","label","amount","date","notes"],
    vendor:["vendor","name","contact","phone","email","category","notes"],
    vehicle:["vehicle","name","plate","vin","mileage","date","notes"],
    fuel_receipt:["vehicle","vendor","date","gallons","amount","price_per_gallon","odometer","notes"],
    asset:["asset","name","tag","category","location","notes"]
  };
  return fields[normalized] || fields.work_order;
}

function guessHeaderForField(headers, field){
  const aliases = {
    title:["title","task","work order","scope","description"],
    name:["name","project","vehicle","asset"],
    vendor:["vendor","contractor","company","supplier","gas station","station"],
    vehicle:["vehicle","vehicle name","unit"],
    plate:["plate","license plate"],
    vin:["vin"],
    mileage:["mileage","odometer"],
    tag:["tag","asset tag","serial"],
    category:["category","type","service category"],
    contact:["contact","contact name"],
    phone:["phone","telephone"],
    email:["email"],
    amount:["amount","bid amount","cost","estimate","price","total"],
    date:["date","due date","service date","receipt date"],
    gallons:["gallons"],
    price_per_gallon:["price per gallon","price/gal","ppg"],
    odometer:["odometer","mileage"],
    priority:["priority","urgency"],
    location:["location","site","building","area","room"],
    notes:["notes","details","scope","comments","description"],
    label:["label","item","description","invoice","bid"]
  };
  const wanted = aliases[field] || [field];
  return headers.find(header => wanted.some(alias => normalizeKey(header) === normalizeKey(alias))) ||
    headers.find(header => wanted.some(alias => normalizeKey(header).includes(normalizeKey(alias)))) || "";
}

function renderMappingPanel(){
  const target = document.getElementById("mappingPanel");
  if(!target) return;
  if(!stagedImport.rows.length){
    target.innerHTML = empty("Upload an Excel or CSV file to preview rows and match columns.");
    return;
  }
  const fields = targetFieldsForImport(stagedImport.suggestedType);
  const options = `<option value="">Do not map</option>` + stagedImport.headers.map(header => `<option value="${esc(header)}">${esc(header)}</option>`).join("");
  target.innerHTML = `<article class="card"><h4>Suggested import: ${esc(titleize(stagedImport.suggestedType))}</h4><p>${stagedImport.rows.length} row${stagedImport.rows.length === 1 ? "" : "s"} ready to stage after review.</p><div class="form-grid">${fields.map(field => {
    const guess = guessHeaderForField(stagedImport.headers, field);
    return `<label>${esc(titleize(field))}<select data-map-field="${esc(field)}">${options.replace(`value="${esc(guess)}"`, `value="${esc(guess)}" selected`)}</select></label>`;
  }).join("")}</div></article>`;
}

function getCurrentColumnMapping(){
  const mapping = {};
  document.querySelectorAll("[data-map-field]").forEach(select => {
    if(select.value) mapping[select.dataset.mapField] = select.value;
  });
  return mapping;
}

function mapRowWithColumns(row, mapping){
  const mapped = {};
  Object.entries(mapping).forEach(([field, header]) => {
    mapped[field] = row[header] ?? "";
  });
  return mapped;
}

async function rowsToReviewSubmissions(rows, type, source){
  let added = 0;
  for(const row of rows){
    if(!row || Object.values(row).every(v => v === null || v === undefined || String(v).trim() === "")) continue;
    const proposedType = normalizeProposedType(type);
    const proposed = {
      title:getValue(row,["task","work order","project","name","title","scope"]) || `Imported ${titleize(proposedType)}`,
      name:getValue(row,["vehicle","vehicle name","project","project name","name","title"]),
      vendor:getValue(row,["vendor","contractor","company","supplier","gas station"]),
      amount:getValue(row,["amount","bid amount","cost","estimate","price","total"]),
      date:getValue(row,["date","due date","service date","receipt date"]),
      gallons:getValue(row,["gallons"]),
      odometer:getValue(row,["odometer","mileage"]),
      plate:getValue(row,["plate","license plate"]),
      priority:getValue(row,["priority"]),
      location:getValue(row,["location","site","building","area"]),
      notes:getValue(row,["notes","description","scope","details"])
    };
    await createImportReview(source, proposedType, proposed, `Review imported ${titleize(proposedType)}: ${proposed.title || proposed.name || proposed.vendor || "Imported row"}`);
    added++;
  }
  return added;
}

async function extractFileText(file){
  const name = file.name.toLowerCase();
  if(name.endsWith(".csv")) return await file.text();
  if(name.endsWith(".pdf")) return await extractPdfText(file);
  return "";
}

async function createUploadedDocumentForImport(file, fileTypeValue, extractedText = "", extractionStatus = "pending"){
  if(!requireAuth(true)) throw new Error("Not signed in");
  const docId = id();
  const storagePath = await uploadDocumentToStorage(file, docId);
  await saveDocumentMetadata({
    docId,
    fileNameValue:file.name,
    fileTypeValue,
    storagePath,
    extractedText,
    extractionStatus,
    notes:"Uploaded through Import / Extraction Center"
  });
  return docId;
}

async function handleSpreadsheetFile(file){
  try{
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type:"array" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval:"" });
    const headers = rows[0] ? Object.keys(rows[0]) : [];
    const docId = await createUploadedDocumentForImport(file, file.name.toLowerCase().endsWith(".csv") ? "CSV Import" : "Excel Import", JSON.stringify(rows.slice(0,50), null, 2), "complete");
    const userType = spreadsheetImportType.value === "auto" ? "" : normalizeProposedType(spreadsheetImportType.value);
    const suggestedType = userType || inferImportType(headers);
    AppState.setStagedImport(runtimeState, { rows, source:`Spreadsheet: ${file.name}`, documentId:docId, headers, suggestedType });
    extractionPreview.value = JSON.stringify(rows.slice(0,12), null, 2);
    renderMappingPanel();
    await loadWorkspaceData();
    alert(`${rows.length} row${rows.length === 1 ? "" : "s"} parsed. Review the preview, fix column matching, then stage rows to Import Review.`);
  }catch(err){ handleWriteError(err); }
}

async function extractPdfText(file){
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const chunks = [];
  for(let i = 1; i <= pdf.numPages; i++){
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    chunks.push(content.items.map(item => item.str).join(" "));
  }
  return chunks.join("\n\n").trim();
}

async function handlePdfFile(file){
  try{
    const text = await extractPdfText(file);
    const docId = await createUploadedDocumentForImport(file, "PDF Import", text, text ? "complete" : "not_supported");
    extractionPreview.value = text || "No readable text found.";
    const proposedType = normalizeProposedType(pdfImportType.value);
    await createImportReview(`PDF: ${file.name}`, proposedType, { file_name:file.name, extracted_text:text }, `Review extracted PDF text from ${file.name}`, docId);
    await loadWorkspaceData();
    alert("PDF staged in Import Review.");
  }catch(err){ handleWriteError(err); }
}

async function stageMappedRows(){
  try{
    if(!stagedImport.rows.length){
      alert("Upload a spreadsheet first.");
      return;
    }
    const mapping = getCurrentColumnMapping();
    if(!Object.keys(mapping).length){
      alert("Match at least one column before staging rows.");
      return;
    }
    const mappedRows = stagedImport.rows.map(row => mapRowWithColumns(row, mapping));
    let added = 0;
    for(const row of mappedRows){
      if(Object.values(row).every(value => value === null || value === undefined || String(value).trim() === "")) continue;
      await createImportReview(stagedImport.source, stagedImport.suggestedType, row, `Review imported ${titleize(stagedImport.suggestedType)}: ${row.title || row.name || row.vendor || row.label || "Imported row"}`, stagedImport.documentId);
      added++;
    }
    AppState.resetStagedImport(runtimeState);
    renderMappingPanel();
    await loadWorkspaceData();
    alert(`${added} row${added === 1 ? "" : "s"} staged in Import Review.`);
  }catch(err){ handleWriteError(err); }
}

function copyExtractionToClipboard(){ navigator.clipboard.writeText(extractionPreview.value || ""); }
function clearExtractionPreview(){ extractionPreview.value = ""; }

document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
document.getElementById("appBackBtn")?.addEventListener("click", goBackView);
InteractionService.init();
signInBtn.addEventListener("click", signInForSync);
signOutBtn.addEventListener("click", signOutForSync);
authEmail.addEventListener("keydown", e => { if(e.key === "Enter") signInForSync(); });
projectForm.addEventListener("submit", addProject);
bidForm.addEventListener("submit", addBid);
vendorForm.addEventListener("submit", addVendor);
taskForm.addEventListener("submit", addTask);
vehicleForm.addEventListener("submit", addVehicle);
fuelReceiptForm.addEventListener("submit", addFuelReceipt);
budgetForm.addEventListener("submit", addBudgetItem);
fileForm.addEventListener("submit", addFileRecord);
submissionForm.addEventListener("submit", addSubmission);
buildingForm.addEventListener("submit", addBuilding);
spaceForm.addEventListener("submit", addSpace);
assetForm.addEventListener("submit", addAsset);
workspaceName.addEventListener("change", async e => {
  if(!requireOwnerPermission("change workspace settings")) return;
  try{ await updateRecord("field_ops_workspaces", workspaceId(), { name:e.target.value }); }
  catch(err){ handleWriteError(err); }
});
workspaceNote.addEventListener("change", e => { app.settings.workspaceNote = e.target.value; renderSettings(); });
backupUpload.addEventListener("change", e=>{ if(e.target.files[0]) uploadBackup(e.target.files[0]); e.target.value=""; });
spreadsheetUpload.addEventListener("change", e=>{ if(e.target.files[0]) handleSpreadsheetFile(e.target.files[0]); e.target.value=""; });
pdfUpload.addEventListener("change", e=>{ if(e.target.files[0]) handlePdfFile(e.target.files[0]); e.target.value=""; });

if(window.pdfjsLib){
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
}

initializeAuth();
