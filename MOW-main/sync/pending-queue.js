(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Sync = window.FieldOps.Sync || {};

  const WRITE_QUEUE_KEY = "field_ops_pending_write_queue_v1";

  function loadPendingWrites(){
    try{
      const raw = localStorage.getItem(WRITE_QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    }catch(_err){
      return [];
    }
  }

  function savePendingWrites(pendingWrites){
    localStorage.setItem(WRITE_QUEUE_KEY, JSON.stringify(pendingWrites));
  }

  function isRetryableWriteError(err){
    const message = String(err?.message || "").toLowerCase();
    return !navigator.onLine ||
      message.includes("failed to fetch") ||
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("load failed");
  }

  async function applyQueuedWrite(item, api){
    if(!item) return;
    if(item.action === "insert"){
      const { error } = await api.insertRow(item.table, { workspace_id:item.workspaceId, ...item.payload });
      if(error) throw error;
      return;
    }
    if(item.action === "update"){
      const { error } = await api.updateRow(item.table, item.recordId, item.payload, item.workspaceId);
      if(error) throw error;
      return;
    }
    if(item.action === "archive"){
      const { error } = await api.archiveRow(item.table, item.recordId, item.workspaceId, item.archivedAt, item.archivedBy);
      if(error) throw error;
    }
  }

  window.FieldOps.Sync.pendingQueue = { WRITE_QUEUE_KEY, loadPendingWrites, savePendingWrites, isRetryableWriteError, applyQueuedWrite };
})();
