(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Services = window.FieldOps.Services || {};

  const { VIEW_ACCESS, SUBMITTER_INSERT_TABLES } = window.FieldOps.Auth.roles;
  const SessionApi = window.FieldOps.Auth.session;

  function isAuthenticated(state){ return Boolean(state.currentSession?.user); }
  function workspaceId(state){ return state.currentWorkspace?.id || ""; }
  function currentRole(state){ return state.currentWorkspace?.role || ""; }
  function isOwner(state){ return currentRole(state) === "owner"; }
  function canManageOperations(state){ return ["owner","admin"].includes(currentRole(state)); }
  function canSubmitOnly(state){ return currentRole(state) === "submitter"; }

  function allowedViewsForRole(state){
    return new Set(VIEW_ACCESS[currentRole(state)] || VIEW_ACCESS["signed-out"]);
  }

  function defaultViewForRole(state){
    if(canSubmitOnly(state)) return "importReview";
    if(canManageOperations(state)) return "dashboard";
    return "dashboard";
  }

  function canAccessView(id, state){
    if(id === "accessDenied") return true;
    return allowedViewsForRole(state).has(id);
  }

  function renderAuthState(ctx){
    const emailInput = document.getElementById("authEmail");
    const signInButton = document.getElementById("signInBtn");
    const signOutButton = document.getElementById("signOutBtn");
    const emailLabel = document.getElementById("authUserEmail");
    const state = ctx.getState();
    const email = state.currentSession?.user?.email || "";
    emailInput.classList.toggle("hidden", Boolean(email));
    signInButton.classList.toggle("hidden", Boolean(email));
    signOutButton.classList.toggle("hidden", !email);
    emailLabel.classList.toggle("hidden", !email);
    emailLabel.textContent = email ? `${email}${currentRole(state) ? ` - ${ctx.titleize(currentRole(state))}` : ""}` : "";
    document.body.dataset.role = currentRole(state) || "signed-out";
    ctx.applyRoleVisibility();
  }

  function requireAuth(showAlert, ctx){
    const state = ctx.getState();
    if(isAuthenticated(state) && state.currentWorkspace) return true;
    ctx.setStatus(isAuthenticated(state) ? "Loading workspace" : "Sign in to use Supabase");
    if(showAlert) alert(isAuthenticated(state) ? "Workspace is still loading." : "Sign in first so Supabase RLS can allow access.");
    return false;
  }

  function requireInsertPermission(table, actionLabel, ctx){
    const state = ctx.getState();
    if(!requireAuth(true, ctx)) return false;
    if(canManageOperations(state)) return true;
    if(canSubmitOnly(state) && SUBMITTER_INSERT_TABLES.has(table)) return true;
    ctx.setStatus("Access limited by role");
    alert(`Your role can submit requests and uploads, but cannot ${actionLabel}.`);
    return false;
  }

  function requireUpdatePermission(table, actionLabel, ctx){
    if(table === "field_ops_workspaces") return requireOwnerPermission(actionLabel, ctx);
    if(requireAuth(true, ctx) && canManageOperations(ctx.getState())) return true;
    ctx.setStatus("Access limited by role");
    alert(`Owner or Admin access is required to ${actionLabel}.`);
    return false;
  }

  function requireArchivePermission(actionLabel, ctx){
    if(requireAuth(true, ctx) && canManageOperations(ctx.getState())) return true;
    ctx.setStatus("Access limited by role");
    alert(`Owner or Admin access is required to ${actionLabel}.`);
    return false;
  }

  function requireOperationsPermission(actionLabel, ctx){
    if(requireAuth(true, ctx) && canManageOperations(ctx.getState())) return true;
    ctx.setStatus("Owner or Admin required");
    alert(`Owner or Admin access is required to ${actionLabel}. Submitters can send requests through Import Review.`);
    return false;
  }

  function requireOwnerPermission(actionLabel, ctx){
    if(requireAuth(true, ctx) && isOwner(ctx.getState())) return true;
    ctx.setStatus("Owner required");
    alert(`Owner access is required to ${actionLabel}.`);
    return false;
  }

  async function initializeAuth(ctx){
    const { data, error } = await SessionApi.getSession(ctx.supabaseClient);
    if(error) console.error(error);
    ctx.setSession(data?.session || null);
    renderAuthState(ctx);

    SessionApi.onAuthStateChange(ctx.supabaseClient, async (_event, session) => {
      ctx.setSession(session);
      renderAuthState(ctx);
      if(session){
        await bootstrapWorkspace(ctx);
      } else {
        ctx.setWorkspace(null);
        Object.assign(ctx.app, ctx.createEmptyAppState());
        ctx.setStatus("Sign in to use Supabase");
        ctx.render();
      }
    });

    if(ctx.getState().currentSession){
      await bootstrapWorkspace(ctx);
    } else {
      ctx.setStatus("Sign in to use Supabase");
      ctx.render();
    }
  }

  async function signInForSync(ctx){
    const email = document.getElementById("authEmail").value.trim();
    if(!email){
      alert("Enter your email to sign in.");
      return;
    }

    const { error } = await SessionApi.signInWithEmail(ctx.supabaseClient, email, window.location.href.split("#")[0]);

    if(error){
      alert("Sign-in failed: " + error.message);
      return;
    }
    ctx.setStatus("Check your email for sign-in link");
    alert("Check your email for the sign-in link.");
  }

  async function signOutForSync(ctx){
    const { error } = await SessionApi.signOut(ctx.supabaseClient);
    if(error) alert("Sign-out failed: " + error.message);
  }

  async function bootstrapWorkspace(ctx){
    if(!isAuthenticated(ctx.getState())) return;
    try{
      ctx.setStatus("Loading workspace...");
      const { data, error } = await SessionApi.loadFirstWorkspace(ctx.supabaseClient);
      if(error) throw error;
      if(!data) throw new Error("No field operations workspace is assigned to this user.");

      ctx.setWorkspace(data);
      ctx.app.settings.workspaceName = data.name || "Field Operations Command Center";
      ctx.app.settings.workspaceNote = `Role: ${data.role || "member"}`;
      renderAuthState(ctx);
      await ctx.loadWorkspaceData();
      await ctx.flushPendingWrites(false);
      ctx.startAutoRefresh();
    }catch(err){
      console.error(err);
      ctx.setStatus("Workspace load failed");
      alert("Workspace load failed: " + err.message);
    }
  }

  window.FieldOps.Services.auth = {
    isAuthenticated,
    workspaceId,
    currentRole,
    isOwner,
    canManageOperations,
    canSubmitOnly,
    allowedViewsForRole,
    defaultViewForRole,
    canAccessView,
    renderAuthState,
    requireAuth,
    requireInsertPermission,
    requireUpdatePermission,
    requireArchivePermission,
    requireOperationsPermission,
    requireOwnerPermission,
    initializeAuth,
    signInForSync,
    signOutForSync,
    bootstrapWorkspace
  };
})();
