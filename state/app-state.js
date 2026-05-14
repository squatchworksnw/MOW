(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.State = window.FieldOps.State || {};

  function createEmptyAppState(){
    return {
      buildings: [],
      spaces: [],
      assets: [],
      projects: [],
      vendors: [],
      bids: [],
      budgetItems: [],
      tasks: [],
      archivedTasks: [],
      vehicles: [],
      fuelReceipts: [],
      materials: [],
      takeoffs: [],
      materialLineItems: [],
      purchaseRequests: [],
      files: [],
      submissions: [],
      vehicleAlerts: [],
      settings: {
        workspaceName: "Field Operations Command Center",
        workspaceNote: "Secure facilities and contracting operations"
      }
    };
  }

  function createEmptyStagedImport(){
    return { rows: [], source: "", documentId: null, headers: [], suggestedType: "work_order" };
  }

  function createRuntimeState(options = {}){
    return {
      app: createEmptyAppState(),
      currentSession: null,
      currentWorkspace: null,
      refreshTimer: null,
      currentEdit: { section: "", index: -1 },
      pendingWrites: options.pendingWrites || [],
      stagedImport: createEmptyStagedImport(),
      viewHistory: [],
      activeViewId: "dashboard",
      selectedWorkOrderId: "",
      selectedReviewId: "",
      filters: {},
      syncStatus: "Sign in to use Supabase"
    };
  }

  function bindRuntimeGlobals(runtime){
    const keys = [
      "currentSession",
      "currentWorkspace",
      "refreshTimer",
      "currentEdit",
      "pendingWrites",
      "stagedImport",
      "viewHistory",
      "activeViewId",
      "selectedWorkOrderId",
      "selectedReviewId"
    ];
    keys.forEach(key => {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        get(){ return runtime[key]; },
        set(value){ runtime[key] = value; }
      });
    });
    globalThis.app = runtime.app;
    return runtime;
  }

  function activeItems(app, section){
    return (app[section] || []).filter(item => !item.archivedAt);
  }

  function resetRuntimeApp(runtime){
    const fresh = createEmptyAppState();
    Object.keys(runtime.app).forEach(key => delete runtime.app[key]);
    Object.assign(runtime.app, fresh);
  }

  function setLoadedCollections(app, collections){
    Object.assign(app, collections);
  }

  function setCurrentEdit(runtime, section = "", index = -1){
    runtime.currentEdit = { section, index };
  }

  function resetStagedImport(runtime){
    runtime.stagedImport = createEmptyStagedImport();
    return runtime.stagedImport;
  }

  function setStagedImport(runtime, stagedImport){
    runtime.stagedImport = { ...createEmptyStagedImport(), ...stagedImport };
    return runtime.stagedImport;
  }

  function pushViewHistory(runtime, viewId, limit = 25){
    runtime.viewHistory.push(viewId);
    if(runtime.viewHistory.length > limit) runtime.viewHistory = runtime.viewHistory.slice(-limit);
  }

  function popViewHistory(runtime){
    return runtime.viewHistory.pop();
  }

  window.FieldOps.State = {
    createEmptyAppState,
    createEmptyStagedImport,
    createRuntimeState,
    bindRuntimeGlobals,
    activeItems,
    resetRuntimeApp,
    setLoadedCollections,
    setCurrentEdit,
    resetStagedImport,
    setStagedImport,
    pushViewHistory,
    popViewHistory
  };
})();
