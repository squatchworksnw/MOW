const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
let source = fs.readFileSync(path.join(root, "app.js"), "utf8");
source = [
  "state/app-state.js",
  "components/cards.js",
  "components/forms.js",
  "auth/roles.js",
  "auth/session.js",
  "services/supabase-service.js",
  "services/mappers.js",
  "services/import-review-service.js",
  "services/materials-service.js",
  "sync/pending-queue.js",
  "services/auth-service.js",
  "services/sync-service.js",
  "views/registry.js",
  "views/today-dashboard.js",
  "views/work-orders.js",
  "views/documents.js",
  "views/projects-budget.js",
  "views/materials.js",
  "views/review-queue.js",
  "views/fleet.js"
].map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n") + "\n" + source;
source = source.replace(/\binitializeAuth\(\);\s*$/, "");

class FakeElement {
  constructor(id = "", tagName = "div") {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.value = "";
    this.textContent = "";
    this.className = "";
    this.dataset = {};
    this.style = {};
    this.files = [];
    this.children = [];
    this.listeners = {};
    this.classList = {
      add: (...names) => names.forEach(name => this._classSet().add(name)),
      remove: (...names) => names.forEach(name => this._classSet().delete(name)),
      toggle: (name, force) => {
        const set = this._classSet();
        const shouldAdd = force === undefined ? !set.has(name) : Boolean(force);
        if (shouldAdd) set.add(name);
        else set.delete(name);
      }
    };
  }

  _classSet() {
    const set = new Set(String(this.className || "").split(/\s+/).filter(Boolean));
    const originalAdd = set.add.bind(set);
    const originalDelete = set.delete.bind(set);
    set.add = value => { originalAdd(value); this.className = [...set].join(" "); return set; };
    set.delete = value => { originalDelete(value); this.className = [...set].join(" "); return true; };
    return set;
  }

  set innerHTML(value) {
    this._innerHTML = String(value || "");
    const idMatches = [...this._innerHTML.matchAll(/<(input|select|textarea|button|div|p|h[1-6])[^>]*\sid="([^"]+)"/g)];
    for (const [, tag, id] of idMatches) {
      const el = document.getElementById(id);
      el.tagName = tag.toUpperCase();
      if (tag === "select") {
        const selectMarkup = this._innerHTML.slice(this._innerHTML.lastIndexOf("<select", this._innerHTML.indexOf(`id="${id}"`)));
        const selected = selectMarkup.match(/<option value="([^"]+)" selected/i) || selectMarkup.match(/<option value="([^"]+)"/i);
        if (selected) el.value = selected[1];
      }
      const valueMatch = this._innerHTML.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`, "i"));
      if (valueMatch) el.value = valueMatch[1].replaceAll("&quot;", "\"").replaceAll("&#039;", "'");
    }
    const nameMatches = [...this._innerHTML.matchAll(/<(input|select|textarea)[^>]*\sname="([^"]+)"[^>]*>([\s\S]*?)(?:<\/\1>)?/g)];
    this.namedControls = nameMatches.map(([, tag, name, body]) => {
      const el = new FakeElement("", tag);
      el.name = name;
      const valueMatch = body.match(/value="([^"]*)"/) || this._innerHTML.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`, "i"));
      const textareaMatch = tag === "textarea" ? body.match(/^([\s\S]*?)<\/textarea>/) : null;
      el.value = valueMatch ? valueMatch[1] : textareaMatch ? textareaMatch[1] : "";
      if (tag === "select") {
        const selectStart = this._innerHTML.lastIndexOf("<select", this._innerHTML.indexOf(`name="${name}"`));
        const selectEnd = this._innerHTML.indexOf("</select>", this._innerHTML.indexOf(`name="${name}"`));
        const selectMarkup = this._innerHTML.slice(selectStart, selectEnd);
        const selected = selectMarkup.match(/<option value="([^"]+)" selected/i) || selectMarkup.match(/<option value="([^"]+)"/i);
        el.value = selected ? selected[1] : "";
      }
      return el;
    });
  }

  get innerHTML() { return this._innerHTML || ""; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  reset() { this.value = ""; this.files = []; }
  closest() { return this; }
  scrollIntoView() {}
  focus() {}
  querySelectorAll() { return []; }
  querySelector() { return null; }
  insertAdjacentElement() {}
}

const elements = new Map();
const document = {
  body: new FakeElement("body", "body"),
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, new FakeElement(id));
    return elements.get(id);
  },
  querySelectorAll(selector) {
    if (selector === ".tab") return [...elements.values()].filter(el => el.className.includes("tab"));
    if (selector === ".view") return [...elements.values()].filter(el => el.className.includes("view"));
    if (selector === "[data-admin-only]") return [];
    return [];
  },
  querySelector() { return null; },
  createElement(tag) { return new FakeElement("", tag); },
  addEventListener() {}
};

for (const match of html.matchAll(/<([a-zA-Z0-9]+)[^>]*\sid="([^"]+)"[^>]*>/g)) {
  const [, tag, id] = match;
  const el = document.getElementById(id);
  el.tagName = tag.toUpperCase();
  const cls = match[0].match(/class="([^"]+)"/);
  if (cls) el.className = cls[1];
}
for (const match of html.matchAll(/<button[^>]*class="([^"]*\btab\b[^"]*)"[^>]*data-view="([^"]+)"/g)) {
  const el = new FakeElement("", "button");
  el.className = match[1];
  el.dataset.view = match[2];
  elements.set(`tab-${match[2]}`, el);
}

class FakeFormData {
  constructor(form) {
    this.map = new Map();
    for (const control of form.namedControls || []) {
      this.map.set(control.name, control.value);
    }
  }
  get(name) { return this.map.get(name) || ""; }
}

const tables = {
  field_ops_import_reviews: [],
  field_ops_documents: [],
  field_ops_work_orders: []
};

const makeRow = row => ({ id: row.id || `id-${Math.random().toString(36).slice(2)}`, updated_at: new Date().toISOString(), archived_at: null, ...row });

const supabaseClient = {
  from(table) {
    let operation = {};
    const builder = {
      insert(row) { operation = { type: "insert", row: makeRow(row) }; return builder; },
      update(payload) { operation = { type: "update", payload }; return builder; },
      select() { return builder; },
      single() {
        if (operation.type === "insert") {
          tables[table].push(operation.row);
          return Promise.resolve({ data: operation.row, error: null });
        }
        if (operation.type === "update") {
          const row = tables[table].find(item => item.id === operation.id);
          Object.assign(row, operation.payload, { updated_at: new Date().toISOString() });
          return Promise.resolve({ data: row, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve, reject) {
        const result = operation.type === "insert"
          ? (tables[table].push(operation.row), { data: null, error: null })
          : operation.type === "update"
            ? (Object.assign(tables[table].find(item => item.id === operation.id), operation.payload, { updated_at: new Date().toISOString() }), { data: null, error: null })
            : { data: null, error: null };
        return Promise.resolve(result).then(resolve, reject);
      },
      eq(column, value) { if (column === "id") operation.id = value; return builder; },
      is() { return builder; },
      not() { return builder; },
      order() { return builder; },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); }
    };
    return builder;
  },
  storage: {
    from() {
      return { upload: () => Promise.resolve({ error: null }) };
    }
  },
  auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) }
};

const context = {
  console,
  document,
  window: {
    supabase: { createClient: () => supabaseClient },
    scrollTo() {},
    addEventListener() {},
    pdfjsLib: null
  },
  navigator: { onLine: true, clipboard: { writeText: async () => {} } },
  localStorage: { getItem: () => null, setItem: () => {} },
  crypto: { randomUUID: () => `uuid-${Math.random().toString(36).slice(2)}` },
  FormData: FakeFormData,
  Blob: class {},
  URL: { createObjectURL: () => "", revokeObjectURL: () => {} },
  alert: message => { throw new Error(`Unexpected alert: ${message}`); },
  confirm: () => true,
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout,
  supabaseClient,
  tables
};
context.globalThis = context;
for (const [id, el] of elements) {
  if (/^[A-Za-z_$][\w$]*$/.test(id)) context[id] = el;
}
vm.createContext(context);
vm.runInContext(`${source}

async function __acceptanceFlow(){
  currentSession = { user:{ id:"admin-1", email:"admin@example.com" } };
  currentWorkspace = { id:"workspace-1", role:"submitter", name:"Test Workspace" };
  renderAuthState();
  if (!canSubmitOnly()) throw new Error("Submitter role did not activate");
  if (canAccessView("workOrders")) throw new Error("Submitter can see work orders");
  for (const blocked of ["vendors", "budget", "vehicles", "reports", "settings"]) {
    if (canAccessView(blocked)) throw new Error("Submitter can see " + blocked);
  }

  submissionName.value = "Field Staff";
  submissionContact.value = "field@example.com";
  submissionUrgency.value = "Urgent";
  submissionLocation.value = "Kitchen sink";
  submissionSource.value = "Staff portal";
  submissionDescription.value = "Water leaking under prep sink.";
  submissionUpload.files = [{ name:"leak-photo.jpg" }];
  await addSubmission({ preventDefault(){}, target:submissionForm });
  if (tables.field_ops_import_reviews.length !== 1) throw new Error("Submission did not create import review");
  if (tables.field_ops_documents.length !== 1) throw new Error("Submission file did not create document");

  currentWorkspace.role = "admin";
  app.submissions = tables.field_ops_import_reviews.map(fromImportReview);
  app.files = tables.field_ops_documents.map(fromDocument);
  renderAuthState();
  if (!canAccessView("importReview")) throw new Error("Admin cannot see import review");
  selectedReviewId = app.submissions[0].id;
  renderImportReviewDetail();
  reviewDetailForm.namedControls.find(c => c.name === "title").value = "Fix prep sink leak";
  reviewDetailForm.namedControls.find(c => c.name === "priority").value = "urgent";
  reviewDetailForm.namedControls.find(c => c.name === "description").value = "Kitchen sink";
  reviewDetailForm.namedControls.find(c => c.name === "notes").value = "Tighten supply line and check cabinet.";
  await approveReviewDetail();
  if (tables.field_ops_work_orders.length !== 1) throw new Error("Approval did not create work order");
  const created = tables.field_ops_work_orders[0];
  if (tables.field_ops_documents[0].work_order_id !== created.id) throw new Error("Document was not linked to work order");

  app.tasks = tables.field_ops_work_orders.map(fromWorkOrder);
  app.files = tables.field_ops_documents.map(fromDocument);
  selectedWorkOrderId = created.id;
  renderWorkOrderDetail();
  if (workOrderDetailTitle.textContent !== "Fix prep sink leak") throw new Error("Work order detail did not render: " + workOrderDetailTitle.textContent);

  const existingDocId = tables.field_ops_documents[0].id;
  document.getElementById("workOrderExistingDocument").value = existingDocId;
  document.getElementById("workOrderDetailNote").value = "Checked on site and fixed.";
  await saveWorkOrderDetailUpdates();
  if (!tables.field_ops_work_orders[0].notes.includes("Checked on site and fixed")) throw new Error("Note was not saved to work order history");

  await markWorkOrderComplete(created.id);
  if (tables.field_ops_work_orders[0].status !== "complete") throw new Error("Work order was not marked complete");

  return {
    review: tables.field_ops_import_reviews[0],
    document: tables.field_ops_documents[0],
    workOrder: tables.field_ops_work_orders[0]
  };
}
globalThis.__acceptanceFlow = __acceptanceFlow;
`, context, { filename: "app-under-test.js" });

context.__acceptanceFlow().then(result => {
  assert.equal(result.review.status, "approved");
  assert.equal(result.workOrder.status, "complete");
  assert.equal(result.document.work_order_id, result.workOrder.id);
  assert.match(css, /@media\s*\(max-width:780px\)/);
  assert.match(css, /\.quick-action-bar\{grid-template-columns:1fr 1fr\}/);
  assert.match(css, /button,input,select,textarea\{min-height:44px\}/);
  console.log("PASS role flow acceptance test");
}).catch(err => {
  console.error(err);
  process.exitCode = 1;
});
