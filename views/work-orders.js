(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};

function renderTasks(){
  const tasks = activeItems("tasks");
  document.getElementById("taskList").innerHTML = tasks.length ? tasks.map(t => workOrderCardWithActions(t)).join("") : empty("No work orders yet.");
  const archivedList = document.getElementById("archivedTaskList");
  if(archivedList){
    const archived = app.archivedTasks || [];
    archivedList.innerHTML = archived.length ? archived.map(t => `${workOrderCard(t)}<div class="actions no-print"><button class="ghost" type="button" onclick="restoreWorkOrder('${t.id}')">Restore</button></div>`).join("") : empty("No archived work orders.");
  }
  const options = `<option value="">No related work order</option>` + tasks.map(t => `<option value="${t.id}">${esc(t.workOrderNumber ? `${t.workOrderNumber} - ${t.name}` : t.name)}</option>`).join("");
  if(document.getElementById("budgetWorkOrder")) document.getElementById("budgetWorkOrder").innerHTML = options;
  if(document.getElementById("fileWorkOrder")) document.getElementById("fileWorkOrder").innerHTML = options;
}



function workOrderCardWithActions(t){
  if(!canManageOperations()) return workOrderCard(t);
  const index = app.tasks.indexOf(t);
  return `${workOrderCard(t)}<div class="actions no-print"><button type="button" onclick="openWorkOrderDetail('${t.id}')">Open</button><button class="ghost" type="button" onclick="openEditModal('tasks',${index})">Edit</button><button class="ghost" type="button" onclick="deleteItem('tasks',${index})">Archive</button></div>`;
}


function workOrderCard(t){
  const project = app.projects.find(p => p.id === t.projectId);
  const building = app.buildings.find(b => b.id === t.buildingId);
  const space = app.spaces.find(s => s.id === t.spaceId);
  const asset = app.assets.find(a => a.id === t.assetId);
  const vehicle = app.vehicles.find(v => v.id === t.vehicleId);
  const vendor = app.vendors.find(v => v.id === t.vendorBidId);
  return card(t.name,[t.workOrderNumber, t.location, project ? `Project: ${project.name}` : "", building ? `Building: ${building.name}` : "", space ? `Space: ${space.name}` : "", asset ? `Asset: ${asset.name}` : "", vehicle ? `Vehicle: ${vehicle.name}` : "", vendor ? `Vendor: ${vendor.name}` : "", t.notes],[titleize(t.status),titleize(t.priority),t.date],tone(t.priority || t.status));
}



async function archiveWorkOrderById(workOrderId){
  if(!requireOperationsPermission("archive work orders")) return;
  if(!confirm("Archive this work order? It will leave the active list but stay recoverable.")) return;
  try{
    await archiveRecord("field_ops_work_orders", workOrderId);
    if(selectedWorkOrderId === workOrderId) selectedWorkOrderId = "";
    showView("workOrders", { skipHistory:true });
  }catch(err){
    console.error(err);
    setWorkOrderDetailState(`Archive failed: ${err.message}`, "failed");
    setStatus("Archive failed");
  }
}



async function restoreWorkOrder(workOrderId){
  if(!requireOperationsPermission("restore work orders")) return;
  try{
    await restoreRecord("field_ops_work_orders", workOrderId);
    setStatus("Work order restored");
    renderTasks();
  }catch(err){
    console.error(err);
    setStatus("Restore failed");
  }
}



function openWorkOrderDetail(workOrderId){
  if(!requireOperationsPermission("view full work orders")) return;
  selectedWorkOrderId = workOrderId;
  renderWorkOrderDetail();
  showView("workOrderDetail");
}



function selectedWorkOrder(){
  return app.tasks.find(t => t.id === selectedWorkOrderId);
}



function renderWorkOrderDetail(){
  const title = document.getElementById("workOrderDetailTitle");
  const meta = document.getElementById("workOrderDetailMeta");
  const body = document.getElementById("workOrderDetailBody");
  if(!title || !meta || !body) return;
  const task = selectedWorkOrder();
  if(!task){
    title.textContent = "Work Order";
    meta.textContent = "Choose a work order from the list.";
    body.innerHTML = empty("No work order selected.");
    return;
  }

  const project = app.projects.find(p => p.id === task.projectId);
  const building = app.buildings.find(b => b.id === task.buildingId);
  const space = app.spaces.find(s => s.id === task.spaceId);
  const asset = app.assets.find(a => a.id === task.assetId);
  const vehicle = app.vehicles.find(v => v.id === task.vehicleId);
  const vendor = app.vendors.find(v => v.id === task.vendorBidId);
  const documents = activeItems("files").filter(f => f.relatedWorkItemId === task.id);
  const attachableDocuments = activeItems("files").filter(f => !f.relatedWorkItemId || f.relatedWorkItemId !== task.id);
  const budgetItems = activeItems("budgetItems").filter(item => item.workOrderId === task.id);
  const budgetTotal = budgetItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const assignedTo = task.assignedTo || assignedFromNotes(task.notes);
  const historyLines = String(task.notes || "").split("\n").filter(line => line.trim());
  const relatedCards = [
    relatedSummaryCard("Project", project, [project?.summary, project?.notes], [titleize(project?.status || ""), titleize(project?.priority || "")]),
    relatedSummaryCard("Building", building, [building?.address, building?.notes], [titleize(building?.status || "")]),
    relatedSummaryCard("Space", space, [space?.spaceType, space?.floor ? `Floor: ${space.floor}` : "", space?.notes], [titleize(space?.status || "")]),
    relatedSummaryCard("Asset", asset, [asset?.assetTag ? `Tag: ${asset.assetTag}` : "", asset?.category, asset?.notes], [titleize(asset?.status || "")]),
    relatedSummaryCard("Vehicle", vehicle, [vehicle?.vehicleNumber ? `Vehicle #: ${vehicle.vehicleNumber}` : "", vehicle?.plate ? `Plate: ${vehicle.plate}` : "", vehicle?.vin ? `VIN: ${vehicle.vin}` : "", vehicle?.mileage ? `Odometer: ${vehicle.mileage}` : ""], [titleize(vehicle?.status || "")]),
    relatedSummaryCard("Vendor", vendor, [vendor?.contactName, vendor?.phone, vendor?.email, vendor?.notes], [titleize(vendor?.vendorType || ""), titleize(vendor?.status || "")])
  ].filter(Boolean).join("");

  title.textContent = task.name || "Work Order";
  meta.textContent = compact([task.workOrderNumber, titleize(task.status), titleize(task.priority), task.date ? `Due ${task.date}` : "No due date"]).join(" | ");
  body.innerHTML = `
    <div class="field-status-strip">
      <span class="status-chip ${tone(task.status)}">${esc(titleize(task.status || "open"))}</span>
      <span class="status-chip ${tone(task.priority)}">${esc(titleize(task.priority || "normal"))}</span>
      <span class="status-chip">${esc(task.date ? `Due ${task.date}` : "No due date")}</span>
      <span class="status-chip">${esc(assignedTo || "Unassigned")}</span>
    </div>
    <div class="grid three">
      ${detailRow("Status", titleize(task.status))}
      ${detailRow("Priority", titleize(task.priority))}
      ${detailRow("Due date", task.date)}
      ${detailRow("Assigned", assignedTo)}
    </div>
    <div class="quick-action-bar no-print">
      <button type="button" onclick="markWorkOrderComplete('${task.id}')">Mark Complete</button>
      <button class="ghost" type="button" onclick="focusWorkOrderField('workOrderDetailDueDate')">Reschedule</button>
      <button class="ghost" type="button" onclick="focusWorkOrderField('workOrderDetailStatus')">Change Status</button>
      <button class="ghost" type="button" onclick="focusWorkOrderField('workOrderDetailAssignee')">Assign</button>
      <button class="ghost" type="button" onclick="focusWorkOrderField('workOrderDetailUpload')">Attach File</button>
      <button class="ghost" type="button" onclick="focusWorkOrderField('workOrderDetailNote')">Add Note</button>
    </div>
    <div class="detail-block">
      <div class="panel-title"><h3>Linked Records</h3></div>
      <div class="actions">
        ${linkedButton("Project", project?.name, "projects")}
        ${linkedButton("Building", building?.name, "buildings")}
        ${linkedButton("Space", space?.name, "spaces")}
        ${linkedButton("Asset", asset?.name, "assets")}
        ${linkedButton("Vehicle", vehicle?.name, "vehicles")}
        ${linkedButton("Vendor", vendor?.name, "vendors")}
      </div>
      <div class="grid two">${relatedCards}</div>
      ${!relatedCards ? empty("No linked records yet.") : ""}
    </div>
    <div class="grid two">
      <section class="detail-block">
        <div class="panel-title"><h3>Notes</h3></div>
        ${card(task.location || "Location not set", [task.notes || "No notes yet."], [], "")}
      </section>
      <section class="detail-block">
        <div class="panel-title"><h3>Cost Snapshot</h3></div>
        <div class="grid two">
          ${detailRow("Budget items", String(budgetItems.length))}
          ${detailRow("Total tracked", money(budgetTotal))}
        </div>
      </section>
    </div>
    <section class="detail-block">
      <div class="panel-title"><h3>Documents</h3><button class="ghost" type="button" onclick="showView('documents')">Upload / Link Document</button></div>
      <div class="card-list">${documents.length ? documents.map(doc => `${documentPreviewCard(doc)}<div class="actions no-print"><button class="ghost" type="button" onclick="unlinkDocumentFromWorkOrder('${doc.id}')">Unlink</button></div>`).join("") : empty("No documents linked to this work order yet.")}</div>
    </section>
    <section class="detail-block no-print">
      <div class="panel-title"><h3>Field Update</h3><p class="meta" id="workOrderDetailSaveState">Ready</p></div>
      <div class="form-grid">
        <label>Status<select id="workOrderDetailStatus"><option value="open">Open</option><option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option><option value="waiting">Waiting</option><option value="complete">Complete</option><option value="canceled">Canceled</option></select></label>
        <label>Priority<select id="workOrderDetailPriority"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        <label>Due date<input id="workOrderDetailDueDate" type="date" value="${esc(task.date || "")}" /></label>
        <label>Assigned person<input id="workOrderDetailAssignee" value="${esc(assignedTo)}" placeholder="Name, team, or vendor" /></label>
        <label>Attach existing document<select id="workOrderExistingDocument"><option value="">Choose existing document</option>${attachableDocuments.map(f => `<option value="${esc(f.id)}">${esc(f.fileName)}</option>`).join("")}</select></label>
        <label class="full">Add note<textarea id="workOrderDetailNote" placeholder="Add a field note, status update, or follow-up..."></textarea></label>
        <label>Attach document<input id="workOrderDetailUpload" type="file" accept=".pdf,.csv,.xlsx,.xls,image/*" /></label>
      </div>
      <div class="actions"><button type="button" onclick="saveWorkOrderDetailUpdates()">Save Update</button></div>
    </section>
    <section class="detail-block">
      <div class="panel-title"><h3>History</h3></div>
      <div class="timeline">${historyLines.length ? historyLines.map(line => `<article class="timeline-item"><p>${esc(line)}</p></article>`).join("") : empty("No visible history yet.")}</div>
    </section>
  `;

  const editBtn = document.getElementById("workOrderDetailEditBtn");
  const completeBtn = document.getElementById("workOrderDetailCompleteBtn");
  const archiveBtn = document.getElementById("workOrderDetailArchiveBtn");
  const taskIndex = app.tasks.indexOf(task);
  if(editBtn) editBtn.onclick = () => openEditModal("tasks", taskIndex);
  if(completeBtn) completeBtn.onclick = () => markWorkOrderComplete(task.id);
  if(archiveBtn) archiveBtn.onclick = () => archiveWorkOrderById(task.id);
  const statusSelect = document.getElementById("workOrderDetailStatus");
  if(statusSelect) statusSelect.value = task.status || "open";
  const prioritySelect = document.getElementById("workOrderDetailPriority");
  if(prioritySelect) prioritySelect.value = task.priority || "normal";
}



function focusWorkOrderField(idValue){
  const field = document.getElementById(idValue);
  if(!field) return;
  field.scrollIntoView({ behavior:"smooth", block:"center" });
  field.focus();
}



async function markWorkOrderComplete(workOrderId){
  if(!requireOperationsPermission("complete work orders")) return;
  const task = app.tasks.find(t => t.id === workOrderId);
  try{
    setWorkOrderDetailState("Saving completion...", "pending");
    await updateRecord("field_ops_work_orders", workOrderId, { status:"complete", notes:appendHistory(task?.notes, "Marked complete") });
    setWorkOrderDetailState("Complete saved", "saved");
  }catch(err){
    console.error(err);
    setWorkOrderDetailState(`Save failed: ${err.message}`, "failed");
    setStatus("Save failed");
  }
}



async function unlinkDocumentFromWorkOrder(documentId){
  if(!requireOperationsPermission("unlink work order documents")) return;
  try{
    setWorkOrderDetailState("Unlinking document...", "pending");
    await updateRecord("field_ops_documents", documentId, { work_order_id:null });
    setWorkOrderDetailState("Document unlinked", "saved");
  }catch(err){
    console.error(err);
    setWorkOrderDetailState(`Unlink failed: ${err.message}`, "failed");
    setStatus("Unlink failed");
  }
}



async function saveWorkOrderDetailUpdates(){
  const task = selectedWorkOrder();
  if(!task || !requireOperationsPermission("update work orders")) return;
  try{
    const status = document.getElementById("workOrderDetailStatus")?.value || task.status;
    const priority = document.getElementById("workOrderDetailPriority")?.value || task.priority || "normal";
    const dueDate = document.getElementById("workOrderDetailDueDate")?.value || null;
    const assignee = document.getElementById("workOrderDetailAssignee")?.value.trim();
    const existingDocumentId = document.getElementById("workOrderExistingDocument")?.value || "";
    const note = document.getElementById("workOrderDetailNote")?.value.trim();
    const upload = document.getElementById("workOrderDetailUpload")?.files?.[0];
    const statusChanged = status !== task.status;
    const priorityChanged = priority !== (task.priority || "normal");
    const dueChanged = dueDate !== (task.date || null);
    const assignedChanged = assignee !== (task.assignedTo || assignedFromNotes(task.notes));
    let notes = replaceAssignedInNotes(task.notes, assignee);
    if(statusChanged) notes = appendHistory(notes, `Status changed from ${titleize(task.status)} to ${titleize(status)}`);
    if(priorityChanged) notes = appendHistory(notes, `Priority changed from ${titleize(task.priority || "normal")} to ${titleize(priority)}`);
    if(dueChanged) notes = appendHistory(notes, `Due date changed from ${task.date || "not set"} to ${dueDate || "not set"}`);
    if(assignedChanged) notes = appendHistory(notes, `Assigned to ${assignee || "not set"}`);
    if(note) notes = appendHistory(notes, note);
    setWorkOrderDetailState("Saving...", "pending");
    await updateRecord("field_ops_work_orders", task.id, { status, priority, due_date:dueDate, notes: notes || null });
    if(existingDocumentId){
      await updateRecord("field_ops_documents", existingDocumentId, { work_order_id: task.id });
    }
    if(upload){
      const docId = id();
      const storagePath = await uploadDocumentToStorage(upload, docId);
      const extractedText = await extractFileText(upload);
      await saveDocumentMetadata({
        docId,
        fileNameValue: upload.name,
        fileTypeValue: fileTypeFromName(upload.name),
        storagePath,
        extractedText,
        extractionStatus: extractedText ? "complete" : "not_supported",
        links:{ workOrderId:task.id },
        notes:`Attached from work order ${task.workOrderNumber || task.name}`
      });
    }
    setStatus("Work order saved");
    setWorkOrderDetailState("Saved", "saved");
    await loadWorkspaceData();
  }catch(err){
    console.error(err);
    setWorkOrderDetailState(`Save failed: ${err.message}`, "failed");
    setStatus("Save failed");
  }
}



  Object.assign(window.FieldOps.Views, {
    renderTasks,
    workOrderCardWithActions,
    workOrderCard,
    archiveWorkOrderById,
    restoreWorkOrder,
    openWorkOrderDetail,
    selectedWorkOrder,
    renderWorkOrderDetail,
    focusWorkOrderField,
    markWorkOrderComplete,
    unlinkDocumentFromWorkOrder,
    saveWorkOrderDetailUpdates
  });
  Object.assign(globalThis, {
    renderTasks,
    workOrderCardWithActions,
    workOrderCard,
    archiveWorkOrderById,
    restoreWorkOrder,
    openWorkOrderDetail,
    selectedWorkOrder,
    renderWorkOrderDetail,
    focusWorkOrderField,
    markWorkOrderComplete,
    unlinkDocumentFromWorkOrder,
    saveWorkOrderDetailUpdates
  });
})();
