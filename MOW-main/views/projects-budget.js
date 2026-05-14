(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};
  const Mappers = window.FieldOps.Services.mappers;



async function addProject(e){ e.preventDefault(); try{ await insertRecord("field_ops_projects", Mappers.projectPayloadFromForm({ name:projectName.value, status:projectStatus.value, priority:projectPriority.value, date:projectDate.value, cost:projectCost.value, budget:projectBudget.value, summary:projectLocation.value, notes:projectNotes.value })); e.target.reset(); }catch(err){ handleWriteError(err); } }


async function addBudgetItem(e){ e.preventDefault(); try{ await insertRecord("field_ops_budget_items", Mappers.budgetItemPayloadFromForm({ projectId:budgetProject.value, workOrderId:budgetWorkOrder.value, vendorId:budgetVendor.value, fuelReceiptId:budgetFuelReceipt.value, label:budgetLabel.value, itemType:budgetType.value, status:budgetStatus.value, amount:budgetAmount.value, date:budgetDate.value, notes:budgetNotes.value })); e.target.reset(); }catch(err){ handleWriteError(err); } }



async function addBid(e){
  e.preventDefault();
  try{
    const vendor = await findOrCreateVendor(bidVendor.value);
    await insertRecord("field_ops_budget_items", Mappers.bidPayloadFromForm({ id:id(), projectId:bidProject.value, vendor:bidVendor.value, status:bidStatus.value, amount:bidAmount.value, date:bidDate.value, recommended:bidRecommended.value, followupDate:bidFollowupDate.value, file:bidFile.value, notes:bidNotes.value }, vendor.id));
    e.target.reset();
  }catch(err){ handleWriteError(err); }
}



async function findOrCreateVendor(name){
  const vendorName = (name || "").trim() || "Unnamed vendor";
  const existing = app.vendors.find(v => v.name.toLowerCase() === vendorName.toLowerCase());
  if(existing) return existing;
  const data = await insertRecord("field_ops_vendors", { id:id(), ...Mappers.vendorCreationPayload(vendorName) });
  return fromVendor(data);
}



function renderProjects(){
  const projects = activeItems("projects");
  document.getElementById("projectList").innerHTML = projects.length ? projects.map(projectCardWithActions).join("") : empty("No projects yet.");
  const options = `<option value="">General / not assigned</option>` + projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  ["bidProject","taskProject","fileProject","budgetProject"].forEach(el => { if(document.getElementById(el)) document.getElementById(el).innerHTML = options; });
}



function renderBids(){
  const bids = activeItems("bids");
  document.getElementById("bidList").innerHTML = bids.length ? bids.map(b => bidCard(b) + rowActions("bids", b)).join("") : empty("No bids yet.");
  renderBidComparisonSummary();
}



function renderBudget(){
  const items = activeItems("budgetItems");
  if(document.getElementById("fileBudgetItem")){
    document.getElementById("fileBudgetItem").innerHTML = `<option value="">No related budget item</option>` + items.map(item => `<option value="${item.id}">${esc(`${item.label} - ${money(item.amount)}`)}</option>`).join("");
  }
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  document.getElementById("budgetList").innerHTML = items.length ? items.map(item => {
    const project = app.projects.find(p => p.id === item.projectId);
    const vendor = app.vendors.find(v => v.id === item.vendorId);
    const workOrder = app.tasks.find(t => t.id === item.workOrderId);
    return card(item.label,[`Amount: ${money(item.amount)}`, project ? `Project: ${project.name}` : "", vendor ? `Vendor: ${vendor.name}` : "", workOrder ? `Work order: ${workOrder.workOrderNumber || workOrder.name}` : "", item.notes],[titleize(item.itemType), titleize(item.status), item.date], tone(item.status)) + rowActions("budgetItems", item);
  }).join("") : empty("No money or budget items yet.");
  if(items.length){
    const summary = document.createElement("div");
    summary.className = "grid three";
    summary.innerHTML = `<div class="stat"><span>Items</span><strong>${items.length}</strong></div><div class="stat"><span>Total tracked</span><strong>${money(total)}</strong></div><div class="stat"><span>Approved/paid</span><strong>${items.filter(i => ["approved","paid"].includes(i.status)).length}</strong></div>`;
    document.getElementById("budgetList").prepend(summary);
  }
}



function projectCard(p){ return card(p.name,[p.summary,p.notes],[titleize(p.status),titleize(p.priority),`Estimated ${money(p.cost)}`,p.budget?`Budget ${money(p.budget)}`:"",p.date],tone(p.priority)); }


function projectCardWithActions(p){ return projectCard(p) + rowActions("projects", p); }


function bidCard(b){ const project = app.projects.find(p => p.id === b.projectId); return card(b.vendor,[`Amount: ${money(b.amount)}`, project ? `Project: ${project.name}` : "", b.notes],[titleize(b.status), b.date], tone(b.status)); }


function renderBidComparisonSummary(){
  const targets = ["bidComparisonSummary", "vendorBidSummary"].map(id => document.getElementById(id)).filter(Boolean);
  const bids = activeItems("bids").filter(b => Number(b.amount) > 0 && b.status !== "rejected");
  if(!bids.length){ targets.forEach(t => t.innerHTML = empty("No bids to compare yet.")); return; }
  const low = bids.reduce((a,b)=>Number(a.amount) < Number(b.amount) ? a : b);
  const high = bids.reduce((a,b)=>Number(a.amount) > Number(b.amount) ? a : b);
  const total = bids.reduce((s,b)=>s + Number(b.amount || 0),0);
  const recommended = bids.filter(b => b.status === "approved");
  const html = `<div class="grid three"><div class="stat"><span>Comparable bids</span><strong>${bids.length}</strong></div><div class="stat"><span>Lowest bid</span><strong>${money(low.amount)}</strong></div><div class="stat"><span>Total open bid value</span><strong>${money(total)}</strong></div></div><div style="margin-top:12px;"><div class="compare-card"><strong>Lowest:</strong> ${esc(low.vendor)} - <span class="compare-total">${money(low.amount)}</span></div>${high && high !== low ? `<div class="compare-card needs"><strong>Highest:</strong> ${esc(high.vendor)} - <span class="compare-total">${money(high.amount)}</span></div>` : ""}${recommended.length ? recommended.map(b => `<div class="compare-card recommended"><strong>Approved:</strong> ${esc(b.vendor)} - <span class="compare-total">${money(b.amount)}</span><p class="meta">${esc(b.notes || "")}</p></div>`).join("") : `<p class="meta">No bid is approved yet.</p>`}</div>`;
  targets.forEach(t => t.innerHTML = html);
}



function buildReport(show=false){
  const projects = activeItems("projects");
  const bids = activeItems("bids");
  const tasks = activeItems("tasks");
  const vehicles = activeItems("vehicles");
  const files = activeItems("files");
  const openTasks = tasks.filter(t=>!["complete","canceled"].includes(t.status));
  const urgentTasks = openTasks.filter(t=>["urgent","high"].includes(t.priority));
  const activeProjects = projects.filter(p=>p.status!=="complete");
  const fleetAttention = vehicles.filter(v=>["due_for_service","overdue_for_service","in_maintenance","out_of_service"].includes(v.status));
  const openBidValue = bids.filter(b=>!["approved","rejected","paid"].includes(b.status)).reduce((s,b)=>s+Number(b.amount||0),0);
  const html = `
    <h2>${esc(app.settings.workspaceName || "Field Operations Report")}</h2>
    <p>${esc(app.settings.workspaceNote || "")}</p>
    <h3>Work Order Summary</h3>
    <p><strong>Open work orders:</strong> ${openTasks.length}</p>
    <p><strong>Urgent/high:</strong> ${urgentTasks.length}</p>
    ${tasks.map(workOrderCard).join("") || empty("No work orders.")}
    <h3>Project Summary</h3>
    <p><strong>Active projects:</strong> ${activeProjects.length}</p>
    ${projects.map(projectCard).join("") || empty("No projects.")}
    <h3>Vehicle / Fleet Status</h3>
    <p><strong>Vehicles needing attention:</strong> ${fleetAttention.length}</p>
    ${vehicles.map(v=>card(v.name,[`Plate: ${v.plate || "Not entered"}`,`VIN: ${v.vin || "Not entered"}`,`Odometer: ${v.mileage || "Not entered"}`,v.notes],[titleize(v.status),v.serviceDate ? `Next service: ${v.serviceDate}` : ""],tone(v.status))).join("") || empty("No vehicles.")}
    <h3>Bid / Contract Packet</h3>
    <p><strong>Open bid value:</strong> ${money(openBidValue)}</p>
    ${bids.map(bidCard).join("") || empty("No bids.")}
    <h3>Document Packet</h3>
    ${files.map(documentPreviewCard).join("") || empty("No documents.")}
  `;
  document.getElementById("reportPreview").innerHTML = html;
  document.getElementById("printReport").innerHTML = html;
  if(show) showView("reports");
}



  function render(){
    renderProjects();
    renderBids();
    renderBudget();
  }

  const editConfig = {
    projects:{ table:"field_ops_projects", fields:[["name","Project name","text"],["status","Status","select:planning|active|waiting_on_vendor|needs_approval|complete|archived"],["priority","Priority","select:low|normal|high|urgent"],["date","Target date","date"],["cost","Estimated cost","number"],["budget","Approved budget","number"],["summary","Summary/location","text"],["notes","Notes","textarea"]], toDb:Mappers.projectEditPayload },
    bids:{ table:"field_ops_budget_items", fields:[["vendor","Vendor name","text"],["projectId","Project","projectSelect"],["amount","Amount","number"],["status","Status","select:draft|submitted|approved|paid|rejected|archived"],["date","Date received","date"],["notes","Notes","textarea"]], toDb:Mappers.bidEditPayload },
    budgetItems:{ table:"field_ops_budget_items", fields:[["label","Label","text"],["itemType","Type","select:expense|estimate|bid|contract|invoice|fuel|change_order|budget"],["status","Status","select:draft|submitted|approved|paid|rejected|archived"],["amount","Amount","number"],["date","Date","date"],["projectId","Project","projectSelect"],["vendorId","Vendor","vendorSelect"],["workOrderId","Work order","workOrderSelect"],["fuelReceiptId","Fuel receipt","fuelReceiptSelect"],["notes","Notes","textarea"]], toDb:Mappers.budgetItemEditPayload }
  };

  const ProjectsBudget = {
    render,
    addProject,
    addBudgetItem,
    addBid,
    findOrCreateVendor,
    renderProjects,
    renderBids,
    renderBudget,
    projectCard,
    projectCardWithActions,
    bidCard,
    renderBidComparisonSummary,
    buildReport,
    editConfig
  };

  window.FieldOps.Views.ProjectsBudget = ProjectsBudget;
  Object.assign(window.FieldOps.Views, ProjectsBudget);
  Object.assign(globalThis, {
    addProject,
    addBudgetItem,
    addBid,
    findOrCreateVendor,
    renderProjects,
    renderBids,
    renderBudget,
    projectCard,
    projectCardWithActions,
    bidCard,
    renderBidComparisonSummary,
    buildReport
  });
})();
