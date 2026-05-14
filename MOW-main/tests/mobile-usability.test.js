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
    this.namedControls = [];
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
    const add = set.add.bind(set);
    const del = set.delete.bind(set);
    set.add = value => { add(value); this.className = [...set].join(" "); return set; };
    set.delete = value => { del(value); this.className = [...set].join(" "); return true; };
    return set;
  }
  set innerHTML(value) {
    this._innerHTML = String(value || "");
    const matches = [...this._innerHTML.matchAll(/<(input|select|textarea|button|div|p|h[1-6])[^>]*\sid="([^"]+)"/g)];
    for (const [, tag, id] of matches) {
      const el = document.getElementById(id);
      el.tagName = tag.toUpperCase();
      const valueMatch = this._innerHTML.match(new RegExp('id="' + id + '"[^>]*value="([^"]*)"', "i"));
      if (valueMatch) el.value = valueMatch[1];
      if (tag === "select") {
        const start = this._innerHTML.lastIndexOf("<select", this._innerHTML.indexOf('id="' + id + '"'));
        const end = this._innerHTML.indexOf("</select>", start);
        const markup = this._innerHTML.slice(start, end);
        const selected = markup.match(/<option value="([^"]+)"/i);
        if (selected) el.value = selected[1];
      }
    }
  }
  get innerHTML() { return this._innerHTML || ""; }
  addEventListener() {}
  reset() { this.value = ""; this.files = []; }
  closest() { return this; }
  scrollIntoView() {}
  focus() {}
  querySelectorAll() { return []; }
  insertAdjacentElement() {}
}

const elements = new Map();
const optionalSubmitterFields = [];
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
    if (selector === "[data-submitter-optional]") return optionalSubmitterFields;
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
for (const match of html.matchAll(/<label[^>]*data-submitter-optional[^>]*>/g)) {
  optionalSubmitterFields.push(new FakeElement("", "label"));
}
for (const match of html.matchAll(/<button[^>]*class="([^"]*\btab\b[^"]*)"[^>]*data-view="([^"]+)"/g)) {
  const el = new FakeElement("", "button");
  el.className = match[1];
  el.dataset.view = match[2];
  elements.set("tab-" + match[2], el);
}

const tables = {
  field_ops_import_reviews: [],
  field_ops_documents: [],
  field_ops_work_orders: []
};
const makeRow = row => ({ id: row.id || "id-" + Math.random().toString(36).slice(2), workspace_id: "workspace-1", updated_at: new Date().toISOString(), archived_at: null, archived_by: null, ...row });

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
        if (operation.type === "insert") {
          tables[table].push(operation.row);
        }
        if (operation.type === "update") {
          const row = tables[table].find(item => item.id === operation.id);
          Object.assign(row, operation.payload, { updated_at: new Date().toISOString() });
        }
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      },
      eq(column, value) { if (column === "id") operation.id = value; return builder; },
      is() { return builder; },
      not() { return builder; },
      order() { return builder; },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); }
    };
    return builder;
  },
  storage: { from() { return { upload: () => Promise.resolve({ error: null }) }; } },
  auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) }
};

const context = {
  console,
  document,
  window: { supabase: { createClient: () => supabaseClient }, innerWidth: 390, scrollTo() {}, addEventListener() {}, pdfjsLib: null },
  navigator: { onLine: true, clipboard: { writeText: async () => {} } },
  localStorage: { getItem: () => null, setItem: () => {} },
  crypto: { randomUUID: () => "uuid-" + Math.random().toString(36).slice(2) },
  Blob: class {},
  URL: { createObjectURL: () => "", revokeObjectURL: () => {} },
  alert: message => { throw new Error("Unexpected alert on mobile flow: " + message); },
  confirm: () => true,
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout,
  supabaseClient,
  tables,
  makeRow,
  optionalSubmitterFields
};
context.globalThis = context;
for (const [id, el] of elements) {
  if (/^[A-Za-z_$][\w$]*$/.test(id)) context[id] = el;
}

vm.createContext(context);
vm.runInContext(source + `

async function __mobileFlow(){
  currentSession = { user:{ id:"submitter-1", email:"submitter@example.com" } };
  currentWorkspace = { id:"workspace-1", role:"submitter", name:"Test Workspace" };
  renderAuthState();
  renderPermissionState();
  if (!canSubmitOnly()) throw new Error("Submitter role did not activate");
  if (optionalSubmitterFields.some(el => !el.className.includes("hidden"))) throw new Error("Submitter optional fields stayed visible");

  submissionName.value = "Driver";
  submissionUrgency.value = "High";
  submissionLocation.value = "Francis kitchen";
  submissionSource.value = "Staff portal";
  submissionCategory.value = "Kitchen / Equipment";
  submissionDescription.value = "Freezer alarm is flashing.";
  submissionUpload.files = [{ name:"freezer-photo.jpg" }];
  await addSubmission({ preventDefault(){}, target:submissionForm });
  if (submissionSaveState.dataset.state !== "saved") throw new Error("Submitter save state was not calm/saved");
  if (tables.field_ops_import_reviews.length !== 1) throw new Error("Mobile submitter request was not staged");
  if (tables.field_ops_documents.length !== 1) throw new Error("Mobile submitter file was not saved");

  currentWorkspace.role = "admin";
  tables.field_ops_work_orders.push(makeRow({
    id:"wo-mobile",
    title:"Check freezer alarm",
    work_order_number:"WO-MOBILE",
    status:"open",
    priority:"high",
    description:"Francis kitchen",
    notes:"Submitted from field"
  }));
  app.tasks = tables.field_ops_work_orders.map(fromWorkOrder);
  app.files = tables.field_ops_documents.map(fromDocument);
  selectedWorkOrderId = "wo-mobile";
  renderAuthState();
  renderWorkOrderDetail();
  if (!workOrderDetailBody.innerHTML.includes("field-status-strip")) throw new Error("Mobile scan strip missing");
  await markWorkOrderComplete("wo-mobile");
  if (tables.field_ops_work_orders.find(row => row.id === "wo-mobile").status !== "complete") throw new Error("Admin could not complete from detail");
  if (document.getElementById("workOrderDetailSaveState").dataset.state !== "saved") throw new Error("Complete action did not show saved state");
  return true;
}
globalThis.__mobileFlow = __mobileFlow;
`, context, { filename: "app-under-test.js" });

context.__mobileFlow().then(() => {
  assert.match(css, /@media\s*\(max-width:780px\)/);
  assert.match(css, /body\[data-role="submitter"\]\s+#submissionForm\{gap:12px\}/);
  assert.match(css, /\.field-status-strip\{display:grid;grid-template-columns:1fr 1fr\}/);
  assert.match(css, /\.quick-action-bar\{grid-template-columns:1fr 1fr\}/);
  assert.match(css, /button,input,select,textarea\{min-height:44px\}/);
  console.log("PASS mobile usability acceptance test");
}).catch(err => {
  console.error(err);
  process.exitCode = 1;
});
