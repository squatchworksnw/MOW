(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};

  function getNeedsAttentionToday(state, helpers){
    const today = helpers.todayString();
    const activeTasks = helpers.activeItems("tasks");
    return {
      urgentTasks: activeTasks.filter(t => ["urgent","high"].includes(t.priority) && t.status !== "complete"),
      dueToday: activeTasks.filter(t => t.date === today && t.status !== "complete"),
      activeProjects: helpers.activeItems("projects").filter(p => p.status !== "complete"),
      openBids: helpers.activeItems("bids").filter(b => !["approved","rejected","paid"].includes(b.status)),
      fleetAlerts: state.vehicleAlerts || [],
      reviewCount: helpers.activeItems("submissions").filter(s => s.status === "Needs Review").length
    };
  }

  function getCalendarItems(state, helpers){
    const items = [];
    helpers.activeItems("tasks").forEach(t => { if(t.date) items.push({date:t.date,title:t.name,type:"Work order",detail:t.workOrderNumber,tone:helpers.tone(t.priority)}); });
    helpers.activeItems("projects").forEach(p => { if(p.date) items.push({date:p.date,title:p.name,type:"Project target",detail:p.summary,tone:helpers.tone(p.priority)}); });
    helpers.activeItems("vehicles").forEach(v => {
      if(v.serviceDate) items.push({date:v.serviceDate,title:`${v.name} service`,type:"Fleet service",detail:v.plate,tone:helpers.tone(v.status)});
      if(v.registration) items.push({date:v.registration,title:`${v.name} registration`,type:"Fleet registration",detail:v.plate,tone:helpers.tone(v.status)});
    });
    return items.sort((a,b) => a.date.localeCompare(b.date));
  }

  function render(state, helpers){
    const todayState = getNeedsAttentionToday(state, helpers);
    const calendarItems = getCalendarItems(state, helpers);
    const activeTasks = helpers.activeItems("tasks");

    document.getElementById("dailyGreeting").textContent = new Date().getHours() < 12 ? "Good morning." : new Date().getHours() < 17 ? "Good afternoon." : "Good evening.";
    document.getElementById("dailyRhythmLines").innerHTML = [
      todayState.reviewCount ? `${todayState.reviewCount} import review item${todayState.reviewCount === 1 ? "" : "s"} waiting.` : "No import reviews waiting.",
      todayState.dueToday.length ? `${todayState.dueToday.length} work order${todayState.dueToday.length === 1 ? "" : "s"} due today.` : "No work orders due today.",
      todayState.urgentTasks.length ? `${todayState.urgentTasks.length} urgent/high item${todayState.urgentTasks.length === 1 ? "" : "s"} need attention.` : "No urgent facility failures.",
      todayState.fleetAlerts.length ? `${todayState.fleetAlerts.length} fleet item${todayState.fleetAlerts.length === 1 ? "" : "s"} to check.` : "Fleet is quiet."
    ].map(line => `<p>${helpers.esc(line)}</p>`).join("");

    document.getElementById("reviewQueueCount").textContent = `${todayState.reviewCount} waiting`;
    document.getElementById("workspaceProjectCount").textContent = `${todayState.activeProjects.length} active`;
    document.getElementById("workspaceMaintenanceCount").textContent = `${todayState.dueToday.length} due today`;
    document.getElementById("workspaceFleetCount").textContent = `${todayState.fleetAlerts.length} to check`;
    document.getElementById("workspaceFuelCount").textContent = `${helpers.activeItems("fuelReceipts").length} receipts`;
    document.getElementById("workspaceBidCount").textContent = `${todayState.openBids.length} open`;
    document.getElementById("workspaceFileCount").textContent = `${helpers.activeItems("files").length} linked`;
    document.getElementById("workspaceCalendarCount").textContent = `${calendarItems.length} dated`;
    document.getElementById("urgentCount").textContent = todayState.urgentTasks.length;
    document.getElementById("projectCount").textContent = todayState.activeProjects.length;
    document.getElementById("bidCount").textContent = todayState.openBids.length;

    document.getElementById("urgentList").innerHTML = todayState.urgentTasks.length ? todayState.urgentTasks.slice(0,5).map(t => helpers.workOrderCardWithActions(t)).join("") : helpers.empty("No urgent work orders.");
    document.getElementById("weekList").innerHTML = activeTasks.length ? activeTasks.slice(0,5).map(t => helpers.workOrderCardWithActions(t)).join("") : helpers.empty("No work orders yet.");
    document.getElementById("fleetAlertList").innerHTML = todayState.fleetAlerts.length ? todayState.fleetAlerts.slice(0,5).map(helpers.renderVehicleAlertCard).join("") : helpers.empty("No fleet alerts yet.");
    document.getElementById("activeProjectList").innerHTML = todayState.activeProjects.length ? todayState.activeProjects.slice(0,5).map(helpers.projectCard).join("") : helpers.empty("No active projects yet.");
    document.getElementById("dashboardBidList").innerHTML = todayState.openBids.length ? todayState.openBids.slice(0,5).map(helpers.bidCard).join("") : helpers.empty("No open bids yet.");
  }

  function renderCalendar(state, helpers){
    const target = document.getElementById("calendarList");
    if(!target) return;
    const items = getCalendarItems(state, helpers);
    const today = helpers.todayString();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndString = weekEnd.toISOString().slice(0,10);
    document.getElementById("calendarTodayCount").textContent = items.filter(i => i.date === today).length;
    document.getElementById("calendarWeekCount").textContent = items.filter(i => i.date >= today && i.date <= weekEndString).length;
    document.getElementById("calendarTotalCount").textContent = items.length;
    target.innerHTML = items.length ? items.map(i => helpers.card(i.title,[i.detail],[i.type,i.date],i.tone)).join("") : helpers.empty("No dated work yet.");
  }

  window.FieldOps.Views.TodayDashboard = {
    render,
    renderCalendar,
    getCalendarItems,
    getNeedsAttentionToday
  };

  globalThis.renderCalendar = function(){
    window.FieldOps.Views.TodayDashboard.renderCalendar(globalThis.app, globalThis.createViewHelpers());
  };
})();
