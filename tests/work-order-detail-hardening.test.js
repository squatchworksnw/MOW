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
  addEventListener(type, fn) { this.listeners[type] = fn; }
  reset() { this.value = ""; this.files = []; }
  closest() { return this; }
  scrollIntoView() {}
  focus() {}
  querySelectorAll() { return []; }
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
  elements.set("tab-" + match[2], el);
}

const tables = {
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
  window: { supabase: { createClient: () => supabaseClient }, scrollTo() {}, addEventListener() {}, pdfjsLib: null },
  navigator: { onLine: true, clipboard: { writeText: async () => {} } },
  localStorage: { getItem: () => null, setItem: () => {} },
  crypto: { randomUUID: () => "uuid-" + Math.random().toString(36).slice(2) },
  Blob: class {},
  URL: { createObjectURL: () => "", revokeObjectURL: () => {} },
  alert: message => { throw new Error("Unexpected alert: " + message); },
  confirm: () => true,
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout,
  supabaseClient,
  tables,
  makeRow
};
context.globalThis = context;
for (const [id, el] of elements) {
  if (/^[A-Za-z_$][\w$]*$/.test(id)) context[id] = el;
}

vm.createContext(context);
vm.runInContext(source + `

async function __hardeningFlow(){
  currentSession = { user:{ id:"admin-1", email:"admin@example.com" } };
  currentWorkspace = { id:"workspace-1", role:"admin", name:"Test Workspace" };

  tables.field_ops_work_orders.push(makeRow({
    id:"wo-1",
    title:"Repair restroom sink",
    work_order_number:"WO-100",
    status:"open",
    priority:"normal",
    due_date:"2026-05-12",
    description:"Building A restroom 2",
    notes:"Initial intake"
  }));
  tables.field_ops_documents.push(makeRow({
    id:"doc-1",
    file_name:"sink-photo.pdf",
    file_type:"pdf",
    extracted_text:"Photo packet and invoice notes",
    extraction_status:"complete",
    work_order_id:null
  }));

  app.tasks = tables.field_ops_work_orders.filter(row => !row.archived_at).map(fromWorkOrder);
  app.files = tables.field_ops_documents.map(fromDocument);
  renderTasks();
  if (!taskList.innerHTML.includes("Repair restroom sink")) throw new Error("Active work order did not render");

  selectedWorkOrderId = "wo-1";
  renderWorkOrderDetail();
  document.getElementById("workOrderDetailStatus").value = "in_progress";
  document.getElementById("workOrderDetailPriority").value = "high";
  document.getElementById("workOrderDetailNote").value = "First field note.";
  await saveWorkOrderDetailUpdates();
  if (tables.field_ops_work_orders[0].status !== "in_progress") throw new Error("Status was not saved");
  if (tables.field_ops_work_orders[0].priority !== "high") throw new Error("Priority was not saved");
  if (!tables.field_ops_work_orders[0].notes.includes("First field note.")) throw new Error("First note missing");

  app.tasks = tables.field_ops_work_orders.filter(row => !row.archived_at).map(fromWorkOrder);
  app.files = tables.field_ops_documents.map(fromDocument);
  selectedWorkOrderId = "wo-1";
  renderWorkOrderDetail();
  document.getElementById("workOrderDetailNote").value = "Second field note.";
  document.getElementById("workOrderExistingDocument").value = "doc-1";
  await saveWorkOrderDetailUpdates();
  if (!tables.field_ops_work_orders[0].notes.includes("Second field note.")) throw new Error("Second note missing");
  if (tables.field_ops_documents[0].work_order_id !== "wo-1") throw new Error("Document was not linked");

  await unlinkDocumentFromWorkOrder("doc-1");
  if (tables.field_ops_documents[0].work_order_id !== null) throw new Error("Document was not unlinked");

  await archiveWorkOrderById("wo-1");
  if (!tables.field_ops_work_orders[0].archived_at) throw new Error("Work order was not archived");
  app.tasks = tables.field_ops_work_orders.filter(row => !row.archived_at).map(fromWorkOrder);
  app.archivedTasks = tables.field_ops_work_orders.filter(row => row.archived_at).map(fromWorkOrder);
  renderTasks();
  if (taskList.innerHTML.includes("Repair restroom sink")) throw new Error("Archived work order still appears active");
  if (!archivedTaskList.innerHTML.includes("Repair restroom sink")) throw new Error("Archived work order is not recoverable");

  await restoreWorkOrder("wo-1");
  if (tables.field_ops_work_orders[0].archived_at !== null) throw new Error("Work order was not restored");
  return tables.field_ops_work_orders[0];
}
globalThis.__hardeningFlow = __hardeningFlow;
`, context, { filename: "app-under-test.js" });

context.__hardeningFlow().then(result => {
  assert.equal(result.status, "in_progress");
  assert.equal(result.priority, "high");
  assert.match(result.notes, /First field note/);
  assert.match(result.notes, /Second field note/);
  assert.match(css, /\.timeline/);
  assert.match(css, /button,input,select,textarea\{min-height:44px\}/);
  console.log("PASS work order detail hardening acceptance test");
}).catch(err => {
  console.error(err);
  process.exitCode = 1;
});
