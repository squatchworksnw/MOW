(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Services = window.FieldOps.Services || {};

  const PendingQueue = window.FieldOps.Sync.pendingQueue;

  function loadPendingWrites(){
    return PendingQueue.loadPendingWrites();
  }

  function savePendingWrites(ctx){
    PendingQueue.savePendingWrites(ctx.getPendingWrites());
    renderPendingQueueState(ctx);
  }

  function renderPendingQueueState(ctx){
    const pendingWrites = ctx.getPendingWrites();
    const pendingQueueCount = document.getElementById("pendingQueueCount");
    if(pendingQueueCount) pendingQueueCount.textContent = String(pendingWrites.length);
    const pendingQueueDetails = document.getElementById("pendingQueueDetails");
    if(pendingQueueDetails){
      pendingQueueDetails.innerHTML = pendingWrites.length ? pendingWrites.map(item => ctx.card(
        `${ctx.titleize(item.action)} pending`,
        [ctx.titleize(String(item.table || "").replace("field_ops_","")), item.lastError ? `Last error: ${item.lastError}` : "", `Attempts: ${item.attempts || 0}`],
        [item.createdAt],
        item.lastError ? "warning" : ""
      )).join("") : "";
    }
  }

  function setStatus(text, ctx){
    const syncStatusText = document.getElementById("syncStatusText");
    const settingsSyncStatus = document.getElementById("settingsSyncStatus");
    const dot = document.getElementById("syncDot");
    if(syncStatusText) syncStatusText.textContent = text;
    if(settingsSyncStatus) settingsSyncStatus.textContent = text;
    if(dot){
      const normalized = text.toLowerCase();
      dot.style.background = normalized.includes("failed") || normalized.includes("error") ? "var(--danger)" :
        normalized.includes("saving") || normalized.includes("loading") || normalized.includes("pending") || normalized.includes("offline") || normalized.includes("sign in") || normalized.includes("check your email") ? "var(--warning)" :
        "var(--ok)";
    }
    renderPendingQueueState(ctx);
  }

  function queueWrite(operation, ctx){
    const pendingWrites = ctx.getPendingWrites();
    const queued = {
      id: ctx.id(),
      workspaceId: ctx.workspaceId(),
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: "",
      ...operation
    };
    pendingWrites.push(queued);
    ctx.setPendingWrites(pendingWrites);
    savePendingWrites(ctx);
    setStatus(`${pendingWrites.length} pending retry${pendingWrites.length === 1 ? "" : "s"}`, ctx);
    return queued;
  }

  async function applyQueuedWrite(item, ctx){
    if(!item || item.workspaceId !== ctx.workspaceId()) return;
    return PendingQueue.applyQueuedWrite(item, {
      insertRow:ctx.insertRow,
      updateRow:ctx.updateRow,
      archiveRow:ctx.archiveRow
    });
  }

  async function flushPendingWrites(showAlert, ctx){
    const pendingWrites = ctx.getPendingWrites();
    if(!pendingWrites.length){
      renderPendingQueueState(ctx);
      if(showAlert) alert("No pending writes to retry.");
      return;
    }
    if(!ctx.requireAuth(showAlert)) return;
    if(!navigator.onLine){
      setStatus(`${pendingWrites.length} pending - offline`, ctx);
      if(showAlert) alert("This device is offline. Pending writes will retry when connection returns.");
      return;
    }

    setStatus(`Retrying ${pendingWrites.length} pending write${pendingWrites.length === 1 ? "" : "s"}...`, ctx);
    const remaining = [];
    for(const item of pendingWrites){
      try{
        await applyQueuedWrite(item, ctx);
      }catch(err){
        item.attempts = Number(item.attempts || 0) + 1;
        item.lastError = err.message || "Retry failed";
        remaining.push(item);
      }
    }
    ctx.setPendingWrites(remaining);
    savePendingWrites(ctx);
    await ctx.loadWorkspaceData();
    setStatus(remaining.length ? `${remaining.length} retry failed` : "Pending writes saved", ctx);
    if(showAlert){
      alert(remaining.length ? `${remaining.length} pending write${remaining.length === 1 ? "" : "s"} still need attention.` : "Pending writes were saved to Supabase.");
    }
  }

  window.FieldOps.Services.sync = {
    loadPendingWrites,
    savePendingWrites,
    renderPendingQueueState,
    setStatus,
    queueWrite,
    applyQueuedWrite,
    flushPendingWrites,
    isRetryableWriteError:PendingQueue.isRetryableWriteError
  };
})();
