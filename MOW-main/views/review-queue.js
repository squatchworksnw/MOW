(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};
  const Mappers = window.FieldOps.Services.mappers;
  const ImportReviewService = window.FieldOps.Services.importReview;
  function interactions(){ return window.FieldOps.Services.interactions || { droppedReviewFile:null, showToast(){}}; }

function importReviewContext(){
  return { app, insertRecord, updateRecord, archiveRecord, id };
}

function renderReviewQueue(){
  const reviews = activeItems("submissions");
  document.getElementById("submissionList").innerHTML = reviews.length ? reviews.map(item => {
    const actions = item.status === "Needs Review" && canManageOperations() ? `<div class="actions no-print"><button type="button" onclick="openReviewDetail('${item.id}')">Open Review</button><button class="ghost" type="button" onclick="archiveSubmissionById('${item.id}')">Reject / Archive</button></div>` : "";
    return card(item.description || "Review item", [item.importedRecord?.file_name, item.documentId ? `Document attached: ${item.documentId}` : "", item.convertedRecordId ? `Converted: ${item.convertedRecordId}` : ""], [item.category, item.status, item.source], tone(item.status)) + actions;
  }).join("") : empty(canSubmitOnly() ? "No submitted requests yet." : "No import reviews waiting.");
}



async function addSubmission(e){
  e.preventDefault();
  try{
    if(!requireInsertPermission("field_ops_import_reviews", "submit requests")) return;
    setInlineState("submissionSaveState", "Sending request...", "pending");
    const upload = interactions().droppedReviewFile || document.getElementById("submissionUpload")?.files?.[0];
    let documentId = null;
    if(upload){
      documentId = id();
      const storagePath = await uploadDocumentToStorage(upload, documentId);
      const extractedText = await extractFileText(upload);
      await saveDocumentMetadata({
        docId: documentId,
        fileNameValue: upload.name,
        fileTypeValue: fileTypeFromName(upload.name),
        storagePath,
        extractedText,
        extractionStatus: extractedText ? "complete" : "not_supported",
        notes: `Submitted with request: ${submissionDescription.value}`
      });
    }
    await createImportReview(submissionSource.value, "work_order", Mappers.submitterWorkOrderReviewData({ description:submissionDescription.value, urgency:submissionUrgency.value, location:submissionLocation.value, category:submissionCategory.value, name:submissionName.value, contact:submissionContact.value, documentId }), submissionDescription.value, documentId);
    e.target.reset();
    interactions().droppedReviewFile = null;
    const preview = document.getElementById("reviewUploadPreview");
    if(preview) preview.innerHTML = "";
    setInlineState("submissionSaveState", upload ? "Request and file sent for review" : "Request sent for review", "saved");
    interactions().showToast(upload ? "Request and file sent for review" : "Request sent for review", "saved");
    await loadWorkspaceData();
  }catch(err){
    setInlineState("submissionSaveState", `Could not send: ${err.message}`, "failed");
    handleWriteError(err);
  }
}



function fileTypeFromName(name){
  const lower = String(name || "").toLowerCase();
  if(lower.endsWith(".pdf")) return "PDF";
  if(lower.endsWith(".csv")) return "CSV";
  if(lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "Excel";
  if(lower.match(/\.(png|jpg|jpeg|gif|webp|heic)$/)) return "Photo";
  return "Other";
}



async function createImportReview(source, proposedType, proposedData, notes, documentId = null){
  return ImportReviewService.createImportReview({ source, proposedType, proposedData, notes, documentId }, importReviewContext());
}



function openReviewDetail(reviewId){
  if(!requireOperationsPermission("review submitted requests")) return;
  selectedReviewId = reviewId;
  renderImportReviewDetail();
  showView("reviewDetail");
}



function selectedReview(){
  return app.submissions.find(s => s.id === selectedReviewId);
}



function renderImportReviewDetail(){
  const title = document.getElementById("reviewDetailTitle");
  const meta = document.getElementById("reviewDetailMeta");
  const form = document.getElementById("reviewDetailForm");
  if(!title || !meta || !form) return;
  const review = selectedReview();
  if(!review){
    title.textContent = "Review Submission";
    meta.textContent = "Choose a submitted item from Import Review.";
    form.innerHTML = empty("No submitted item selected.");
    return;
  }
  const data = review.importedRecord || {};
  title.textContent = data.title || data.name || "Review Submission";
  meta.textContent = compact([review.source, review.status, review.documentId ? "Document attached" : "No document"]).join(" | ");
  form.innerHTML = `
    <div class="form-grid">
      <label class="full">Work order title<input name="title" required value="${esc(data.title || data.name || review.description || "")}" /></label>
      <label>Status<select name="status"><option value="open">Open</option><option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option><option value="waiting">Waiting</option></select></label>
      <label>Priority<select name="priority"><option value="normal" ${data.priority === "normal" ? "selected" : ""}>Normal</option><option value="high" ${data.priority === "high" ? "selected" : ""}>High</option><option value="urgent" ${data.priority === "urgent" ? "selected" : ""}>Urgent</option><option value="low" ${data.priority === "low" ? "selected" : ""}>Low</option></select></label>
      <label>Due date<input name="due_date" type="date" value="${esc(data.due_date || data.date || "")}" /></label>
      ${fieldHtml("project_id","Project","projectSelect",data.project_id || "")}
      ${fieldHtml("building_id","Building","buildingSelect",data.building_id || "")}
      ${fieldHtml("space_id","Space / Room","spaceSelect",data.space_id || "")}
      ${fieldHtml("asset_id","Asset","assetSelect",data.asset_id || "")}
      ${fieldHtml("vehicle_id","Vehicle","vehicleSelect",data.vehicle_id || "")}
      ${fieldHtml("vendor_id","Vendor","vendorSelect",data.vendor_id || "")}
      <label class="full">Location / description<textarea name="description">${esc(data.description || data.location || "")}</textarea></label>
      <label class="full">Notes / history<textarea name="notes">${esc(data.notes || data.extracted_text || review.description || "")}</textarea></label>
    </div>
  `;
  const approveBtn = document.getElementById("reviewApproveBtn");
  const rejectBtn = document.getElementById("reviewRejectBtn");
  if(approveBtn) approveBtn.onclick = () => approveReviewDetail();
  if(rejectBtn) rejectBtn.onclick = () => archiveSubmissionById(review.id);
}



function reviewWorkOrderPayload(){
  const form = document.getElementById("reviewDetailForm");
  const formData = new FormData(form);
  return Mappers.reviewWorkOrderPayloadFromForm(formData);
}



async function approveReviewDetail(){
  const review = selectedReview();
  if(!review || !requireOperationsPermission("approve submitted requests")) return;
  try{
    const payload = reviewWorkOrderPayload();
    const created = await ImportReviewService.approveReview({ reviewId:review.id, review, type:"work_order", data:payload, documentId:review.documentId, reviewerId:currentSession.user.id }, importReviewContext());
    selectedWorkOrderId = created.id;
    await loadWorkspaceData();
    showView("workOrderDetail");
  }catch(err){ handleWriteError(err); }
}



async function archiveSubmissionById(reviewId){
  try{ await ImportReviewService.archiveReview(reviewId, importReviewContext()); }
  catch(err){ handleWriteError(err); }
}

  Object.assign(window.FieldOps.Views, {
    renderReviewQueue,
    addSubmission,
    fileTypeFromName,
    createImportReview,
    openReviewDetail,
    selectedReview,
    renderImportReviewDetail,
    reviewWorkOrderPayload,
    approveReviewDetail,
    archiveSubmissionById
  });
  Object.assign(globalThis, {
    renderReviewQueue,
    addSubmission,
    fileTypeFromName,
    createImportReview,
    openReviewDetail,
    selectedReview,
    renderImportReviewDetail,
    reviewWorkOrderPayload,
    approveReviewDetail,
    archiveSubmissionById
  });
})();
