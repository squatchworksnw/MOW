(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Services = window.FieldOps.Services || {};

  const ImportReviewService = window.FieldOps.Services.importReview;

  function normalizeNumber(value){
    return value === "" || value === null || value === undefined ? null : Number(value);
  }

  function parseMaterialLines(text){
    return String(text || "")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split("|").map(part => part.trim());
        const description = parts[0] || "Material item";
        const quantity = normalizeNumber(parts[1]) || 1;
        const unit = parts[2] || "each";
        const estimatedUnitCost = normalizeNumber(parts[3]) || 0;
        const actualCost = normalizeNumber(parts[4]);
        return {
          description,
          quantity,
          unit,
          estimated_unit_cost: estimatedUnitCost,
          estimated_total: quantity * estimatedUnitCost,
          actual_cost: actualCost,
          approval_status: "needs_review"
        };
      });
  }

  function materialListTotal(lineItems){
    return lineItems.reduce((sum, item) => sum + Number(item.estimated_total || 0), 0);
  }

  function materialReviewData(form){
    const lineItems = parseMaterialLines(form.lines);
    return {
      title: form.title || "Material takeoff",
      project_id: form.projectId || null,
      work_order_id: form.workOrderId || null,
      vendor_id: form.vendorId || null,
      document_id: form.documentId || null,
      approval_status: "needs_review",
      line_items: lineItems,
      estimated_total: materialListTotal(lineItems),
      notes: form.notes || null
    };
  }

  function isMaterialReview(review){
    return review?.importTarget === "materials" ||
      review?.importTarget === "takeoff" ||
      Array.isArray(review?.importedRecord?.line_items);
  }

  function materialBudgetPayload(review){
    const data = review.importedRecord || {};
    const lines = Array.isArray(data.line_items) ? data.line_items : [];
    const lineSummary = lines.map(item => {
      const qty = item.quantity || 1;
      const unit = item.unit || "each";
      const cost = Number(item.estimated_unit_cost || 0).toFixed(2);
      return `${item.description || "Material"} - ${qty} ${unit} @ $${cost}`;
    }).join("\n");
    return {
      project_id:data.project_id || null,
      work_order_id:data.work_order_id || null,
      vendor_id:data.vendor_id || null,
      label:data.title || "Material takeoff",
      item_type:"estimate",
      status:"approved",
      amount:Number(data.estimated_total || materialListTotal(lines) || 0),
      date_received:new Date().toISOString().slice(0,10),
      notes:[data.notes, lineSummary].filter(Boolean).join("\n\n") || null
    };
  }

  async function submitMaterialList(form, context){
    const proposedData = materialReviewData(form);
    if(!proposedData.line_items.length){
      throw new Error("Add at least one material line before submitting.");
    }
    return ImportReviewService.createImportReview({
      source:form.source || "materials",
      proposedType:"materials",
      proposedData,
      notes:`Review material list: ${proposedData.title}`,
      documentId:form.documentId || null
    }, context);
  }

  async function approveMaterialReview(review, context){
    const budget = await context.insertRecord("field_ops_budget_items", materialBudgetPayload(review));
    const data = review.importedRecord || {};
    if(data.document_id){
      await context.updateRecord("field_ops_documents", data.document_id, { budget_item_id:budget.id });
    }
    await context.updateRecord("field_ops_import_reviews", review.id, {
      status:"approved",
      reviewed_by:context.currentUserId(),
      reviewed_at:new Date().toISOString(),
      created_record_table:"field_ops_budget_items",
      created_record_id:budget.id,
      proposed_data:{ ...data, approval_status:"approved", budget_item_id:budget.id }
    });
    return budget;
  }

  window.FieldOps.Services.materials = {
    parseMaterialLines,
    materialListTotal,
    materialReviewData,
    isMaterialReview,
    materialBudgetPayload,
    submitMaterialList,
    approveMaterialReview
  };
})();
