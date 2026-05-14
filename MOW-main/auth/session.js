(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Auth = window.FieldOps.Auth || {};

  function getSession(supabaseClient){
    return supabaseClient.auth.getSession();
  }

  function onAuthStateChange(supabaseClient, handler){
    return supabaseClient.auth.onAuthStateChange(handler);
  }

  function signInWithEmail(supabaseClient, email, redirectTo){
    return supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });
  }

  function signOut(supabaseClient){
    return supabaseClient.auth.signOut();
  }

  function loadFirstWorkspace(supabaseClient){
    return supabaseClient
      .from("field_ops_my_workspaces")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
  }

  window.FieldOps.Auth.session = { getSession, onAuthStateChange, signInWithEmail, signOut, loadFirstWorkspace };
})();
