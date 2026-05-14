(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Services = window.FieldOps.Services || {};

  const LOCAL_PILOT_KEY = "field_ops_local_pilot_records_v1";
  const DEMO_FLAG_KEY = "field_ops_demo_seed_loaded_v1";

  const tableToSection = {
    field_ops_work_orders:"tasks",
    field_ops_projects:"projects",
    field_ops_vendors:"vendors",
    field_ops_budget_items:"budgetItems",
    field_ops_vehicles:"vehicles",
    field_ops_fuel_receipts:"fuelReceipts",
    field_ops_documents:"files",
    field_ops_import_reviews:"submissions"
  };

  function id(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()); }
  function today(){ return new Date().toISOString().slice(0, 10); }
  function soon(days){ const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

  function safeJson(raw, fallback){
    try{ return raw ? JSON.parse(raw) : fallback; }
    catch(_err){ return fallback; }
  }

  function readCache(){ return safeJson(localStorage.getItem(LOCAL_PILOT_KEY), {}); }
  function writeCache(cache){ localStorage.setItem(LOCAL_PILOT_KEY, JSON.stringify(cache)); }

  function hasOperationalRecords(app){
    return ["tasks","projects","vendors","bids","budgetItems","vehicles","fuelReceipts","files","submissions","materials","takeoffs","materialLineItems"]
      .some(section => Array.isArray(app[section]) && app[section].length);
  }

  function demoRows(){
    return {
      field_ops_projects:[{
        id:"demo-project-kitchen-renovation",
        name:"Kitchen renovation phase 1",
        status:"planning",
        priority:"high",
        target_date:soon(14),
        estimated_cost:18500,
        approved_budget:20000,
        summary:"Kitchen",
        notes:"Demo record: board-facing renovation project with contractor estimates pending."
      }],
      field_ops_vendors:[{
        id:"demo-vendor-plumbing",
        name:"Northwest Plumbing Co.",
        vendor_type:"plumbing",
        contact_name:"Jamie Rivera",
        phone:"509-555-0142",
        email:"estimates@example.com",
        status:"active",
        notes:"Demo record: preferred contractor for urgent plumbing work."
      }],
      field_ops_work_orders:[{
        id:"demo-workorder-sink-leak",
        work_order_number:"WO-DEMO-001",
        title:"Kitchen sink leak",
        type:"general",
        status:"open",
        priority:"urgent",
        due_date:today(),
        project_id:"demo-project-kitchen-renovation",
        description:"Kitchen sink cabinet — active leak reported during morning walkthrough.",
        notes:"Demo record: needs contractor review and photo attachment."
      },{
        id:"demo-workorder-exit-sign",
        work_order_number:"WO-DEMO-002",
        title:"Replace hallway exit sign",
        type:"safety",
        status:"open",
        priority:"high",
        due_date:soon(2),
        description:"Main hallway",
        notes:"Demo record: safety issue due this week."
      },{
        id:"demo-workorder-hvac-filter",
        work_order_number:"WO-DEMO-003",
        title:"HVAC filter replacement",
        type:"maintenance",
        status:"scheduled",
        priority:"normal",
        due_date:soon(5),
        description:"Admin office rooftop unit",
        notes:"Demo record: recurring maintenance example."
      }],
      field_ops_vehicles:[{
        id:"demo-vehicle-van-3",
        name:"Van #3",
        vehicle_number:"3",
        license_plate:"MOW-003",
        odometer:128450,
        status:"due_for_service",
        next_service_date:today(),
        registration_due_date:soon(7),
        notes:"Demo record: oil change due and registration due soon."
      }],
      field_ops_fuel_receipts:[],
      field_ops_budget_items:[{
        id:"demo-bid-plumbing-estimate",
        project_id:"demo-project-kitchen-renovation",
        vendor_id:"demo-vendor-plumbing",
        label:"Plumbing estimate — kitchen sink repair",
        item_type:"bid",
        status:"submitted",
        amount:2450,
        date_received:today(),
        notes:"Demo record: contractor estimate waiting for approval."
      }],
      field_ops_documents:[{
        id:"demo-doc-plumbing-estimate",
        file_name:"Demo Plumbing Estimate.pdf",
        file_type:"Estimate",
        storage_bucket:"demo-local",
        storage_path:"demo/local/plumbing-estimate.pdf",
        extracted_text:"Demo estimate: repair kitchen sink leak, replace supply lines, test shutoff valves. Total estimated cost $2,450.",
        extraction_status:"complete",
        project_id:"demo-project-kitchen-renovation",
        vendor_id:"demo-vendor-plumbing",
        budget_item_id:"demo-bid-plumbing-estimate",
        notes:"Demo record: sample PDF metadata for Review Queue testing."
      }],
      field_ops_import_reviews:[{
        id:"demo-review-freezer-photo",
        document_id:"demo-doc-plumbing-estimate",
        source:"demo review queue",
        proposed_record_type:"work_order",
        proposed_data:{
          title:"Broken freezer photo submitted",
          priority:"high",
          description:"Kitchen freezer door gasket appears loose.",
          notes:"Demo review item: decide whether this becomes a work order or project task."
        },
        status:"needs_review",
        notes:"Demo record: Broken freezer photo needs review."
      }]
    };
  }

  function mapRow(table, row, Mappers, app){
    const withDefaults = { workspace_id:"local-pilot", updated_at:new Date().toISOString(), archived_at:null, ...row };
    if(table === "field_ops_work_orders") return Mappers.fromWorkOrder(withDefaults);
    if(table === "field_ops_projects") return Mappers.fromProject(withDefaults);
    if(table === "field_ops_vendors") return Mappers.fromVendor(withDefaults);
    if(table === "field_ops_budget_items"){
      const item = Mappers.fromBudgetItem(withDefaults);
      return item;
    }
    if(table === "field_ops_vehicles") return Mappers.fromVehicle(withDefaults);
    if(table === "field_ops_fuel_receipts") return Mappers.fromFuelReceipt(withDefaults);
    if(table === "field_ops_documents") return Mappers.fromDocument(withDefaults);
    if(table === "field_ops_import_reviews") return Mappers.fromImportReview(withDefaults);
    return withDefaults;
  }

  function rebuildDerivedBids(app, Mappers){
    app.bids = (app.budgetItems || []).filter(item => item.itemType === "bid").map(item => {
      const vendor = (app.vendors || []).find(v => v.id === item.vendorId);
      return {
        id:item.id,
        projectId:item.projectId,
        vendorId:item.vendorId,
        vendor:vendor?.name || item.label,
        amount:item.amount,
        status:item.status,
        date:item.date,
        recommended:item.status === "approved" ? "Yes" : "No",
        notes:item.notes,
        archivedAt:item.archivedAt,
        updatedAt:item.updatedAt
      };
    });
  }

  function hydrateFromCache(app, Mappers){
    const cache = readCache();
    Object.entries(tableToSection).forEach(([table, section]) => {
      const rows = Array.isArray(cache[table]) ? cache[table] : [];
      if(!rows.length) return;
      app[section] = rows.map(row => mapRow(table, row, Mappers, app));
    });
    rebuildDerivedBids(app, Mappers);
  }

  function seedDemoDataIfEmpty(app, Mappers, options = {}){
    const force = Boolean(options.force);
    if(!force && hasOperationalRecords(app)) return false;
    const cache = readCache();
    if(!force && Object.values(cache).some(value => Array.isArray(value) && value.length)){
      hydrateFromCache(app, Mappers);
      return true;
    }
    const rows = demoRows();
    writeCache(rows);
    hydrateFromCache(app, Mappers);
    localStorage.setItem(DEMO_FLAG_KEY, "true");
    return true;
  }

  function localInsert(table, payload, app, Mappers){
    const cache = readCache();
    const record = {
      id:payload.id || id(),
      created_at:new Date().toISOString(),
      updated_at:new Date().toISOString(),
      archived_at:null,
      archived_by:null,
      ...payload
    };
    cache[table] = Array.isArray(cache[table]) ? cache[table] : [];
    cache[table].unshift(record);
    writeCache(cache);
    const section = tableToSection[table];
    if(section){
      app[section] = app[section] || [];
      app[section].unshift(mapRow(table, record, Mappers, app));
      if(table === "field_ops_budget_items") rebuildDerivedBids(app, Mappers);
    }
    return record;
  }

  function clearLocalPilotData(app){
    localStorage.removeItem(LOCAL_PILOT_KEY);
    localStorage.removeItem(DEMO_FLAG_KEY);
    ["tasks","projects","vendors","bids","budgetItems","vehicles","fuelReceipts","files","submissions"].forEach(section => { app[section] = []; });
  }

  function showToast(message = "Saved locally", tone = "saved"){
    const existing = document.querySelector(".toast-message");
    if(existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = `toast-message ${tone}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  function addNewOptions(){
    return [
      ["work-order", "Work Order / Maintenance Issue", "Capture a task, repair, or field issue."],
      ["project", "Project", "Start a larger repair, remodel, or board-facing need."],
      ["vendor", "Vendor / Contractor", "Add a contact, subcontractor, or preferred vendor."],
      ["bid", "Bid / Estimate", "Track a contractor estimate or invoice."],
      ["materials", "Materials / Takeoff", "Submit quantities, units, and estimated costs."],
      ["fuel", "Fuel Receipt", "Attach vehicle fuel and odometer details."],
      ["inventory", "Inventory / Supply Item", "Track supplies once inventory is active."],
      ["document", "Document Upload", "Upload receipts, PDFs, photos, or estimates."],
      ["submission", "General Submission", "Send something unusual to Review Queue."]
    ];
  }

  function initAddNewModal(){
    const modal = document.getElementById("addNewModal");
    const grid = document.getElementById("addNewGrid");
    if(!modal || !grid) return;
    grid.innerHTML = addNewOptions().map(([type, title, desc]) => `
      <button type="button" class="add-new-option" data-add-type="${type}">
        <strong>${title}</strong>
        <span>${desc}</span>
      </button>
    `).join("");
    document.querySelectorAll("[data-open-add-new]").forEach(btn => btn.addEventListener("click", openAddNew));
    document.getElementById("closeAddNewBtn")?.addEventListener("click", closeAddNew);
    modal.addEventListener("click", event => { if(event.target === modal) closeAddNew(); });
    grid.addEventListener("click", event => {
      const btn = event.target.closest("[data-add-type]");
      if(btn) handleAddNewSelection(btn.dataset.addType);
    });
  }

  function openAddNew(){ document.getElementById("addNewModal")?.classList.remove("hidden"); }
  function closeAddNew(){ document.getElementById("addNewModal")?.classList.add("hidden"); }

  function focusFirst(selector){ window.setTimeout(() => document.querySelector(selector)?.focus(), 80); }
  function handleAddNewSelection(type){
    closeAddNew();
    const route = {
      "work-order":["workOrders", "#taskName"],
      project:["projects", "#projectName"],
      vendor:["vendors", "#vendorName"],
      bid:["vendors", "#bidVendor"],
      materials:["materials", "#materialTitle"],
      fuel:["fuelReceipts", "#fuelVehicle"],
      document:["documents", "#documentUpload"],
      submission:["importReview", "#submissionDescription"]
    }[type];
    if(type === "inventory"){
      showToast("Inventory is coming next. Send supply needs through Review Queue for now.", "pending");
      globalThis.showView?.("importReview");
      focusFirst("#submissionDescription");
      return;
    }
    if(!route) return;
    globalThis.showView?.(route[0]);
    focusFirst(route[1]);
  }

  function filePreviewMarkup(file){
    if(!file) return "";
    const name = file.name || "Dropped file";
    const type = file.type || "file";
    const isImage = type.startsWith("image/");
    const url = isImage ? URL.createObjectURL(file) : "";
    return `<article class="upload-preview-card">
      ${isImage ? `<img src="${url}" alt="Preview of ${name}">` : `<div class="file-preview-icon">PDF</div>`}
      <div><strong>${name}</strong><p>${Math.round((file.size || 0) / 1024)} KB • ${type || "unknown type"}</p><p class="meta">Suggested destination: Review Queue</p></div>
    </article>`;
  }

  function initReviewDropZone(){
    const zone = document.getElementById("reviewDropZone");
    const input = document.getElementById("submissionUpload");
    const preview = document.getElementById("reviewUploadPreview");
    if(!zone || !input || !preview) return;
    ["dragenter","dragover"].forEach(name => zone.addEventListener(name, event => {
      event.preventDefault();
      zone.classList.add("drag-over");
    }));
    ["dragleave","drop"].forEach(name => zone.addEventListener(name, event => {
      event.preventDefault();
      zone.classList.remove("drag-over");
    }));
    zone.addEventListener("drop", event => {
      const file = event.dataTransfer?.files?.[0];
      if(!file) return;
      window.FieldOps.Services.interactions.droppedReviewFile = file;
      preview.innerHTML = filePreviewMarkup(file);
      document.getElementById("submissionDescription")?.focus();
      showToast("File staged for Review Queue", "pending");
    });
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      window.FieldOps.Services.interactions.droppedReviewFile = null;
      preview.innerHTML = file ? filePreviewMarkup(file) : "";
    });
  }

  function init(){
    initAddNewModal();
    initReviewDropZone();
  }

  window.FieldOps.Services.interactions = {
    LOCAL_PILOT_KEY,
    hydrateFromCache,
    seedDemoDataIfEmpty,
    localInsert,
    clearLocalPilotData,
    showToast,
    init,
    openAddNew,
    closeAddNew,
    handleAddNewSelection,
    droppedReviewFile:null
  };
})();
