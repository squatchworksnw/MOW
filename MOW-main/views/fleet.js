(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};
  const Mappers = window.FieldOps.Services.mappers;

  function daysUntil(dateValue){
    if(!dateValue) return null;
    const today = new Date(todayString());
    const target = new Date(dateValue);
    if(Number.isNaN(target.getTime())) return null;
    return Math.ceil((target - today) / 86400000);
  }

  function serviceDueState(vehicle){
    const days = daysUntil(vehicle.serviceDate);
    if(days === null) return { state:"not_scheduled", label:"No service date", tone:"" };
    if(days < 0) return { state:"overdue", label:`Service overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`, tone:"danger" };
    if(days <= 14) return { state:"due_soon", label:`Service due in ${days} day${days === 1 ? "" : "s"}`, tone:"warning" };
    return { state:"scheduled", label:`Next service: ${vehicle.serviceDate}`, tone:"ok" };
  }

  function registrationAlertState(vehicle){
    const days = daysUntil(vehicle.registration);
    if(days === null) return { state:"not_tracked", label:"No registration date", tone:"" };
    if(days < 0) return { state:"expired", label:`Registration overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`, tone:"danger" };
    if(days <= 30) return { state:"due_soon", label:`Registration due in ${days} day${days === 1 ? "" : "s"}`, tone:"warning" };
    return { state:"current", label:`Registration: ${vehicle.registration}`, tone:"ok" };
  }

  function fleetDocumentsForVehicle(vehicle){
    return activeItems("files").filter(file => file.relatedVehicleId === vehicle.id);
  }

  function fleetDocumentsForFuelReceipt(receipt){
    return activeItems("files").filter(file => file.relatedFuelReceiptId === receipt.id);
  }

  function vehicleDetailLines(vehicle){
    return [
      `Vehicle #: ${vehicle.vehicleNumber || "Not entered"}`,
      `Plate: ${vehicle.plate || "Not entered"}`,
      `VIN: ${vehicle.vin || "Not entered"}`,
      `Odometer: ${vehicle.mileage || "Not entered"}`,
      vehicle.notes
    ];
  }

  function vehicleTags(vehicle){
    return [
      titleize(vehicle.status),
      vehicle.lastServiceDate ? `Last service: ${vehicle.lastServiceDate}` : "",
      vehicle.serviceDate ? `Next service: ${vehicle.serviceDate}` : "",
      vehicle.registration ? `Registration: ${vehicle.registration}` : ""
    ];
  }

  function renderVehicleCard(vehicle){
    return card(vehicle.name, vehicleDetailLines(vehicle), vehicleTags(vehicle), tone(vehicle.status));
  }

  function renderVehicleDetail(vehicle){
    const service = serviceDueState(vehicle);
    const registration = registrationAlertState(vehicle);
    const docs = fleetDocumentsForVehicle(vehicle);
    return card(
      vehicle.name,
      [...vehicleDetailLines(vehicle), service.label, registration.label, docs.length ? `Linked documents: ${docs.length}` : ""],
      [...vehicleTags(vehicle), service.state !== "not_scheduled" ? service.label : "", registration.state !== "not_tracked" ? registration.label : ""],
      service.tone || registration.tone || tone(vehicle.status)
    );
  }

  function renderVehicleAlertCard(alert){
    return card(
      alert.name,
      [`Plate: ${alert.license_plate || "Not entered"}`, `Odometer: ${alert.odometer || "Not entered"}`],
      [titleize(alert.alert_state), alert.next_service_date, alert.registration_due_date],
      tone(alert.alert_state)
    );
  }

  function renderFuelReceiptCard(receipt){
    const vehicle = app.vehicles.find(v => v.id === receipt.vehicleId);
    const docs = fleetDocumentsForFuelReceipt(receipt);
    return card(
      vehicle?.name || "Fuel receipt",
      [
        `Station/vendor: ${receipt.vendor || "Not entered"}`,
        receipt.gallons ? `Gallons: ${receipt.gallons}` : "",
        receipt.pricePerGallon ? `Price/gal: ${money(receipt.pricePerGallon)}` : "",
        receipt.odometer ? `Odometer: ${receipt.odometer}` : "",
        docs.length ? `Linked documents: ${docs.length}` : "",
        receipt.notes
      ],
      [receipt.date, money(receipt.totalAmount)],
      ""
    );
  }

  async function addVehicle(e){
    e.preventDefault();
    try{
      await insertRecord("field_ops_vehicles", Mappers.vehiclePayloadFromForm({ name:vehicleName.value, vehicleNumber:vehicleNumber.value, plate:vehiclePlate.value, vin:vehicleVin.value, mileage:vehicleMileage.value, status:vehicleStatus.value, lastServiceDate:vehicleLastService.value, serviceDate:vehicleService.value, registration:vehicleRegistration.value, warranty:vehicleWarranty.value, notes:vehicleNotes.value }));
      e.target.reset();
    }catch(err){ handleWriteError(err); }
  }

  async function addFuelReceipt(e){
    e.preventDefault();
    try{
      const receiptPayload = { id:id(), ...Mappers.fuelReceiptPayloadFromForm({ vehicleId:fuelVehicle.value, date:fuelDate.value, vendor:fuelVendor.value, gallons:fuelGallons.value, totalAmount:fuelTotal.value, pricePerGallon:fuelPrice.value, odometer:fuelOdometer.value, file:fuelReceiptFile.value, notes:fuelNotes.value }) };
      const budgetId = id();
      const receipt = await insertRecord("field_ops_fuel_receipts", receiptPayload);
      const vehicle = app.vehicles.find(v => v.id === receipt.vehicle_id);
      const budget = await insertRecord("field_ops_budget_items", Mappers.fuelReceiptBudgetPayload(receipt, vehicle, budgetId));
      await updateRecord("field_ops_fuel_receipts", receipt.id, { budget_item_id: budget.id });
      e.target.reset();
    }catch(err){ handleWriteError(err); }
  }

  function renderFleet(){
    const vehicles = activeItems("vehicles");
    document.getElementById("vehicleList").innerHTML = vehicles.length ? vehicles.map(v => renderVehicleCard(v) + rowActions("vehicles", v)).join("") : empty("No vehicles yet.");
    const options = `<option value="">No related vehicle</option>` + vehicles.map(v => `<option value="${v.id}">${esc(v.name)}</option>`).join("");
    document.getElementById("fileVehicle").innerHTML = options;
    document.getElementById("taskVehicle").innerHTML = options;
    document.getElementById("fuelVehicle").innerHTML = `<option value="">Select vehicle</option>` + vehicles.map(v => `<option value="${v.id}">${esc(v.name)}</option>`).join("");
  }

  function renderFuelReceipts(){
    const receipts = activeItems("fuelReceipts");
    document.getElementById("fileFuelReceipt").innerHTML = `<option value="">No related fuel receipt</option>` + receipts.map(r => `<option value="${r.id}">${esc([r.date, money(r.totalAmount)].join(" - "))}</option>`).join("");
    if(document.getElementById("budgetFuelReceipt")) document.getElementById("budgetFuelReceipt").innerHTML = `<option value="">No related fuel receipt</option>` + receipts.map(r => `<option value="${r.id}">${esc([r.date, money(r.totalAmount)].join(" - "))}</option>`).join("");
    document.getElementById("fuelReceiptList").innerHTML = receipts.length ? receipts.map(r => renderFuelReceiptCard(r) + rowActions("fuelReceipts", r)).join("") : empty("No fuel receipts yet.");
  }

  const FleetWorkspace = {
    addVehicle,
    addFuelReceipt,
    daysUntil,
    serviceDueState,
    registrationAlertState,
    fleetDocumentsForVehicle,
    fleetDocumentsForFuelReceipt,
    renderVehicleCard,
    renderVehicleDetail,
    renderVehicleAlertCard,
    renderFuelReceiptCard,
    renderFleet,
    renderFuelReceipts
  };

  window.FieldOps.Views.FleetWorkspace = FleetWorkspace;

  Object.assign(window.FieldOps.Views, {
    addVehicle,
    addFuelReceipt,
    renderFleet,
    renderFuelReceipts
  });
  Object.assign(globalThis, {
    addVehicle,
    addFuelReceipt,
    renderFleet,
    renderFuelReceipts
  });
})();
