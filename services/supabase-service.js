(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Services = window.FieldOps.Services || {};

  const SUPABASE_URL = "https://vkjbmqpdrixjjjrrnbza.supabase.co";
  const SUPABASE_KEY = "sb_publishable_KzQmH4z479_6X0aCQMomgA_GNbCnkBA";
  const DOCUMENT_BUCKET = "documents";
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  function selectActive(workspaceId, table){
    return supabaseClient
      .from(table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
  }

  function selectArchived(workspaceId, table){
    return supabaseClient
      .from(table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false });
  }

  function insertRow(table, payload){
    return supabaseClient
      .from(table)
      .insert(payload)
      .select()
      .single();
  }

  function selectVehicleAlerts(workspaceId){
    return supabaseClient.from("field_ops_vehicle_alerts").select("*").eq("workspace_id", workspaceId);
  }

  function updateRow(table, idValue, payload, workspaceId){
    let query = supabaseClient
      .from(table)
      .update(payload)
      .eq("id", idValue);

    if(table !== "field_ops_workspaces"){
      query = query.eq("workspace_id", workspaceId);
    }

    return query.select().single();
  }

  function archiveRow(table, idValue, workspaceId, archivedAt, archivedBy){
    return supabaseClient
      .from(table)
      .update({ archived_at: archivedAt, archived_by: archivedBy })
      .eq("id", idValue)
      .eq("workspace_id", workspaceId);
  }

  function restoreRow(table, idValue, workspaceId){
    return supabaseClient
      .from(table)
      .update({ archived_at: null, archived_by: null })
      .eq("id", idValue)
      .eq("workspace_id", workspaceId);
  }

  function insertDocumentMetadata(payload){
    return supabaseClient.from("field_ops_documents").insert(payload);
  }

  function uploadDocument(storagePath, file){
    return supabaseClient.storage.from(DOCUMENT_BUCKET).upload(storagePath, file, { upsert:false });
  }

  window.FieldOps.Services.supabase = {
    SUPABASE_URL,
    SUPABASE_KEY,
    DOCUMENT_BUCKET,
    supabaseClient,
    selectActive,
    selectArchived,
    selectVehicleAlerts,
    insertRow,
    updateRow,
    archiveRow,
    restoreRow,
    insertDocumentMetadata,
    uploadDocument
  };
})();
