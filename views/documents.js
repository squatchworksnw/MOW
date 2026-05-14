(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};
  const Mappers = window.FieldOps.Services.mappers;

async function saveDocumentMetadata({ docId, fileNameValue, fileTypeValue, storagePath, extractedText = "", extractionStatus = "not_supported", links = {}, notes = "" }){
  if(isLocalPilotMode()){
    const row = window.FieldOps.Services.interactions.localInsert("field_ops_documents", Mappers.documentMetadataPayload({ docId, workspaceId:"local-pilot", fileNameValue, fileTypeValue, storagePath:storagePath || fileNameValue, bucket:"local-pilot", extractedText, extractionStatus, links, notes }), app, Mappers);
    return row.id;
  }
  if(!requireInsertPermission("field_ops_documents", "upload documents")) throw new Error("Role cannot upload documents");
  const { error } = await insertDocumentMetadata(Mappers.documentMetadataPayload({ docId, workspaceId:workspaceId(), fileNameValue, fileTypeValue, storagePath, bucket:DOCUMENT_BUCKET, extractedText, extractionStatus, links, notes }));
  if(error) throw error;
  return docId;
}

async function uploadDocumentToStorage(file, docId){
  if(isLocalPilotMode()) return `local-pilot/${docId}/${file.name.replace(/[^\w.\- ]+/g, "_")}`;
  if(!navigator.onLine){
    setStatus("File not uploaded - offline");
    throw new Error("This file is not uploaded yet because the device is offline. Reconnect and try the upload again.");
  }
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
  const storagePath = `${workspaceId()}/${docId}/${safeName}`;
  const { error } = await uploadDocument(storagePath, file);
  if(error) throw error;
  return storagePath;
}



async function addFileRecord(e){
  e.preventDefault();
  try{
    if(!requireInsertPermission("field_ops_documents", "upload documents")) return;
    setInlineState("fileSaveState", "Uploading...", "pending");
    setStatus("Uploading document...");
    const upload = document.getElementById("documentUpload").files[0];
    const docId = id();
    const fileNameValue = fileName.value || upload?.name || "document";
    let storagePath = `${workspaceId()}/${docId}/${fileNameValue.replace(/[^\w.\- ]+/g, "_")}`;
    let extractedText = "";
    let extractionStatus = "pending";

    if(upload){
      storagePath = await uploadDocumentToStorage(upload, docId);
      extractedText = await extractFileText(upload);
      extractionStatus = extractedText ? "complete" : "not_supported";
    } else {
      storagePath = fileNameValue;
      extractionStatus = "not_supported";
    }

    await saveDocumentMetadata({
      docId,
      fileNameValue,
      fileTypeValue:fileType.value,
      storagePath,
      extractedText,
      extractionStatus,
      links:{
        buildingId:fileBuilding.value,
        spaceId:fileSpace.value,
        assetId:fileAsset.value,
        projectId:fileProject.value,
        workOrderId:fileWorkOrder.value,
        vehicleId:fileVehicle.value,
        vendorId:fileBid.value,
        fuelReceiptId:fileFuelReceipt.value,
        budgetItemId:fileBudgetItem.value
      },
      notes:fileNotes.value
    });

    if(extractedText){
      await createImportReview("document", typeToImportTarget(fileType.value), { file_name:fileNameValue, extracted_text:extractedText }, `Review extracted ${fileType.value} from ${fileNameValue}`, docId);
    }

    e.target.reset();
    setInlineState("fileSaveState", "Saved", "saved");
    setStatus("Document saved");
    await loadWorkspaceData();
  }catch(err){
    setInlineState("fileSaveState", `Upload failed: ${err.message}`, "failed");
    handleWriteError(err);
  }
}



function typeToImportTarget(type){
  if(type === "Fuel Receipt") return "fuel_receipt";
  if(["Contract","Bid","Estimate","Invoice"].includes(type)) return "budget_item";
  if(type === "Inspection") return "work_order";
  return "work_order";
}



function renderFiles(){
  const files = activeItems("files");
  document.getElementById("fileList").innerHTML = files.length ? files.map(f => {
    const building = app.buildings.find(b => b.id === f.relatedBuildingId);
    const asset = app.assets.find(a => a.id === f.relatedAssetId);
    const project = app.projects.find(p => p.id === f.relatedProjectId);
    const workOrder = app.tasks.find(t => t.id === f.relatedWorkItemId);
    const vehicle = app.vehicles.find(v => v.id === f.relatedVehicleId);
    const vendor = app.vendors.find(v => v.id === f.relatedVendorId);
    const budgetItem = app.budgetItems.find(b => b.id === f.relatedBudgetItemId);
    const linkedLines = [building ? `Building: ${building.name}` : "", asset ? `Asset: ${asset.name}` : "", project ? `Project: ${project.name}` : "", workOrder ? `Work order: ${workOrder.workOrderNumber || workOrder.name}` : "", vehicle ? `Vehicle: ${vehicle.name}` : "", vendor ? `Vendor: ${vendor.name}` : "", budgetItem ? `Budget: ${budgetItem.label}` : ""];
    return documentPreviewCard({ ...f, notes:compact([...linkedLines, f.notes]).join("\n") }) + rowActions("files", f);
  }).join("") : empty("No documents linked yet.");
  renderLinkedDocumentPanels();
}



function renderLinkedDocumentPanels(){
  const configs = [
    ["buildingList", "buildings", f => f.relatedBuildingId, "buildings"],
    ["spaceList", "spaces", f => f.relatedSpaceId, "spaces"],
    ["assetList", "assets", f => f.relatedAssetId, "assets"],
    ["projectList", "projects", f => f.relatedProjectId, "projects"],
    ["vehicleList", "vehicles", f => f.relatedVehicleId, "vehicles"],
    ["vendorList", "vendors", f => f.relatedVendorId, "vendors"],
    ["fuelReceiptList", "fuelReceipts", f => f.relatedFuelReceiptId, "fuelReceipts"],
    ["budgetList", "budgetItems", f => f.relatedBudgetItemId, "budgetItems"]
  ];
  configs.forEach(([containerId, section, getDocumentLink]) => {
    const container = document.getElementById(containerId);
    if(!container || !activeItems(section).length) return;
    container.querySelectorAll("[data-linked-docs-for]").forEach(el => el.remove());
    activeItems(section).forEach(item => {
      const docs = activeItems("files").filter(file => getDocumentLink(file) === item.id);
      if(!docs.length) return;
      const itemIndex = activeItems(section).indexOf(item);
      const block = document.createElement("div");
      block.className = "linked-doc-strip";
      block.dataset.linkedDocsFor = item.id;
      block.innerHTML = `<strong>Linked documents</strong>${docs.map(doc => `<span>${esc(doc.fileName)}</span>`).join("")}`;
      const cards = container.querySelectorAll(".card");
      cards[itemIndex]?.insertAdjacentElement("afterend", block);
    });
  });
}



  Object.assign(window.FieldOps.Views, {
    saveDocumentMetadata,
    uploadDocumentToStorage,
    addFileRecord,
    typeToImportTarget,
    renderFiles,
    renderLinkedDocumentPanels
  });
  Object.assign(globalThis, {
    saveDocumentMetadata,
    uploadDocumentToStorage,
    addFileRecord,
    typeToImportTarget,
    renderFiles,
    renderLinkedDocumentPanels
  });
})();
