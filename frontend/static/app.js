const API = "/api";
let state = {
  token: localStorage.getItem("qc_token") || null,
  user: JSON.parse(localStorage.getItem("qc_user") || "null"),
  view: "login",
  reports: [],
  factories: [],
  currentReport: null,
  currentTab: "info",
  photoSlots: null,
};

function toast(msg) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
    <span>${msg}</span>
  `;
  container.appendChild(t);
  setTimeout(() => {
    if (t.parentNode) t.parentNode.removeChild(t);
  }, 3500);
}

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(API + path, { ...opts, headers });
  if (res.status === 401) {
    logout();
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res;
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("qc_token");
  localStorage.removeItem("qc_user");
  state.view = "login";
  render();
}

// ---------------- INIT ----------------
async function init() {
  if (state.token && state.user) {
    state.view = "dashboard";
    await loadDashboardData();
  }
  render();
}

async function loadDashboardData() {
  try {
    const [reports, factories] = await Promise.all([
      api("/reports"),
      api("/factories"),
    ]);
    state.reports = reports;
    state.factories = factories;
  } catch (e) {
    toast(e.message);
  }
}

// ---------------- RENDER ROOT ----------------
function render() {
  const app = document.getElementById("app");
  if (state.view === "login") {
    app.innerHTML = renderLogin();
    bindLogin();
  } else if (state.view === "dashboard") {
    app.innerHTML = renderTopbar() + renderDashboard();
    bindDashboard();
  } else if (state.view === "report") {
    app.innerHTML = renderTopbar() + renderReportWizard();
    bindReportWizard();
  }
}

// ---------------- LOGIN ----------------
function renderLogin() {
  return `
  <div class="login-wrap">
    <div class="login-card">
      <img src="/static/logo2.png" style="height: 64px; object-fit: contain; margin-bottom: 24px; display: block; margin-left: auto; margin-right: auto;" alt="Company Logo">
      <h1>QC Inspection Reports</h1>
      <p class="sub">Sign in to create or continue an inspection report.</p>
      <form id="login-form">
        <label>Email</label>
        <input type="email" id="login-email" required autocomplete="username">
        <label>Password</label>
        <input type="password" id="login-password" required autocomplete="current-password">
        <div class="row-actions">
          <button type="submit" class="btn-primary btn-block">Sign in</button>
        </div>
        <div id="login-error"></div>
      </form>
    </div>
  </div>`;
}

function bindLogin() {
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errBox = document.getElementById("login-error");
    errBox.innerHTML = "";
    try {
      const form = new URLSearchParams();
      form.set("username", email);
      form.set("password", password);
      const res = await fetch(API + "/auth/login", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Login failed" }));
        throw new Error(err.detail || "Login failed");
      }
      const data = await res.json();
      state.token = data.access_token;
      state.user = data.user;
      localStorage.setItem("qc_token", state.token);
      localStorage.setItem("qc_user", JSON.stringify(state.user));
      state.view = "dashboard";
      await loadDashboardData();
      render();
    } catch (err) {
      errBox.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

// ---------------- TOPBAR ----------------
function renderTopbar() {
  return `
  <div class="topbar">
    <div class="brand"><img src="/static/logo2.png" style="height: 32px; object-fit: contain;" alt="Logo"> QC Inspection Reports</div>
    <div class="user-info">
      <span>${state.user.name}</span>
      <span class="user-role">${state.user.role}</span>
      <button class="link" id="logout-btn">Sign out</button>
    </div>
  </div>`;
}

function bindTopbarCommon() {
  const btn = document.getElementById("logout-btn");
  if (btn) btn.addEventListener("click", logout);
  const back = document.getElementById("back-btn");
  if (back) back.addEventListener("click", () => { state.view = "dashboard"; render(); });
}

// ---------------- DASHBOARD ----------------
function statusLabel(s) {
  return { draft: "Draft", qc_in_progress: "QC in progress", completed: "Completed" }[s] || s;
}

function renderDashboard() {
  const factoryOptions = state.factories.map(f => `<option value="${f.id}">${f.name}</option>`).join("");
  const items = state.reports.length
    ? state.reports.map(r => `
      <div class="report-item" data-id="${r.id}">
        <div>
          <div><strong>${r.report_no}</strong></div>
          <div class="meta">${r.customer_name || "—"} · PO ${r.po_number || "—"}</div>
        </div>
        <span class="badge badge-${r.status}">${statusLabel(r.status)}</span>
      </div>
    `).join("")
    : `<div class="empty-state">No reports yet. Create the first one below.</div>`;

  return `
  <div class="container">
    <div class="toolbar">
      <h1>Reports</h1>
      <button class="btn-primary" id="new-report-btn">+ New report</button>
    </div>
    ${items}

    <div class="card" id="new-report-card" style="display:none; margin-top:20px;">
      <h2>New inspection report</h2>
      <label>Report No.</label>
      <input type="text" id="nr-report-no" placeholder="e.g. Bjorna-FRI-2026-79">
      <div class="grid2">
        <div>
          <label>Customer name</label>
          <input type="text" id="nr-customer">
        </div>
        <div>
          <label>PO number</label>
          <input type="text" id="nr-po">
        </div>
      </div>
      <label>Factory</label>
      <select id="nr-factory">
        <option value="">— Select factory —</option>
        ${factoryOptions}
        <option value="__new__">+ Add new factory…</option>
      </select>
      <div id="nr-new-factory-wrap" style="display:none;">
        <label>New factory name</label>
        <input type="text" id="nr-new-factory-name">
      </div>
      <div class="row-actions">
        <button class="btn-primary" id="nr-submit">Create report</button>
        <button class="btn-secondary" id="nr-cancel">Cancel</button>
      </div>
    </div>
  </div>`;
}

function bindDashboard() {
  bindTopbarCommon();
  document.querySelectorAll(".report-item").forEach(el => {
    el.addEventListener("click", async () => {
      const id = el.dataset.id;
      await openReport(id);
    });
  });
  const newBtn = document.getElementById("new-report-btn");
  const card = document.getElementById("new-report-card");
  newBtn.addEventListener("click", () => { card.style.display = "block"; newBtn.style.display = "none"; });
  document.getElementById("nr-cancel").addEventListener("click", () => { card.style.display = "none"; newBtn.style.display = "inline-block"; });

  document.getElementById("nr-factory").addEventListener("change", (e) => {
    document.getElementById("nr-new-factory-wrap").style.display = e.target.value === "__new__" ? "block" : "none";
  });

  document.getElementById("nr-submit").addEventListener("click", async () => {
    try {
      let factoryId = document.getElementById("nr-factory").value;
      if (factoryId === "__new__") {
        const name = document.getElementById("nr-new-factory-name").value.trim();
        if (!name) { toast("Enter a factory name"); return; }
        const f = await api("/factories", { method: "POST", body: JSON.stringify({ name }) });
        factoryId = f.id;
      }
      const reportNo = document.getElementById("nr-report-no").value.trim();
      if (!reportNo) { toast("Report number is required"); return; }
      const payload = {
        report_no: reportNo,
        customer_name: document.getElementById("nr-customer").value,
        po_number: document.getElementById("nr-po").value,
        factory_id: factoryId ? parseInt(factoryId) : null,
      };
      const r = await api("/reports", { method: "POST", body: JSON.stringify(payload) });
      toast("Report created");
      await openReport(r.id);
    } catch (e) {
      toast(e.message);
    }
  });
}

async function openReport(id) {
  try {
    const r = await api(`/reports/${id}`);
    state.currentReport = r;
    state.currentTab = "info";
    state.view = "report";
    render();
  } catch (e) {
    toast(e.message);
  }
}

// ---------------- REPORT WIZARD ----------------
const TABS = [
  { key: "info", label: "Report Info", desc: "Basic details & locations" },
  { key: "product", label: "Product & PO", desc: "Category & quantities" },
  { key: "checklists", label: "Checklists", desc: "Standards & labeling" },
  { key: "aql", label: "AQL & Defects", desc: "Defect breakdown" },
  { key: "measurements", label: "Measurements", desc: "Sizing tests & specs" },
  { key: "tests", label: "Onsite Tests", desc: "Shrinkage & safety" },
  { key: "photos", label: "Photos", desc: "Visual documentation" },
];

function renderReportWizard() {
  const r = state.currentReport;
  const tabsHtml = TABS.map((t, i) => `
    <button class="step-btn ${state.currentTab === t.key ? "active" : ""}" data-tab="${t.key}">
      <div class="step-number">${i + 1}</div>
      <div style="display:flex; flex-direction:column; line-height: 1.2;">
        <span>${t.label}</span>
        <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; font-weight:400;">${t.desc}</span>
      </div>
    </button>`).join("");

  return `
  <div class="container" style="max-width: 1100px;">
    <div class="toolbar" style="margin-bottom:0;">
      <div>
        <button class="link" id="back-btn" style="padding:0 0 12px; margin-bottom: 4px; display:inline-flex; align-items:center; gap:6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to Reports
        </button>
        <h1>Inspection: ${r.report_no}</h1>
      </div>
      <span class="badge badge-${r.status}">${statusLabel(r.status)}</span>
    </div>

    <div class="wizard-layout">
      <div class="wizard-sidebar">
        ${tabsHtml}
        <div class="card" style="margin-top: 16px; padding: 16px; border-radius: var(--radius-sm); text-align:center;">
          <button class="btn-primary btn-block" id="generate-btn" style="padding: 12px; font-size:1rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Generate Document
          </button>
          <p class="hint" style="justify-content:center; margin-top:12px; font-size: 0.75rem;">Downloads your final .docx report</p>
        </div>
      </div>
      <div class="wizard-content" id="tab-content">
        ${renderTabContent()}
      </div>
    </div>
  </div>`;
}

function renderTabContent() {
  const t = state.currentTab;
  if (t === "info") return renderInfoTab();
  if (t === "product") return renderProductTab();
  if (t === "checklists") return renderChecklistsTab();
  if (t === "aql") return renderAqlTab();
  if (t === "measurements") return renderMeasurementsTab();
  if (t === "tests") return renderTestsTab();
  if (t === "photos") return renderPhotosTab();
  return "";
}

function field(label, id, value, type = "text") {
  return `
  <div class="input-group" style="margin-bottom: 12px;">
    <label for="${id}">${label}</label>
    <input type="${type}" id="${id}" value="${value ?? ""}" placeholder="Enter ${label.toLowerCase()}...">
  </div>`;
}

// --- Tab: Report Info (admin) ---
function renderInfoTab() {
  const h = state.currentReport.header_info || {};
  const canEdit = state.user.role === "admin";
  return `
  <div class="card">
    <h2>Report Info ${canEdit ? "" : "(admin only)"}</h2>
    <div class="grid2">
      ${field("Report No.", "h-report_no", h.report_no ?? state.currentReport.report_no)}
      ${field("Customer Name", "h-customer_name", h.customer_name ?? state.currentReport.customer_name)}
      ${field("Destination Country", "h-destination_country", h.destination_country)}
      ${field("Inspection Type", "h-inspection_type", h.inspection_type ?? "Final Inspection Report")}
      ${field("Inspection Date", "h-inspection_date", h.inspection_date)}
      ${field("Manufacturer Name", "h-manufacturer_name", h.manufacturer_name)}
      ${field("Inspection Location", "h-inspection_location", h.inspection_location)}
      ${field("Factory Representative", "h-factory_rep_name", h.factory_rep_name)}
      ${field("Inspector(s) Name", "h-inspector_names", h.inspector_names)}
      ${field("Arrival Time", "h-arrival_time", h.arrival_time)}
      ${field("Departure Time", "h-departure_time", h.departure_time)}
    </div>
    ${canEdit ? `<div class="row-actions"><button class="btn-primary" id="save-info">Save</button></div>` : ""}
  </div>`;
}

// --- Tab: Product & PO (admin) ---
function renderProductTab() {
  const rows = state.currentReport.po_rows || [];
  const pc = state.currentReport.product_category || {};
  const canEdit = state.user.role === "admin";
  const rowsHtml = rows.map((row, i) => `
    <tr>
      <td><input data-i="${i}" data-f="po_number" value="${row.po_number ?? ""}"></td>
      <td><input data-i="${i}" data-f="sku" value="${row.sku ?? ""}"></td>
      <td><input data-i="${i}" data-f="item_description" value="${row.item_description ?? ""}"></td>
      <td><input data-i="${i}" data-f="design_color" value="${row.design_color ?? ""}"></td>
      <td><input data-i="${i}" data-f="size" value="${row.size ?? ""}"></td>
      <td><input data-i="${i}" data-f="po_qty" value="${row.po_qty ?? ""}" style="width:70px;"></td>
      <td><input data-i="${i}" data-f="offer_qty_carton" value="${row.offer_qty_carton ?? ""}" style="width:70px;"></td>
      <td><button class="icon-btn" data-del="${i}">✕</button></td>
    </tr>`).join("");
  const categories = ["BATH", "KITCHEN", "TABLE", "BEDDING", "WINDOW", "OTHER"];
  return `
  <div class="card">
    <h2>Product Category ${canEdit ? "" : "(admin only)"}</h2>
    <label>Product / Category Description</label>
    <input type="text" id="pc-category_description" value="${pc.category_description ?? ""}" ${canEdit ? "" : "disabled"}>
    <label>Category</label>
    <select id="pc-category" ${canEdit ? "" : "disabled"}>
      <option value="">— select —</option>
      ${categories.map(c => `<option value="${c}" ${pc.category === c ? "selected" : ""}>${c}</option>`).join("")}
    </select>
    <div class="grid2">
      <div><label>Fabric Construction Required</label><input type="text" id="pc-fabric_required" value="${pc.fabric_required ?? ""}" ${canEdit ? "" : "disabled"}></div>
      <div><label>Fabric Construction Found</label><input type="text" id="pc-fabric_found" value="${pc.fabric_found ?? ""}" ${canEdit ? "" : "disabled"}></div>
      <div><label>Polyester Filling Required</label><input type="text" id="pc-poly_required" value="${pc.poly_required ?? ""}" ${canEdit ? "" : "disabled"}></div>
      <div><label>Polyester Filling Found</label><input type="text" id="pc-poly_found" value="${pc.poly_found ?? ""}" ${canEdit ? "" : "disabled"}></div>
    </div>
    ${canEdit ? `<div class="row-actions"><button class="btn-primary" id="save-product-category">Save</button></div>` : ""}
  </div>
  <div class="card">
    <h2>PO Details ${canEdit ? "" : "(admin only)"}</h2>
    <div class="row-table-wrap">
      <table class="row-table" id="po-table">
        <thead><tr><th>PO#</th><th>SKU</th><th>Description</th><th>Color</th><th>Size</th><th>PO Qty</th><th>Carton Qty</th><th></th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    ${canEdit ? `
    <div class="row-actions">
      <button class="btn-secondary" id="add-po-row">+ Add row</button>
      <button class="btn-primary" id="save-po">Save</button>
    </div>` : ""}
    <p class="hint">Table rows in the generated Word doc adjust automatically to match how many you add here.</p>
  </div>`;
}

// --- Tab: Checklists (admin) - Standards Reference & Marking/Labeling ---
const ML_GROUPS = [
  { header: "Shipping Mark - Carton Sticker", rows: [
    [2, "Presence"], [3, "Position"], [4, "Information"], [5, "Batch Number"],
    [6, "Customer Order Number"], [7, "Customer Article Number"], [8, "Description"],
    [9, "Product Size"], [10, "Quantity"], [11, "Carton Size"], [12, "Gross Weight"],
    [13, "Net Weight"], [14, "Carton Number"], [15, "Barcode Sticker"], [16, "FSC Carton Printing"],
  ]},
  { header: "Polybag Warning", rows: [[18, "Presence"], [19, "Position"], [20, "Information"]] },
  { header: "Brand Label & Care Label", rows: [[22, "Presence"], [23, "Position"], [24, "Information"]] },
  { header: "Inner Pack / Polybag Label", rows: [[26, "Presence"], [27, "Position"], [28, "Information"]] },
  { header: "Photo Insert / Text Insert", rows: [[30, "Presence"], [31, "Position"], [32, "Information"]] },
  { header: "Other Label or Tag", rows: [[34, "Presence"], [35, "Position"], [36, "Information"]] },
];

const PACKING_MATRIX = [
  { row: 0, label: "Bag Description", options: ["PL", "PE", "LDPE", "PVC", "PEVA", "Fabric", "Others"] },
  { row: 1, label: "Bag Closures", options: ["Self-Adhesive", "Studs", "Buttons", "Poppers", "Zipper", "Branded", "Non-Branded", "Others"] },
  { row: 2, label: "Certification", options: ["PROP-65", "BE", "Others", "NA"] },
  { row: 3, label: "Inlay Card", options: ["U/J Shape", "Hang Tag", "Belly Band/Banderole", "Book Fold", "Insert", "Header with Hanger", "OTHERS"] },
  { row: 4, label: "Stickers & Barcode (1)", options: ["Size", "Break Pack", "Barcode", "Poly Bag", "Holograms"] },
  { row: 5, label: "Stickers & Barcode (2)", options: ["Pre-Tickets", "Kimball Labels", "Price Stickers", "Printed Safety & Recycled Logo"] },
  { row: 6, label: "Pack Description", options: ["Individual", "Set", "Master Poly", "Inner as Poly Bag", "Zipper Closure", "String / Draw Cord", "Other Closures"] },
  { row: 7, label: "Inner Pack", options: ["Polybag Holes", "Polybag Suffocation Warning", "Inner Pack Marking/Sticker"] },
  { row: 8, label: "Stiffener", options: ["3 Ply", "5 Ply", "White", "Brown", "Cutting Protector: YES", "NO"] },
  { row: 9, label: "Shipping Carton", options: ["Carton Ply: 5 Ply", "Carton Poly Lining: YES", "NO", "Printed", "Non-Printed"] },
  { row: 10, label: "Shipping Marks", options: ["Printed on Carton", "Carton Stickers", "4 Side", "2 Side"] },
  { row: 11, label: "Pallets", options: ["Wooden", "Corrugated", "PDQ / No of Pieces/Sets", "Others"] },
];

const LAB_TEST_ROWS = [
  { key: "lab_test_exist", label: "Lab Test Exist" },
  { key: "lab_report_reviewed", label: "Lab Report Reviewed" },
  { key: "lab_report_per_protocols", label: "Lab Report as per Protocols" },
  { key: "any_deviation", label: "Any Deviation" },
];

function renderChecklistsTab() {
  const canEdit = state.user.role === "admin";
  const sr = state.currentReport.standards_reference || {};
  const srOptions = [
    ["provided_office", "Provided by Customer (Cot-House)"],
    ["provided_supplier", "Provided by Customer to Supplier"],
    ["suppliers_counter", "Supplier's Counter/Record"],
    ["not_available", "Not Available"],
    ["with_auth", "WITH Customer Authentication"],
    ["without_auth", "WITHOUT Customer Authentication"],
  ];
  const srRows = ["reference_samples", "specification_file"].map(key => `
    <div style="margin-bottom:10px;">
      <label>${key === "reference_samples" ? "Reference Samples" : "Specification File/Details"}</label>
      <select data-sr="${key}" ${canEdit ? "" : "disabled"}>
        <option value="">— select —</option>
        ${srOptions.map(([v, l]) => `<option value="${v}" ${sr[key] === v ? "selected" : ""}>${l}</option>`).join("")}
      </select>
    </div>`).join("");

  const ml = state.currentReport.marking_labeling || {};
  const mlHtml = ML_GROUPS.map(g => `
    <h3>${g.header}</h3>
    ${g.rows.map(([row, label]) => {
      const cur = ml[row] || {};
      return `
      <div style="margin-bottom:8px;">
        <label style="margin-bottom:2px;">${label}</label>
        <div class="status-select-row">
          ${["conform", "not_conform", "na"].map(v => `<label><input type="radio" name="ml-${row}" value="${v}" ${cur.mark === v ? "checked" : ""} ${canEdit ? "" : "disabled"}> ${v === "not_conform" ? "NOT CONFORM" : v.toUpperCase()}</label>`).join("")}
          <input type="text" placeholder="Observation" data-ml-obs="${row}" value="${cur.observation ?? ""}" style="flex:1;min-width:100px;">
        </div>
      </div>`;
    }).join("")}
  `).join("");

  const lt = state.currentReport.lab_test || {};
  const ltHtml = LAB_TEST_ROWS.map(r => {
    const cur = lt[r.key] || {};
    return `
    <div style="margin-bottom:8px;">
      <label style="margin-bottom:2px;">${r.label}</label>
      <div class="status-select-row">
        ${["yes", "no", "na", "equip_na"].map(v => `<label><input type="radio" name="lt-${r.key}" value="${v}" ${cur.mark === v ? "checked" : ""} ${canEdit ? "" : "disabled"}> ${v === "equip_na" ? "EQUIP N/A" : v.toUpperCase()}</label>`).join("")}
        <input type="text" placeholder="Remark" data-lt-obs="${r.key}" value="${cur.remark ?? ""}" style="flex:1;min-width:100px;">
      </div>
    </div>`;
  }).join("");
  const resCur = lt.result || {};
  const ltResultHtml = `
    <div style="margin-bottom:8px; margin-top:16px; border-top: 1px solid var(--border); padding-top: 10px;">
      <label style="margin-bottom:2px; font-weight: 600;">Result (Under Commercial Tolerance or Not)</label>
      <div class="status-select-row">
        ${["yes", "no"].map(v => `<label><input type="radio" name="lt-result" value="${v}" ${resCur.mark === v ? "checked" : ""} ${canEdit ? "" : "disabled"}> ${v === "yes" ? "PASS" : "FAIL"}</label>`).join("")}
      </div>
    </div>`;

  const pm = state.currentReport.packing_matrix || {};
  const pmHtml = PACKING_MATRIX.map(g => {
    const cur = pm[g.row] || [];
    return `
    <div style="margin-bottom:12px;">
      <label style="font-weight: 600; margin-bottom:4px;">${g.label}</label>
      <div style="display: flex; flex-wrap: wrap; gap: 12px;">
        ${g.options.map((opt, i) => `<label style="display:flex; align-items:center; gap: 4px; font-size: 0.85rem;"><input type="checkbox" name="pm-${g.row}" value="${i}" ${cur.includes(i) ? "checked" : ""} ${canEdit ? "" : "disabled"}> ${opt}</label>`).join("")}
      </div>
    </div>`;
  }).join("");

  return `
  <div class="card">
    <h2>Standards & Reference ${canEdit ? "" : "(admin only)"}</h2>
    ${srRows}
    ${canEdit ? `<div class="row-actions"><button class="btn-primary" id="save-standards-ref">Save</button></div>` : ""}
  </div>
  <div class="card">
    <h2>Marking & Labeling Checklist ${canEdit ? "" : "(admin only)"}</h2>
    ${mlHtml}
    ${canEdit ? `<div class="row-actions"><button class="btn-primary" id="save-marking">Save</button></div>` : ""}
  </div>
  <div class="card">
    <h2>Lab Test Report ${canEdit ? "" : "(admin only)"}</h2>
    ${ltHtml}
    ${ltResultHtml}
    ${canEdit ? `<div class="row-actions"><button class="btn-primary" id="save-lab-test">Save</button></div>` : ""}
  </div>
  <div class="card">
    <h2>Packing Matrix ${canEdit ? "" : "(admin only)"}</h2>
    ${pmHtml}
    ${canEdit ? `<div class="row-actions"><button class="btn-primary" id="save-packing-matrix">Save</button></div>` : ""}
  </div>`;
}

// --- Tab: AQL & Defects (QC) ---
const DEFECT_TAXONOMY = [
  "Uneven Stitch", "Open Seam", "Color Stain", "Off Registration", "Pleat",
  "Weaving Defect", "Hanging Thread", "Shade Within Set", "Stain",
  "Uncut Thread", "Puckering", "Touching",
];

function renderAqlTab() {
  const r = state.currentReport;
  const canEdit = state.user.role === "qc" || state.user.role === "admin";
  const defects = r.defects || {};
  const defectsHtml = DEFECT_TAXONOMY.map(label => {
    const d = defects[label] || {};
    return `
    <tr>
      <td>${label}</td>
      <td><input data-defect="${label}" data-f="major" value="${d.major ?? ""}" style="width:60px;" ${canEdit ? "" : "disabled"}></td>
      <td><input data-defect="${label}" data-f="minor" value="${d.minor ?? ""}" style="width:60px;" ${canEdit ? "" : "disabled"}></td>
    </tr>`;
  }).join("");
  const conclusion = r.conclusion || "PENDING";
  const meta = r.defects_meta || {};

  // Build AQL item description rows (auto-fallback to PO rows if not set)
  let rows = r.aql_rows || [];
  if (!rows.length && r.po_rows && r.po_rows.length) {
    rows = r.po_rows.map((po, idx) => ({
      item_description: po.item_description || meta.product || "",
      size: po.size || meta.size || "",
      sample_size: idx === 0 ? (meta.sample_size || "") : "",
      critical_found: idx === 0 ? "00" : "",
      critical_allowed: idx === 0 ? "00" : "",
      major_found: idx === 0 ? "0" : "",
      major_allowed: idx === 0 ? (meta.major_allowed || "") : "",
      minor_found: idx === 0 ? "0" : "",
      minor_allowed: idx === 0 ? (meta.minor_allowed || "") : "",
      pass_fail: idx === 0 ? "PASS" : ""
    }));
  }
  if (!rows.length) {
    rows = [{
      item_description: meta.product || "",
      size: meta.size || "",
      sample_size: meta.sample_size || "",
      critical_found: "00",
      critical_allowed: "00",
      major_found: "0",
      major_allowed: meta.major_allowed || "",
      minor_found: "0",
      minor_allowed: meta.minor_allowed || "",
      pass_fail: "PASS"
    }];
  }

  const aqlTableRowsHtml = rows.map((row, i) => `
    <tr>
      <td><input data-aql-i="${i}" data-f="item_description" value="${row.item_description ?? ""}" ${canEdit ? "" : "disabled"}></td>
      <td><input data-aql-i="${i}" data-f="size" value="${row.size ?? ""}" style="width:70px;" ${canEdit ? "" : "disabled"}></td>
      <td><input data-aql-i="${i}" data-f="sample_size" value="${row.sample_size ?? ""}" style="width:60px;" ${canEdit ? "" : "disabled"}></td>
      <td><input data-aql-i="${i}" data-f="critical_found" value="${row.critical_found ?? "00"}" style="width:50px;" ${canEdit ? "" : "disabled"}></td>
      <td><input data-aql-i="${i}" data-f="critical_allowed" value="${row.critical_allowed ?? "00"}" style="width:50px;" ${canEdit ? "" : "disabled"}></td>
      <td><input data-aql-i="${i}" data-f="major_found" value="${row.major_found ?? "0"}" style="width:50px;" ${canEdit ? "" : "disabled"}></td>
      <td><input data-aql-i="${i}" data-f="major_allowed" value="${row.major_allowed ?? ""}" style="width:50px;" ${canEdit ? "" : "disabled"}></td>
      <td><input data-aql-i="${i}" data-f="minor_found" value="${row.minor_found ?? "0"}" style="width:50px;" ${canEdit ? "" : "disabled"}></td>
      <td><input data-aql-i="${i}" data-f="minor_allowed" value="${row.minor_allowed ?? ""}" style="width:50px;" ${canEdit ? "" : "disabled"}></td>
      <td>
        <select data-aql-i="${i}" data-f="pass_fail" ${canEdit ? "" : "disabled"}>
          <option value="PASS" ${(row.pass_fail || "PASS") === "PASS" ? "selected" : ""}>PASS</option>
          <option value="FAIL" ${row.pass_fail === "FAIL" ? "selected" : ""}>FAIL</option>
        </select>
      </td>
      ${canEdit ? `<td><button class="icon-btn" data-del-aql="${i}">✕</button></td>` : ""}
    </tr>`).join("");

  return `
  <div class="card">
    <h2>Item Description & AQL Sampling Table ${canEdit ? "" : "(QC only)"}</h2>
    <p class="hint">Table rendered directly after PO Details in the Word report. You can manually edit or add rows below.</p>
    <div class="row-table-wrap">
      <table class="row-table" id="aql-rows-table">
        <thead>
          <tr>
            <th>Item Description</th>
            <th>Size</th>
            <th>Sample Size</th>
            <th>Crit Found</th>
            <th>Crit Allow</th>
            <th>Maj Found</th>
            <th>Maj Allow</th>
            <th>Min Found</th>
            <th>Min Allow</th>
            <th>Result</th>
            ${canEdit ? "<th></th>" : ""}
          </tr>
        </thead>
        <tbody>${aqlTableRowsHtml}</tbody>
      </table>
    </div>
    ${canEdit ? `<div class="row-actions" style="margin-top:8px;"><button class="btn-secondary" id="add-aql-row">+ Add Item Description row</button></div>` : ""}
  </div>

  <div class="card">
    <h2>AQL General Metadata</h2>
    <div class="grid2">
      ${field("Product", "meta-product", meta.product)}
      ${field("Size", "meta-size", meta.size)}
      ${field("Sample Size", "meta-sample_size", meta.sample_size)}
      ${field("Color", "meta-color", meta.color)}
      ${field("Major Defects Allowed", "meta-major_allowed", meta.major_allowed)}
      ${field("Minor Defects Allowed", "meta-minor_allowed", meta.minor_allowed)}
    </div>
    <h3>Defects found</h3>
    <p class="hint">Enter a count only for defect types actually observed — leave the rest blank. Totals and Pass/Fail are calculated automatically in the generated report.</p>
    <div class="row-table-wrap">
      <table class="row-table" id="defects-table">
        <thead><tr><th>Defect Type</th><th>Major</th><th>Minor</th></tr></thead>
        <tbody>${defectsHtml}</tbody>
      </table>
    </div>

    <h3>Inspection conclusion</h3>
    <div class="status-select-row">
      ${["CONFORM", "NOT CONFORM", "PENDING"].map(v => `
        <label><input type="radio" name="conclusion" value="${v}" ${conclusion === v ? "checked" : ""} ${canEdit ? "" : "disabled"}> ${v}</label>
      `).join("")}
    </div>
    ${canEdit ? `<div class="row-actions"><button class="btn-primary" id="save-aql">Save</button></div>` : ""}
  </div>`;
}

// --- Tab: Measurements (QC) ---
function renderMeasurementsTab() {
  const canEdit = state.user.role === "qc" || state.user.role === "admin";
  let m = state.currentReport.measurements;
  if (!Array.isArray(m)) m = [];
  
  const opts = state.currentReport.measurement_options || {};
  const optionsHtml = `
    <div class="card" style="margin-bottom: 20px;">
      <h3 style="margin-top:0;">Measurement Options</h3>
      <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:center;">
        <label><input type="checkbox" id="mo-buyer" ${opts.buyer_chart ? "checked" : ""} ${canEdit ? "" : "disabled"}> Buyer Measurement Chart</label>
        <label><input type="checkbox" id="mo-supplier" ${opts.supplier_chart ? "checked" : ""} ${canEdit ? "" : "disabled"}> Supplier's Measurement Chart</label>
      </div>
      <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:center; margin-top:10px;">
        <label><input type="checkbox" id="mo-within" ${opts.within_tolerance ? "checked" : ""} ${canEdit ? "" : "disabled"}> Within Tolerance</label>
        <label><input type="checkbox" id="mo-beyond" ${opts.beyond_tolerance ? "checked" : ""} ${canEdit ? "" : "disabled"}> Beyond Tolerance</label>
        <label><input type="checkbox" id="mo-actual" ${opts.actual_findings ? "checked" : ""} ${canEdit ? "" : "disabled"}> Actual Findings</label>
      </div>
    </div>
  `;

  let groupedBlocks = [];
  let currentBlock = null;
  m.forEach(item => {
    if (item.type === "header") {
      currentBlock = { item_size: item.item_size, color: item.color, desc: "", rows: [] };
      groupedBlocks.push(currentBlock);
    } else if (item.type === "data") {
      if (!currentBlock) {
        currentBlock = { item_size: "", color: "", desc: item.desc, rows: [] };
        groupedBlocks.push(currentBlock);
      }
      if (!currentBlock.desc && item.desc) currentBlock.desc = item.desc;
      currentBlock.rows.push(item);
    }
  });

  const blocksHtml = groupedBlocks.map(block => {
    const points = ["Width", "Length", "Width", "Length"];
    const rowsHtml = points.map((pt, i) => {
      const rowData = block.rows[i] || {};
      let samples = "";
      for (let c=1; c<=10; c++) {
         samples += `<input placeholder="${c}" class="m-c${c}" value="${rowData['c'+c] || ""}" style="width:40px;" ${canEdit ? "" : "disabled"}>`;
      }
      return `
        <tr class="m-data-row" data-point="${pt}">
          <td>${pt}</td>
          <td><input placeholder="Spec" class="m-spec" value="${rowData.spec || ""}" style="width:60px;" ${canEdit ? "" : "disabled"}></td>
          <td style="display:flex;gap:2px;">${samples}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="m-block card" style="border:1px solid var(--border-color); padding:20px; margin-bottom:15px;">
        <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
           <input class="m-item-size" placeholder="Item & Size (e.g. 13320)" value="${block.item_size || ""}" style="width:180px;" ${canEdit ? "" : "disabled"}>
           <input class="m-color" placeholder="Color/Group (e.g. (Red))" value="${block.color || ""}" style="width:180px;" ${canEdit ? "" : "disabled"}>
           <input class="m-desc" placeholder="Desc (e.g. Duvet Set)" value="${block.desc || ""}" style="width:180px;" ${canEdit ? "" : "disabled"}>
           ${canEdit ? `<button class="btn-danger btn-sm" onclick="this.closest('.m-block').remove()">X Remove Block</button>` : ""}
        </div>
        <div class="row-table-wrap">
          <table class="row-table">
             <thead><tr><th style="width:80px;">Point</th><th style="width:80px;">Spec</th><th>Samples 1-10</th></tr></thead>
             <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join("");

  return `
  <div class="card">
    <h2>Measurements ${canEdit ? "" : "(QC only)"}</h2>
    ${optionsHtml}
    <div id="measurements-container" style="margin-bottom:15px;overflow-x:auto;">
      ${blocksHtml}
    </div>
    ${canEdit ? `
    <div style="margin-bottom:15px;">
      <button class="btn-secondary" onclick="addMeasurementBlock()">+ Add Measurement Block</button>
    </div>
    <div class="row-actions"><button class="btn-primary" id="save-measurements">Save</button></div>
    ` : ""}
  </div>`;
}

window.addMeasurementBlock = function() {
  const container = document.getElementById("measurements-container");
  const div = document.createElement("div");
  div.className = "m-block card";
  div.style.cssText = "border:1px solid var(--border-color); padding:20px; margin-bottom:15px;";
  
  const points = ["Width", "Length", "Width", "Length"];
  const rowsHtml = points.map(pt => {
    let samples = "";
    for (let c=1; c<=10; c++) samples += `<input placeholder="${c}" class="m-c${c}" style="width:40px;">`;
    return `
      <tr class="m-data-row" data-point="${pt}">
        <td>${pt}</td>
        <td><input placeholder="Spec" class="m-spec" style="width:60px;"></td>
        <td style="display:flex;gap:2px;">${samples}</td>
      </tr>
    `;
  }).join("");

  div.innerHTML = `
    <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
       <input class="m-item-size" placeholder="Item & Size (e.g. 13320)" style="width:180px;">
       <input class="m-color" placeholder="Color/Group (e.g. (Red))" style="width:180px;">
       <input class="m-desc" placeholder="Desc (e.g. Duvet Set)" style="width:180px;">
       <button class="btn-danger btn-sm" onclick="this.closest('.m-block').remove()">X Remove Block</button>
    </div>
    <div class="row-table-wrap">
      <table class="row-table">
         <thead><tr><th style="width:80px;">Point</th><th style="width:80px;">Spec</th><th>Samples 1-10</th></tr></thead>
         <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
  container.appendChild(div);
};

// --- Tab: Onsite Tests & Shrinkage (QC) ---
function renderTestsTab() {
  const canEdit = state.user.role === "qc" || state.user.role === "admin";
  const ot = state.currentReport.onsite_tests || {};
  const tests = [
    ["needle_detection", "Needle Detection"],
    ["metal_detector", "Metal Detector"],
    ["carton_drop_test", "Carton Drop Test"],
    ["gsm", "GSM"],
    ["barcode_scan", "Barcode Scan"],
  ];
  const testsHtml = tests.map(([key, label]) => {
    const cur = ot[key] || {};
    return `
    <div style="margin-bottom:10px;">
      <label>${label}</label>
      <div class="status-select-row">
        ${["pass", "fail", "na"].map(v => `<label><input type="radio" name="ot-${key}" value="${v}" ${cur.mark === v ? "checked" : ""} ${canEdit ? "" : "disabled"}> ${v.toUpperCase()}</label>`).join("")}
        <input type="text" placeholder="Remark" data-remark="${key}" value="${cur.remark ?? ""}" style="flex:1;min-width:100px;">
      </div>
    </div>`;
  }).join("");

  let shrink = state.currentReport.shrinkage;
  if (!Array.isArray(shrink)) shrink = [];

  let shrinkGroups = [];
  let currentShrink = null;
  shrink.forEach(item => {
    if (item.type === "header") {
      currentShrink = { color: item.color, rows: [] };
      shrinkGroups.push(currentShrink);
    } else if (item.type === "data") {
      if (!currentShrink) {
        currentShrink = { color: "", rows: [] };
        shrinkGroups.push(currentShrink);
      }
      currentShrink.rows.push(item);
    }
  });

  const shrinkBlocksHtml = shrinkGroups.map(block => {
    const points = ["Width", "Length", "Width", "Length"];
    const rowsHtml = points.map((pt, i) => {
      const rowData = block.rows[i] || {};
      return `
        <tr class="s-data-row" data-point="${pt}">
          <td>${pt}</td>
          <td><input placeholder="Before" class="s-before" type="number" step="0.01" value="${rowData.before || ""}" style="width:70px;" ${canEdit ? "" : "disabled"} oninput="calcShrinkage(this)"></td>
          <td><input placeholder="After" class="s-after" type="number" step="0.01" value="${rowData.after || ""}" style="width:70px;" ${canEdit ? "" : "disabled"} oninput="calcShrinkage(this)"></td>
          <td><input placeholder="%" class="s-pct" value="${rowData.pct || ""}" style="width:70px;" ${canEdit ? "" : "disabled"}></td>
        </tr>
      `;
    }).join("");

    return `
      <div class="s-block card" style="border:1px solid var(--border-color); padding:20px; margin-bottom:15px;">
        <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
           <input class="s-color" placeholder="Color/Group (e.g. Red)" value="${block.color || ""}" style="width:180px;" ${canEdit ? "" : "disabled"}>
           ${canEdit ? `<button class="btn-danger btn-sm" onclick="this.closest('.s-block').remove()">X Remove Block</button>` : ""}
        </div>
        <div class="row-table-wrap">
          <table class="row-table">
             <thead><tr><th>Point</th><th>Before Wash (cm)</th><th>After Wash (cm)</th><th>Shrinkage %</th></tr></thead>
             <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join("");

  return `
  <div class="card">
    <h2>Onsite Tests ${canEdit ? "" : "(QC only)"}</h2>
    ${testsHtml}
    ${canEdit ? `<div class="row-actions"><button class="btn-primary" id="save-tests">Save</button></div>` : ""}
  </div>
  <div class="card">
    <h2>Shrinkage Test ${canEdit ? "" : "(QC only)"}</h2>
    <div id="shrinkage-container" style="margin-bottom:15px;overflow-x:auto;">
      ${shrinkBlocksHtml}
    </div>
    ${canEdit ? `
    <div style="margin-bottom:15px;">
      <button class="btn-secondary" onclick="addShrinkageBlock()">+ Add Shrinkage Block</button>
    </div>
    <div class="row-actions"><button class="btn-primary" id="save-shrinkage">Save Shrinkage</button></div>
    ` : ""}
  </div>`;
}

window.calcShrinkage = function(inputElement) {
  const tr = inputElement.closest("tr");
  const before = parseFloat(tr.querySelector(".s-before").value);
  const after = parseFloat(tr.querySelector(".s-after").value);
  if (!isNaN(before) && !isNaN(after) && before !== 0) {
    const pct = (((after - before) / before) * 100).toFixed(2);
    tr.querySelector(".s-pct").value = pct + "%";
  } else {
    tr.querySelector(".s-pct").value = "";
  }
};

window.addShrinkageBlock = function() {
  const container = document.getElementById("shrinkage-container");
  const div = document.createElement("div");
  div.className = "s-block card";
  div.style.cssText = "border:1px solid var(--border-color); padding:20px; margin-bottom:15px;";
  
  const points = ["Width", "Length", "Width", "Length"];
  const rowsHtml = points.map(pt => {
    return `
      <tr class="s-data-row" data-point="${pt}">
        <td>${pt}</td>
        <td><input placeholder="Before" class="s-before" type="number" step="0.01" style="width:70px;" oninput="calcShrinkage(this)"></td>
        <td><input placeholder="After" class="s-after" type="number" step="0.01" style="width:70px;" oninput="calcShrinkage(this)"></td>
        <td><input placeholder="%" class="s-pct" style="width:70px;"></td>
      </tr>
    `;
  }).join("");

  div.innerHTML = `
    <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
       <input class="s-color" placeholder="Color/Group (e.g. Red)" style="width:180px;">
       <button class="btn-danger btn-sm" onclick="this.closest('.s-block').remove()">X Remove Block</button>
    </div>
    <div class="row-table-wrap">
      <table class="row-table">
         <thead><tr><th>Point</th><th>Before Wash (cm)</th><th>After Wash (cm)</th><th>Shrinkage %</th></tr></thead>
         <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
  container.appendChild(div);
};

// --- Tab: Photos (QC) ---
const PHOTO_SECTION_LABELS = {
  standards_photos: "Standards vs Production",
  packing_photos: "Packing",
  defect_photos: "Defects",
  measurement_photos: "Measurements",
  presentation_photos: "Presentation",
  shrinkage_photos: "Shrinkage",
};

async function ensurePhotoSlots() {
  if (state.photoSlots) return state.photoSlots;
  const res = await api("/reports/photo-slots");
  state.photoSlots = res.slots;
  return state.photoSlots;
}

function renderPhotosTab() {
  if (!state.photoSlots) {
    ensurePhotoSlots().then(() => render());
    return `<div class="card"><div class="loading">Loading photo slots…</div></div>`;
  }
  const photos = state.currentReport.photos || [];
  const sections = Object.entries(state.photoSlots).map(([sectionKey, slots]) => {
    const slotsHtml = slots.map(slot => {
      const existing = photos.find(p => p.section === sectionKey && p.row === slot.row && p.col === slot.col);
      const title = existing?.title ?? slot.default_title;
      const thumb = existing
        ? `<div class="photo-thumb-large">
             <img src="${existing.url}">
             <button class="del-btn" data-photo-id="${existing.id}">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
             </button>
           </div>`
        : `<label class="upload-zone">
             <div class="upload-icon">
               <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
             </div>
             <span class="upload-text">Click to upload photo</span>
             <input type="file" accept="image/*" capture="environment"
               data-upload-section="${sectionKey}" data-upload-row="${slot.row}" data-upload-col="${slot.col}">
           </label>`;
      return `
      <div class="photo-card">
        ${thumb}
        <div class="photo-details">
          <label style="margin-top:0;">Photo Description</label>
          <input type="text" class="photo-title-input" value="${title}"
            data-title-section="${sectionKey}" data-title-row="${slot.row}" data-title-col="${slot.col}"
            placeholder="What does this photo show?">
        </div>
      </div>`;
    }).join("");
    return `
    <div class="photo-section">
      <h3 style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">${PHOTO_SECTION_LABELS[sectionKey] || sectionKey}</h3>
      <div class="photo-grid-fancy">
        ${slotsHtml}
      </div>
    </div>`;
  }).join("");
  return `
  <div class="card">
    <h2>Photos</h2>
    <p class="hint">Upload visual proof for the report. Each section perfectly maps to your generated Word document.</p>
    ${sections}
  </div>`;
}

// ---------------- BIND WIZARD ----------------
function bindReportWizard() {
  bindTopbarCommon();
  document.querySelectorAll(".step-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.currentTab = btn.dataset.tab;
      render();
    });
  });
  document.getElementById("generate-btn").addEventListener("click", generateReport);
  bindTabContent();
}

async function saveSection(section, data) {
  try {
    await api(`/reports/${state.currentReport.id}/section`, {
      method: "PATCH",
      body: JSON.stringify({ section, data }),
    });
    toast("Saved");
    const r = await api(`/reports/${state.currentReport.id}`);
    state.currentReport = r;
  } catch (e) {
    toast(e.message);
  }
}

function bindTabContent() {
  const t = state.currentTab;

  if (t === "info") {
    const btn = document.getElementById("save-info");
    if (btn) btn.addEventListener("click", async () => {
      const ids = ["report_no", "customer_name", "destination_country", "inspection_type",
        "inspection_date", "manufacturer_name", "inspection_location", "factory_rep_name",
        "inspector_names", "arrival_time", "departure_time"];
      const data = {};
      ids.forEach(id => data[id] = document.getElementById("h-" + id).value);
      await saveSection("header_info", data);
      render();
    });
  }

  if (t === "product") {
    document.getElementById("save-product-category")?.addEventListener("click", async () => {
      const ids = ["category_description", "category", "fabric_required", "fabric_found", "poly_required", "poly_found"];
      const data = {};
      ids.forEach(id => data[id] = document.getElementById("pc-" + id).value);
      await saveSection("product_category", data);
      render();
    });
    document.getElementById("add-po-row")?.addEventListener("click", () => {
      state.currentReport.po_rows = state.currentReport.po_rows || [];
      state.currentReport.po_rows.push({});
      render();
    });
    document.querySelectorAll("#po-table [data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.currentReport.po_rows.splice(parseInt(btn.dataset.del), 1);
        render();
      });
    });
    document.getElementById("save-po")?.addEventListener("click", async () => {
      const rows = [...(state.currentReport.po_rows || [])];
      document.querySelectorAll("#po-table input").forEach(inp => {
        const i = parseInt(inp.dataset.i), f = inp.dataset.f;
        rows[i] = rows[i] || {};
        rows[i][f] = inp.value;
      });
      await saveSection("po_rows", rows);
      render();
    });
  }

    if (t === "checklists") {
    document.getElementById("save-standards-ref")?.addEventListener("click", async () => {
      const data = {};
      document.querySelectorAll("[data-sr]").forEach(sel => { data[sel.dataset.sr] = sel.value; });
      await saveSection("standards_reference", data);
      render();
    });
    document.getElementById("save-marking")?.addEventListener("click", async () => {
      const ml = {};
      ML_GROUPS.forEach(g => g.rows.forEach(([row]) => {
        const mark = document.querySelector(`input[name="ml-${row}"]:checked`)?.value;
        const observation = document.querySelector(`[data-ml-obs="${row}"]`)?.value;
        ml[row] = { mark, observation };
      }));
      await saveSection("marking_labeling", ml);
      render();
    });
    document.getElementById("save-lab-test")?.addEventListener("click", async () => {
      const lt = {};
      [...LAB_TEST_ROWS.map(r => r.key), "result"].forEach(key => {
        const mark = document.querySelector(`input[name="lt-${key}"]:checked`)?.value;
        const remark = document.querySelector(`[data-lt-obs="${key}"]`)?.value || "";
        lt[key] = { mark, remark };
      });
      await saveSection("lab_test", lt);
      render();
    });
    document.getElementById("save-packing-matrix")?.addEventListener("click", async () => {
      const pm = {};
      PACKING_MATRIX.forEach(g => {
        const selected = Array.from(document.querySelectorAll(`input[name="pm-${g.row}"]:checked`)).map(cb => parseInt(cb.value));
        if (selected.length > 0) pm[g.row] = selected;
      });
      await saveSection("packing_matrix", pm);
      render();
    });
  }

  if (t === "aql") {
    document.getElementById("add-aql-row")?.addEventListener("click", () => {
      state.currentReport.aql_rows = state.currentReport.aql_rows || [];
      state.currentReport.aql_rows.push({
        item_description: "", size: "", sample_size: "",
        critical_found: "00", critical_allowed: "00",
        major_found: "0", major_allowed: "",
        minor_found: "0", minor_allowed: "", pass_fail: "PASS"
      });
      render();
    });

    document.getElementById("aql-rows-table")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-del-aql]");
      if (btn) {
        state.currentReport.aql_rows = state.currentReport.aql_rows || [];
        state.currentReport.aql_rows.splice(parseInt(btn.dataset.delAql), 1);
        render();
      }
    });

    document.getElementById("save-aql")?.addEventListener("click", async () => {
      const defects = {};
      let totalMajor = 0;
      let totalMinor = 0;
      document.querySelectorAll("#defects-table [data-defect]").forEach(inp => {
        const label = inp.dataset.defect, f = inp.dataset.f;
        defects[label] = defects[label] || {};
        defects[label][f] = inp.value;
        const val = parseInt(inp.value, 10) || 0;
        if (f === "major") totalMajor += val;
        if (f === "minor") totalMinor += val;
      });
      await saveSection("defects", defects);

      const meta = {};
      ["product", "size", "sample_size", "color", "major_allowed", "minor_allowed"].forEach(k => {
        meta[k] = document.getElementById("meta-" + k)?.value || "";
      });
      await saveSection("defects_meta", meta);

      const aqlRows = [];
      document.querySelectorAll("#aql-rows-table tbody tr").forEach(tr => {
        const getVal = f => tr.querySelector(`[data-f="${f}"]`)?.value || "";
        aqlRows.push({
          item_description: getVal("item_description"),
          size: getVal("size"),
          sample_size: getVal("sample_size"),
          critical_found: getVal("critical_found") || "00",
          critical_allowed: getVal("critical_allowed") || "00",
          major_found: getVal("major_found") || "0",
          major_allowed: getVal("major_allowed") || "",
          minor_found: getVal("minor_found") || "0",
          minor_allowed: getVal("minor_allowed") || "",
          pass_fail: getVal("pass_fail") || "PASS"
        });
      });
      state.currentReport.aql_rows = aqlRows;
      await saveSection("aql_rows", aqlRows);

      const conclusion = document.querySelector('input[name="conclusion"]:checked')?.value || "PENDING";
      await saveSection("conclusion", conclusion);
      render();
    });
  }

  if (t === "measurements") {
    document.getElementById("save-measurements")?.addEventListener("click", async () => {
      const opts = {
        buyer_chart: document.getElementById("mo-buyer").checked,
        supplier_chart: document.getElementById("mo-supplier").checked,
        within_tolerance: document.getElementById("mo-within").checked,
        beyond_tolerance: document.getElementById("mo-beyond").checked,
        actual_findings: document.getElementById("mo-actual").checked,
      };
      await saveSection("measurement_options", opts);

      const arr = [];
      document.querySelectorAll("#measurements-container .m-block").forEach(block => {
        arr.push({
          type: "header",
          item_size: block.querySelector(".m-item-size").value,
          color: block.querySelector(".m-color").value
        });
        const desc = block.querySelector(".m-desc").value;
        block.querySelectorAll(".m-data-row").forEach(row => {
          const item = {
            type: "data",
            desc: desc,
            point: row.dataset.point,
            spec: row.querySelector(".m-spec").value
          };
          for (let c=1; c<=10; c++) {
            item["c"+c] = row.querySelector(".m-c"+c).value;
          }
          arr.push(item);
        });
      });
      await saveSection("measurements", arr);
      render();
    });
  }

  if (t === "tests") {
    document.getElementById("save-tests")?.addEventListener("click", async () => {
      const ot = {};
      ["needle_detection", "metal_detector", "carton_drop_test", "gsm", "barcode_scan"].forEach(key => {
        const mark = document.querySelector(`input[name="ot-${key}"]:checked`)?.value;
        const remark = document.querySelector(`[data-remark="${key}"]`)?.value;
        ot[key] = { mark, remark };
      });
      await saveSection("onsite_tests", ot);
      render();
    });
    document.getElementById("save-shrinkage")?.addEventListener("click", async () => {
      const arr = [];
      document.querySelectorAll("#shrinkage-container .s-block").forEach(block => {
        arr.push({
          type: "header",
          color: block.querySelector(".s-color").value
        });
        block.querySelectorAll(".s-data-row").forEach(row => {
          arr.push({
            type: "data",
            point: row.dataset.point,
            before: row.querySelector(".s-before").value,
            after: row.querySelector(".s-after").value,
            pct: row.querySelector(".s-pct").value
          });
        });
      });
      await saveSection("shrinkage", arr);
      render();
    });
  }

  if (t === "photos") {
    document.querySelectorAll("[data-upload-section]").forEach(inp => {
      inp.addEventListener("change", async (e) => {
        const section = inp.dataset.uploadSection;
        const row = inp.dataset.uploadRow;
        const col = inp.dataset.uploadCol;
        const titleInput = document.querySelector(
          `[data-title-section="${section}"][data-title-row="${row}"][data-title-col="${col}"]`
        );
        const title = titleInput ? titleInput.value : "";
        const file = e.target.files[0];
        if (!file) return;
        const form = new FormData();
        form.append("section", section);
        form.append("row", row);
        form.append("col", col);
        form.append("title", title);
        form.append("file", file);
        try {
          await api(`/reports/${state.currentReport.id}/photos`, { method: "POST", body: form });
        } catch (err) {
          toast(err.message);
        }
        const r = await api(`/reports/${state.currentReport.id}`);
        state.currentReport = r;
        render();
      });
    });
    document.querySelectorAll(".photo-title-input").forEach(inp => {
      inp.addEventListener("change", async () => {
        const section = inp.dataset.titleSection, row = inp.dataset.titleRow, col = inp.dataset.titleCol;
        const existing = (state.currentReport.photos || []).find(
          p => p.section === section && String(p.row) === row && String(p.col) === col
        );
        if (!existing) return; // no photo uploaded yet at this slot -- title is just staged for next upload
        const form = new FormData();
        form.append("title", inp.value);
        try {
          await api(`/reports/photo/${existing.id}/title`, { method: "PATCH", body: form });
          toast("Title updated");
        } catch (err) {
          toast(err.message);
        }
      });
    });
    document.querySelectorAll("[data-photo-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await api(`/reports/photo/${btn.dataset.photoId}`, { method: "DELETE" });
        const r = await api(`/reports/${state.currentReport.id}`);
        state.currentReport = r;
        render();
      });
    });
  }
}

async function generateReport() {
  try {
    toast("Generating…");
    const res = await fetch(`${API}/reports/${state.currentReport.id}/generate`, {
      method: "POST",
      headers: { Authorization: "Bearer " + state.token },
    });
    if (!res.ok) throw new Error("Generation failed");
    const data = await res.json();
    window.location.href = data.download_url;
    toast("Report generated and downloading...");
    const r = await api(`/reports/${state.currentReport.id}`);
    state.currentReport = r;
    render();
  } catch (e) {
    toast(e.message);
  }
}

init();
