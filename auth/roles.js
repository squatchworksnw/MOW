(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Auth = window.FieldOps.Auth || {};

  const VIEW_ACCESS = {
    owner: ["dashboard","workOrders","workOrderDetail","reviewDetail","projects","materials","buildings","spaces","assets","vehicles","fuelReceipts","vendors","budget","documents","importReview","importCenter","reports","settings"],
    admin: ["dashboard","workOrders","workOrderDetail","reviewDetail","projects","materials","buildings","spaces","assets","vehicles","fuelReceipts","vendors","budget","documents","importReview","importCenter","reports"],
    submitter: ["importReview","materials","documents"],
    "signed-out": ["dashboard","workOrders","projects","materials","vehicles","fuelReceipts","vendors","budget","documents","importReview","reports","settings"]
  };

  const SUBMITTER_INSERT_TABLES = new Set(["field_ops_import_reviews", "field_ops_documents"]);

  window.FieldOps.Auth.roles = { VIEW_ACCESS, SUBMITTER_INSERT_TABLES };
})();
