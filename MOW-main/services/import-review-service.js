(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Services = window.FieldOps.Services || {};

  const Mappers = window.FieldOps.Services.mappers;

  function normalizeProposedType(type){
    const map = {
      tasks:"work_order",
      workOrders:"work_order",
      bids:"budget_item",
      budgetItems:"budget_item",
      budget_item:"budget_item",
      vendors:"vendor",
      assets:"asset",
      vehicles:"vehicle",
      projects:"project",
      fuelReceipts:"fuel_receipt",
      bid:"budget_item",
      project:"project",
      fuelReceipt:"fuel_receipt",
      note:"work_order"
    };
    return map[type] || type || "work_order";
  }

  function validateImportData(type, data, context = {}){
    const recordType = normalizeProposedType(type);
    if(!data || typeof data !== "object") throw new Error("Review data is missing.");
    if(recordType === "fuel_receipt" && !data.vehicle_id && !context.app?.vehicles?.length){
      throw new Error("Create a vehicle before approving fuel receipt imports.");
    }
    return recordType;
  }

  function documentLinkPayloadForRecord(created){
    const linkFields = {
      field_ops_work_orders:"work_order_id",
      field_ops_projects:"project_id",
      field_ops_vendors:"vendor_id",
      field_ops_vehicles:"vehicle_id",
      field_ops_assets:"asset_id",
      field_ops_fuel_receipts:"fuel_receipt_id",
      field_ops_budget_items:"budget_item_id"
    };
    const field = linkFields[created?.table];
    return field ? { [field]: created.id } : {};
  }

  async function ensureVendor(name, context){
    const vendorName = (name || "").trim() || "Imported vendor";
    const existing = context.app.vendors.find(v => v.name.toLowerCase() === vendorName.toLowerCase());
    if(existing) return existing;
    const data = await context.insertRecord("field_ops_vendors", { id:context.id(), ...Mappers.vendorCreationPayload(vendorName) });
    return Mappers.fromVendor(data);
  }

  async function createRecordFromImport(type, data, context){
    const recordType = validateImportData(type, data, context);
    if(recordType === "project"){
      const row = await context.insertRecord("field_ops_projects", Mappers.projectPayloadFromImport(data));
      return { table:"field_ops_projects", id:row.id };
    }
    if(recordType === "vehicle"){
      const row = await context.insertRecord("field_ops_vehicles", Mappers.vehiclePayloadFromImport(data));
      return { table:"field_ops_vehicles", id:row.id };
    }
    if(recordType === "fuel_receipt"){
      const vehicle = data.vehicle_id ? { id:data.vehicle_id } : context.app.vehicles[0];
      const row = await context.insertRecord("field_ops_fuel_receipts", Mappers.fuelReceiptPayloadFromImport(data, vehicle.id));
      return { table:"field_ops_fuel_receipts", id:row.id };
    }
    if(recordType === "budget_item"){
      const vendor = await ensureVendor(data.vendor || data.company || "Imported vendor", context);
      const row = await context.insertRecord("field_ops_budget_items", Mappers.budgetItemPayloadFromImport(data, vendor.id));
      return { table:"field_ops_budget_items", id:row.id };
    }
    if(recordType === "vendor"){
      const row = await context.insertRecord("field_ops_vendors", Mappers.vendorPayloadFromImport(data));
      return { table:"field_ops_vendors", id:row.id };
    }
    if(recordType === "asset"){
      const row = await context.insertRecord("field_ops_assets", Mappers.assetPayloadFromImport(data));
      return { table:"field_ops_assets", id:row.id };
    }
    const row = await context.insertRecord("field_ops_work_orders", Mappers.workOrderPayloadFromImport(data));
    return { table:"field_ops_work_orders", id:row.id };
  }

  async function createImportReview({ source, proposedType, proposedData, notes, documentId }, context){
    return context.insertRecord("field_ops_import_reviews", Mappers.importReviewPayload({
      source,
      proposedType,
      proposedData,
      notes,
      documentId,
      normalizeType:normalizeProposedType
    }));
  }

  async function attachDocumentToRecord(documentId, created, context){
    if(!documentId) return;
    const payload = documentLinkPayloadForRecord(created);
    if(Object.keys(payload).length){
      await context.updateRecord("field_ops_documents", documentId, payload);
    }
  }

  async function approveReview({ reviewId, review, type, data, documentId, reviewerId }, context){
    const normalizedData = data || {};
    if(reviewId){
      await context.updateRecord("field_ops_import_reviews", reviewId, { proposed_data:normalizedData });
    }
    const created = await createRecordFromImport(type || review?.importTarget || "work_order", normalizedData, context);
    await attachDocumentToRecord(documentId || review?.documentId, created, context);
    if(reviewId){
      await context.updateRecord("field_ops_import_reviews", reviewId, {
        status:"approved",
        reviewed_by:reviewerId,
        reviewed_at:new Date().toISOString(),
        created_record_table:created.table,
        created_record_id:created.id
      });
    }
    return created;
  }

  async function archiveReview(reviewId, context){
    return context.archiveRecord("field_ops_import_reviews", reviewId);
  }

  const ImportReviewService = {
    normalizeProposedType,
    validateImportData,
    documentLinkPayloadForRecord,
    ensureVendor,
    createRecordFromImport,
    createImportReview,
    attachDocumentToRecord,
    approveReview,
    archiveReview
  };

  window.FieldOps.Services.importReview = ImportReviewService;
  Object.assign(globalThis, { normalizeProposedType });
})();
