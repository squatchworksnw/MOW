(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Services = window.FieldOps.Services || {};

  function todayString(){ return new Date().toISOString().slice(0,10); }
  function snake(value){ return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""); }
  function normalizeDate(value){ return value || null; }
  function normalizeNumber(value){ return value === "" || value === null || value === undefined ? null : Number(value); }
  function titleizeValue(value){
    if(window.FieldOps.Components?.titleize) return window.FieldOps.Components.titleize(value);
    return String(value || "").replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function dbStatus(value, fallback = "active"){
    const map = {
      "Planning":"planning",
      "In progress":"in_progress",
      "Waiting on bid":"waiting_on_vendor",
      "Needs approval":"needs_approval",
      "Complete":"complete",
      "Open":"open",
      "Received":"submitted",
      "Needs review":"draft",
      "Recommended":"submitted",
      "Approved":"approved",
      "Rejected":"rejected",
      "Active":"active",
      "Due for service":"due_for_service",
      "Overdue for service":"overdue_for_service",
      "In maintenance":"in_maintenance",
      "Out of service":"out_of_service"
    };
    return map[value] || snake(value) || fallback;
  }

  function dbPriority(value){
    return { Normal:"normal", High:"high", Urgent:"urgent", Low:"low" }[value] || snake(value) || "normal";
  }

  function fromBuilding(row){ return { id:row.id, name:row.name, code:row.code, address:row.address, status:row.status, notes:row.notes, archivedAt:row.archived_at, updatedAt:row.updated_at }; }
  function fromSpace(row){ return { id:row.id, buildingId:row.building_id, name:row.name, spaceType:row.space_type, floor:row.floor, status:row.status, notes:row.notes, archivedAt:row.archived_at, updatedAt:row.updated_at }; }
  function fromAsset(row){ return { id:row.id, buildingId:row.building_id, spaceId:row.space_id, name:row.name, assetTag:row.asset_tag, category:row.category, status:row.status, notes:row.notes, archivedAt:row.archived_at, updatedAt:row.updated_at }; }
  function fromProject(row){ return { id:row.id, buildingId:row.building_id, name:row.name, status:row.status, priority:row.priority, date:row.target_date, cost:row.estimated_cost, budget:row.approved_budget, owner:"", summary:row.summary, notes:row.notes, archivedAt:row.archived_at, updatedAt:row.updated_at }; }
  function fromVendor(row){ return { id:row.id, name:row.name, vendorType:row.vendor_type, contactName:row.contact_name, phone:row.phone, email:row.email, status:row.status, insuranceExpiresOn:row.insurance_expires_on, notes:row.notes, archivedAt:row.archived_at, updatedAt:row.updated_at }; }
  function fromBudgetItem(row){ return { id:row.id, projectId:row.project_id, workOrderId:row.work_order_id, vendorId:row.vendor_id, fuelReceiptId:row.fuel_receipt_id, label:row.label, itemType:row.item_type, status:row.status, amount:row.amount, date:row.date_received, notes:row.notes, archivedAt:row.archived_at, updatedAt:row.updated_at }; }
  function fromBudgetBid(row, vendors = []){
    const vendor = vendors.find(v => v.id === row.vendor_id);
    return { id:row.id, projectId:row.project_id, vendorId:row.vendor_id, vendor:vendor?.name || row.label, amount:row.amount, status:row.status, date:row.date_received, followupDate:"", recommended:row.status === "approved" ? "Yes" : "No", notes:row.notes, archivedAt:row.archived_at, updatedAt:row.updated_at };
  }
  function fromWorkOrder(row){ return { id:row.id, workOrderNumber:row.work_order_number, name:row.title, type:row.type, status:row.status, priority:row.priority, date:row.due_date, assignedTo:"", projectId:row.project_id, buildingId:row.building_id, spaceId:row.space_id, assetId:row.asset_id, vehicleId:row.vehicle_id, vendorBidId:row.vendor_id, location:row.description || "", notes:row.notes, archivedAt:row.archived_at, updatedAt:row.updated_at }; }
  function fromVehicle(row){ return { id:row.id, name:row.name, vehicleNumber:row.vehicle_number, plate:row.license_plate, vin:row.vin, mileage:row.odometer, status:row.status, lastServiceDate:row.last_service_date, serviceDate:row.next_service_date, registration:row.registration_due_date, warranty:"", notes:row.notes, archivedAt:row.archived_at, updatedAt:row.updated_at }; }
  function fromFuelReceipt(row){ return { id:row.id, vehicleId:row.vehicle_id, vendorId:row.vendor_id, budgetItemId:row.budget_item_id, receiptDocumentId:row.receipt_document_id, date:row.receipt_date, vendor:row.gas_station, gallons:row.gallons, totalAmount:row.total_amount, pricePerGallon:row.price_per_gallon, odometer:row.odometer, notes:row.notes, archivedAt:row.archived_at, updatedAt:row.updated_at }; }
  function fromDocument(row){ return { id:row.id, fileName:row.file_name, fileType:row.file_type, storagePath:row.storage_path, source:row.storage_bucket, previewText:row.extracted_text, extractionStatus:row.extraction_status, relatedBuildingId:row.building_id, relatedSpaceId:row.space_id, relatedAssetId:row.asset_id, relatedProjectId:row.project_id, relatedWorkItemId:row.work_order_id, relatedVendorId:row.vendor_id, relatedVehicleId:row.vehicle_id, relatedFuelReceiptId:row.fuel_receipt_id, relatedBudgetItemId:row.budget_item_id, notes:row.notes, archivedAt:row.archived_at, updatedAt:row.updated_at }; }
  function fromImportReview(row){ return { id:row.id, documentId:row.document_id, submitterName:"Import Review", submitterContact:"", category:titleizeValue(row.proposed_record_type), urgency:"Normal", location:"", description:row.notes || `${titleizeValue(row.proposed_record_type)} review`, source:row.source, status:titleizeValue(row.status), importTarget:row.proposed_record_type, importedRecord:row.proposed_data || {}, convertedRecordId:row.created_record_id, createdRecordTable:row.created_record_table, createdAt:row.created_at, updatedAt:row.updated_at }; }

  function workOrderPayloadFromForm(form){ return { title:form.name, type:form.frequency && form.frequency !== "One-time" ? "maintenance" : "general", status:dbStatus(form.status, "open"), priority:dbPriority(form.priority), due_date:normalizeDate(form.date), project_id:form.projectId || null, building_id:form.buildingId || null, space_id:form.spaceId || null, asset_id:form.assetId || null, vehicle_id:form.vehicleId || null, vendor_id:form.vendorId || null, description:form.location || null, notes:form.notes || null }; }
  function buildingPayloadFromForm(form){ return { name:form.name, code:form.code || null, address:form.address || null, status:form.status, notes:form.notes || null }; }
  function spacePayloadFromForm(form){ return { building_id:form.buildingId || null, name:form.name, space_type:form.spaceType || null, floor:form.floor || null, status:form.status, notes:form.notes || null }; }
  function assetPayloadFromForm(form){ return { building_id:form.buildingId || null, space_id:form.spaceId || null, name:form.name, asset_tag:form.assetTag || null, category:form.category || null, status:form.status, notes:form.notes || null }; }
  function vendorPayloadFromForm(form){ return { name:form.name, vendor_type:form.vendorType || null, contact_name:form.contactName || null, phone:form.phone || null, email:form.email || null, status:form.status, insurance_expires_on:normalizeDate(form.insuranceExpiresOn), notes:form.notes || null }; }
  function projectPayloadFromForm(form){ return { name:form.name, status:dbStatus(form.status, "planning"), priority:dbPriority(form.priority), target_date:normalizeDate(form.date), estimated_cost:normalizeNumber(form.cost), approved_budget:normalizeNumber(form.budget), summary:form.summary || null, notes:form.notes || null }; }
  function budgetItemPayloadFromForm(form){ return { project_id:form.projectId || null, work_order_id:form.workOrderId || null, vendor_id:form.vendorId || null, fuel_receipt_id:form.fuelReceiptId || null, label:form.label, item_type:form.itemType, status:form.status, amount:normalizeNumber(form.amount) || 0, date_received:normalizeDate(form.date), notes:form.notes || null }; }
  function bidPayloadFromForm(form, vendorId){ return { id:form.id, project_id:form.projectId || null, vendor_id:vendorId, label:form.vendor || "Contractor bid", item_type:"bid", status:dbStatus(form.status, "draft"), amount:normalizeNumber(form.amount) || 0, date_received:normalizeDate(form.date), notes:[form.recommended === "Yes" ? "Recommended: yes" : "", form.followupDate ? `Follow-up: ${form.followupDate}` : "", form.file ? `File/link: ${form.file}` : "", form.notes].filter(Boolean).join("\n") || null }; }
  function vehiclePayloadFromForm(form){ return { name:form.name, vehicle_number:form.vehicleNumber || null, license_plate:form.plate || null, vin:form.vin || null, odometer:normalizeNumber(form.mileage), status:dbStatus(form.status, "active"), last_service_date:normalizeDate(form.lastServiceDate), next_service_date:normalizeDate(form.serviceDate), registration_due_date:normalizeDate(form.registration), notes:[form.warranty ? `Warranty/title: ${form.warranty}` : "", form.notes].filter(Boolean).join("\n") || null }; }
  function fuelReceiptPayloadFromForm(form){ return { vehicle_id:form.vehicleId, receipt_date:form.date || todayString(), gas_station:form.vendor || null, gallons:normalizeNumber(form.gallons), total_amount:normalizeNumber(form.totalAmount) || 0, price_per_gallon:normalizeNumber(form.pricePerGallon), odometer:normalizeNumber(form.odometer), notes:[form.file ? `Receipt/link: ${form.file}` : "", form.notes].filter(Boolean).join("\n") || null }; }
  function fuelReceiptBudgetPayload(receipt, vehicle, budgetId){ return { id:budgetId, fuel_receipt_id:receipt.id, label:`Fuel - ${vehicle?.name || receipt.gas_station || receipt.receipt_date}`, item_type:"fuel", status:"submitted", amount:normalizeNumber(receipt.total_amount) || 0, date_received:receipt.receipt_date, notes:receipt.gas_station ? `Gas station/vendor: ${receipt.gas_station}` : null }; }
  function documentMetadataPayload({ docId, workspaceId, fileNameValue, fileTypeValue, storagePath, bucket, extractedText = "", extractionStatus = "not_supported", links = {}, notes = "" }){ return { id:docId, workspace_id:workspaceId, file_name:fileNameValue, file_type:fileTypeValue, storage_bucket:bucket, storage_path:storagePath, extracted_text:extractedText || null, extraction_status:extractionStatus, building_id:links.buildingId || null, space_id:links.spaceId || null, asset_id:links.assetId || null, project_id:links.projectId || null, work_order_id:links.workOrderId || null, vehicle_id:links.vehicleId || null, vendor_id:links.vendorId || null, fuel_receipt_id:links.fuelReceiptId || null, budget_item_id:links.budgetItemId || null, notes:notes || null }; }
  function importReviewPayload({ source, proposedType, proposedData, notes, documentId, normalizeType }){ return { document_id:documentId || null, source:source || "manual", proposed_record_type:normalizeType(proposedType), proposed_data:proposedData || {}, status:"needs_review", notes:notes || null }; }
  function reviewWorkOrderPayloadFromForm(formData){ return { title:formData.get("title") || "Submitted work order", type:"general", status:formData.get("status") || "open", priority:formData.get("priority") || "normal", due_date:normalizeDate(formData.get("due_date")), project_id:formData.get("project_id") || null, building_id:formData.get("building_id") || null, space_id:formData.get("space_id") || null, asset_id:formData.get("asset_id") || null, vehicle_id:formData.get("vehicle_id") || null, vendor_id:formData.get("vendor_id") || null, description:formData.get("description") || null, notes:formData.get("notes") || null }; }
  function submitterWorkOrderReviewData(form){ return { title:form.description.slice(0,90) || "Reviewed work item", priority:dbPriority(form.urgency), description:form.location, notes:`Category: ${form.category}. Submitted by: ${form.name || "Unknown"}. Contact: ${form.contact || "N/A"}. ${form.description}`, document_id:form.documentId || null }; }

  function projectPayloadFromImport(data){ return { name:data.name || data.title || "Imported project", status:"planning", priority:dbPriority(data.priority), summary:data.location || null, notes:data.notes || data.extracted_text || null }; }
  function vehiclePayloadFromImport(data){ return { name:data.name || data.vehicle || "Imported vehicle", license_plate:data.plate || null, odometer:normalizeNumber(data.mileage), status:"active", notes:data.notes || null }; }
  function fuelReceiptPayloadFromImport(data, vehicleId){ return { vehicle_id:data.vehicle_id || vehicleId, receipt_date:data.date || todayString(), gas_station:data.vendor || data.gas_station || null, gallons:normalizeNumber(data.gallons), total_amount:normalizeNumber(data.total_amount || data.amount) || 0, price_per_gallon:normalizeNumber(data.price_per_gallon), odometer:normalizeNumber(data.odometer), notes:data.notes || data.extracted_text || null }; }
  function budgetItemPayloadFromImport(data, vendorId){ return { vendor_id:vendorId, label:data.label || data.title || data.vendor || "Imported estimate", item_type:data.item_type || "bid", status:"draft", amount:normalizeNumber(data.amount) || 0, date_received:data.date || null, notes:data.notes || data.extracted_text || null }; }
  function vendorPayloadFromImport(data){ return { name:data.name || data.vendor || data.company || "Imported vendor", vendor_type:data.vendor_type || data.category || null, contact_name:data.contact || null, phone:data.phone || null, email:data.email || null, status:"active", notes:data.notes || null }; }
  function vendorCreationPayload(name, vendorType = "subcontractor"){ return { name, vendor_type:vendorType, status:"active" }; }
  function assetPayloadFromImport(data){ return { name:data.name || data.asset || data.title || "Imported asset", asset_tag:data.asset_tag || data.tag || null, category:data.category || null, status:"active", notes:data.notes || null }; }
  function workOrderPayloadFromImport(data){ return { title:data.title || data.name || "Imported work order", type:data.type || "general", status:data.status || "open", priority:dbPriority(data.priority), due_date:data.due_date || data.date || null, project_id:data.project_id || null, building_id:data.building_id || null, space_id:data.space_id || null, asset_id:data.asset_id || null, vehicle_id:data.vehicle_id || null, vendor_id:data.vendor_id || null, description:data.description || data.location || null, notes:data.notes || data.extracted_text || null }; }

  function buildingEditPayload(item){ return { name:item.name, code:item.code || null, address:item.address || null, status:item.status, notes:item.notes || null }; }
  function spaceEditPayload(item){ return { building_id:item.buildingId || null, name:item.name, space_type:item.spaceType || null, floor:item.floor || null, status:item.status, notes:item.notes || null }; }
  function assetEditPayload(item){ return { building_id:item.buildingId || null, space_id:item.spaceId || null, name:item.name, asset_tag:item.assetTag || null, category:item.category || null, status:item.status, notes:item.notes || null }; }
  function projectEditPayload(item){ return { name:item.name, status:item.status, priority:item.priority, target_date:item.date || null, estimated_cost:normalizeNumber(item.cost), approved_budget:normalizeNumber(item.budget), summary:item.summary || null, notes:item.notes || null }; }
  function vendorEditPayload(item){ return { name:item.name, vendor_type:item.vendorType || null, contact_name:item.contactName || null, phone:item.phone || null, email:item.email || null, status:item.status, insurance_expires_on:item.insuranceExpiresOn || null, notes:item.notes || null }; }
  function bidEditPayload(item){ return { project_id:item.projectId || null, label:item.vendor || "Contractor bid", item_type:"bid", status:item.status, amount:normalizeNumber(item.amount) || 0, date_received:item.date || null, notes:item.notes || null }; }
  function budgetItemEditPayload(item){ return { label:item.label, item_type:item.itemType, status:item.status, amount:normalizeNumber(item.amount) || 0, date_received:item.date || null, project_id:item.projectId || null, vendor_id:item.vendorId || null, work_order_id:item.workOrderId || null, fuel_receipt_id:item.fuelReceiptId || null, notes:item.notes || null }; }
  function workOrderEditPayload(item){ return { title:item.name, status:item.status, priority:item.priority, due_date:item.date || null, project_id:item.projectId || null, building_id:item.buildingId || null, space_id:item.spaceId || null, asset_id:item.assetId || null, vehicle_id:item.vehicleId || null, vendor_id:item.vendorBidId || null, description:item.location || null, notes:item.notes || null }; }
  function vehicleEditPayload(item){ return { name:item.name, vehicle_number:item.vehicleNumber || null, license_plate:item.plate || null, vin:item.vin || null, odometer:normalizeNumber(item.mileage), status:item.status, last_service_date:item.lastServiceDate || null, next_service_date:item.serviceDate || null, registration_due_date:item.registration || null, notes:item.notes || null }; }
  function fuelReceiptEditPayload(item){ return { vehicle_id:item.vehicleId, receipt_date:item.date || todayString(), gas_station:item.vendor || null, gallons:normalizeNumber(item.gallons), total_amount:normalizeNumber(item.totalAmount) || 0, price_per_gallon:normalizeNumber(item.pricePerGallon), odometer:normalizeNumber(item.odometer), notes:item.notes || null }; }
  function documentEditPayload(item){ return { file_name:item.fileName, file_type:item.fileType || null, building_id:item.relatedBuildingId || null, space_id:item.relatedSpaceId || null, asset_id:item.relatedAssetId || null, project_id:item.relatedProjectId || null, work_order_id:item.relatedWorkItemId || null, vehicle_id:item.relatedVehicleId || null, vendor_id:item.relatedVendorId || null, fuel_receipt_id:item.relatedFuelReceiptId || null, budget_item_id:item.relatedBudgetItemId || null, notes:item.notes || null }; }
  function restorePayload(){ return { archived_at:null, archived_by:null }; }

  const Mappers = {
    todayString, snake, normalizeDate, normalizeNumber, dbStatus, dbPriority,
    fromBuilding, fromSpace, fromAsset, fromProject, fromVendor, fromBudgetItem, fromBudgetBid, fromWorkOrder, fromVehicle, fromFuelReceipt, fromDocument, fromImportReview,
    workOrderPayloadFromForm, buildingPayloadFromForm, spacePayloadFromForm, assetPayloadFromForm, vendorPayloadFromForm, projectPayloadFromForm, budgetItemPayloadFromForm, bidPayloadFromForm, vehiclePayloadFromForm, fuelReceiptPayloadFromForm, fuelReceiptBudgetPayload, documentMetadataPayload, importReviewPayload, reviewWorkOrderPayloadFromForm, submitterWorkOrderReviewData,
    projectPayloadFromImport, vehiclePayloadFromImport, fuelReceiptPayloadFromImport, budgetItemPayloadFromImport, vendorPayloadFromImport, vendorCreationPayload, assetPayloadFromImport, workOrderPayloadFromImport,
    buildingEditPayload, spaceEditPayload, assetEditPayload, projectEditPayload, vendorEditPayload, bidEditPayload, budgetItemEditPayload, workOrderEditPayload, vehicleEditPayload, fuelReceiptEditPayload, documentEditPayload, restorePayload
  };

  window.FieldOps.Services.mappers = Mappers;
  Object.assign(globalThis, Mappers);
})();
