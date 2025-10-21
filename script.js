
 /*  ===================================================== */

/* ===== إعدادات JSONBIN ===== */
const USERS_BIN_ID = "68d9751a43b1c97be9533ff7"; // ضع هنا Bin المستخدمين
const ATTENDANCE_BIN_ID = "68f78b53ae596e708f219ecc"; // ضع هنا Bin الحضور
const API_KEY = "$2a$10$wTX4NeG7hamsQFvPqAi37ukVtUMqnK.yKu9lCAlWXjENFkEvMsPwe"; // ضع هنا X-Master-Key

/* ===== دوال مساعدة ===== */
const $ = (id) => document.getElementById(id);
function toast(msg, time = 3000) {
  const t = $("att-toast");
  t.innerText = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), time);
}

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}
function fmtMonthLabel(year, month) {
  return `${month + 1}/${year}`;
}

function getFridaysOfMonth(year, month) {
  const fridays = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() === 5) fridays.push(d.getDate());
    d.setDate(d.getDate() + 1);
  }
  return fridays;
}
function getDaysOfMonth(year, month) {
  const days = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(d.getDate());
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/* ===== التعامل مع JSONBin ===== */
async function fetchBin(binId) {
  if (!binId || !API_KEY) {
    const data = localStorage.getItem("mock_" + binId);
    return data ? JSON.parse(data) : [];
  }
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { "X-Master-Key": API_KEY }
    });
    const j = await r.json();
    return j.record || [];
  } catch (e) {
    console.error(e);
    return [];
  }
}
async function saveBin(binId, data) {
  if (!binId || !API_KEY) {
    localStorage.setItem("mock_" + binId, JSON.stringify(data));
    return true;
  }
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY },
      body: JSON.stringify(data)
    });
    return r.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

/* ===== تحميل وتخزين بيانات الحضور ===== */
async function loadAttendance(stage, year, month) {
  const key = monthKey(year, month);
  const all = await fetchBin(ATTENDANCE_BIN_ID);
  const rec = all.find((r) => r.stage === stage && r.month === key);
  if (rec) return rec;
  return {
    stage,
    month: key,
    attendance: [],
    behavior: [],
    interaction: [],
    visitations: [],
    subadminsAttendance: [],
    meta: {}
  };
}
async function saveAttendance(record) {
  const all = (await fetchBin(ATTENDANCE_BIN_ID)) || [];
  const idx = all.findIndex(
    (r) => r.stage === record.stage && r.month === record.month
  );
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  await saveBin(ATTENDANCE_BIN_ID, all);
}

/* ===== المستخدمين ===== */
async function getUsers() {
  return await fetchBin(USERS_BIN_ID);
}
async function getUsersByStage(stage) {
  const u = await getUsers();
  return u.filter((x) => x.role === "user" && x.stage === stage);
}
async function getSubadmins() {
  const u = await getUsers();
  return u.filter((x) => x.role === "subadmin");
}

/* ===== الحالة العامة للتطبيق ===== */
let currentUser = null;
const state = { viewOffset: 0, stage: null };

/* ===== تهيئة التطبيق ===== */
document.addEventListener("DOMContentLoaded", () => {
  $("btn-login").onclick = login;
  $("btn-logout").onclick = () => {
  currentUser = null;
  state.stage = null;
  state.viewOffset = 0;
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  $("attendance-app").classList.add("hidden");
  $("auth-screen").classList.remove("hidden");
  $("login-username").value = "";
  $("login-password").value = "";
  toast("👋 تم تسجيل الخروج بنجاح");
};

  $("btn-prev-month").onclick = () => {
    state.viewOffset--;
    renderView();
  };
  $("btn-go-current").onclick = () => {
    state.viewOffset = 0;
    renderView();
  };
  $("sub-save").onclick = saveSubData;
  $("sub-export-excel").onclick = () =>
    exportExcel("#sub-table-wrap table", "sub");
  $("admin-save").onclick = saveAdminData;
  $("admin-export-excel").onclick = () => exportExcel("#admin-tables", "admin");
  $("admin-chart").onclick = toggleChart;
});

/* ===== تسجيل الدخول ===== */
async function login() {
  const u = $("login-username").value.trim();
  const p = $("login-password").value.trim();
  if (!u || !p) return toast("⚠️ أدخل الاسم وكلمة السر");
  const users = await getUsers();
  const found = users.find((x) => x.username === u && x.password === p);
  if (!found) return toast("❌ خطأ في الدخول");
  currentUser = found;
  afterLogin();
}
async function demoLogin() {
  const demo = [
    { username: "admin", password: "123", role: "admin" },
    { username: "sub", password: "123", role: "subadmin", stage: "مرحلة أولى" },
    { username: "user", password: "123", role: "user", stage: "مرحلة أولى" }
  ];
  await saveBin(USERS_BIN_ID, demo);
  toast("✅ حسابات تجريبية (admin/sub/user) كلمة السر: 123");
  currentUser = demo[0];
  afterLogin();
}

/* ===== بعد الدخول ===== */
async function afterLogin() {
  $("auth-screen").classList.add("hidden");
  $("attendance-app").classList.remove("hidden");
  await renderView();
}

/* ===== حساب الشهر الحالي ===== */
function getYM() {
  const d = new Date();
  d.setMonth(d.getMonth() + state.viewOffset);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/* ===== عرض الشاشات حسب الدور ===== */
async function renderView() {
  const v = $("view-container").querySelectorAll(".view");
  v.forEach((x) => x.classList.add("hidden"));
  $("btn-go-current").classList.toggle("hidden", state.viewOffset === 0);

  if (currentUser.role === "user") {
    await renderUser();
  }
  if (currentUser.role === "subadmin") {
    await renderSub();
  }
  if (currentUser.role === "admin") {
    await renderAdmin();
  }
}

/* ===== شاشة المستخدم ===== */
async function renderUser() {
  $("user-view").classList.remove("hidden");
  const { year, month } = getYM();
  $("view-month-label").innerText = fmtMonthLabel(year, month);
  const fridays = getFridaysOfMonth(year, month);
  const rec = await loadAttendance(currentUser.stage, year, month);

  const sections = ["attendance", "behavior", "interaction"];
  for (let sec of sections) {
    const wrap = $(`user-${sec}-table`);
    const users = await getUsersByStage(currentUser.stage);
    const map = {};
    (rec[sec] || []).forEach((r) => (map[r.username] = r.records));
    let html = `<table class="att-table"><thead><tr><th>الاسم</th>`;
    fridays.forEach((d) => (html += `<th>${d}</th>`));
    html += `</tr></thead><tbody>`;
    users.forEach((u) => {
      html += `<tr><td>${u.username}</td>`;
      fridays.forEach((d) => {
        const v = map[u.username]?.[d] || "";
        html +=
          v === "+"
            ? `<td class="cell-plus">+</td>`
            : v === "-"
            ? `<td class="cell-minus">-</td>`
            : `<td class="cell-empty">—</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;
  }
}

/* ===== شاشة الخادم ===== */
async function renderSub() {
  $("subadmin-view").classList.remove("hidden");
  const { year, month } = getYM();
  const fridays = getFridaysOfMonth(year, month);
  const daysAll = getDaysOfMonth(year, month);
  const tabs = document.querySelectorAll("#sub-tabs .tab-btn");
  tabs.forEach((btn) => {
    btn.onclick = () => {
      tabs.forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      renderSub();
    };
  });
  const activeTab = document.querySelector("#sub-tabs .tab-btn.active").dataset
    .tab;
  const days = activeTab === "visitations" ? daysAll : fridays;
  const rec = await loadAttendance(currentUser.stage, year, month);
  if (!rec[activeTab]) rec[activeTab] = [];
  const map = {};
  rec[activeTab].forEach((x) => (map[x.username] = x.records));
  const users = await getUsersByStage(currentUser.stage);
  users.forEach((u) => {
    if (!map[u.username]) map[u.username] = {};
  });

  let html = `<table class="att-table"><thead><tr><th>الاسم</th>`;
  days.forEach((d) => (html += `<th>${d}</th>`));
  html += `</tr></thead><tbody>`;
  users.forEach((u) => {
    html += `<tr><td>${u.username}</td>`;
    days.forEach((d) => {
      const v = map[u.username][d] || "";
      html += `<td data-user="${u.username}" data-day="${d}" class="${
        v === "+" ? "cell-plus" : v === "-" ? "cell-minus" : "cell-empty"
      }">${v || "—"}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  $("sub-table-wrap").innerHTML = html;
  $("sub-table-wrap").dataset.tab = activeTab;
  $("sub-table-wrap").dataset.map = JSON.stringify(map);

  $("sub-table-wrap")
    .querySelectorAll("td[data-user]")
    .forEach((td) => {
      td.onclick = () => {
        const u = td.dataset.user,
          d = td.dataset.day;
        const map = JSON.parse($("sub-table-wrap").dataset.map);
        const cur = map[u][d] || "";
        const next = cur === "" ? "+" : cur === "+" ? "-" : "";
        map[u][d] = next;
        $("sub-table-wrap").dataset.map = JSON.stringify(map);
        td.innerText = next || "—";
        td.className =
          next === "+"
            ? "cell-plus"
            : next === "-"
            ? "cell-minus"
            : "cell-empty";
      };
    });
}

/* ===== حفظ بيانات الخادم ===== */
async function saveSubData() {
  const tab = $("sub-table-wrap").dataset.tab;
  const map = JSON.parse($("sub-table-wrap").dataset.map);
  const { year, month } = getYM();
  const rec = await loadAttendance(currentUser.stage, year, month);
  rec[tab] = Object.keys(map).map((u) => ({ username: u, records: map[u] }));
  rec.meta.updatedBy = currentUser.username;
  rec.meta.updatedAt = new Date().toISOString();
  await saveAttendance(rec);
  toast("✅ تم حفظ البيانات بنجاح");
}

/* ===== شاشة الأدمن ===== */
async function renderAdmin() {
  $("admin-view").classList.remove("hidden");
  const { year, month } = getYM();
  const allUsers = await getUsers();
  const stages = [
    ...new Set(allUsers.filter((u) => u.stage).map((u) => u.stage))
  ];
  const sel = $("admin-stage-picker");
  sel.innerHTML = stages
    .map(
      (s) =>
        `<option value="${s}" ${
          s === state.stage ? "selected" : ""
        }>${s}</option>`
    )
    .join("");
  if (!state.stage) state.stage = stages[0];
  sel.onchange = () => {
    state.stage = sel.value;
    renderAdmin();
  };

  const fridays = getFridaysOfMonth(year, month);
  const alldays = getDaysOfMonth(year, month);
  const rec = await loadAttendance(state.stage, year, month);
  const sections = [
    { key: "attendance", label: "الحضور (أيام الجمعة)", days: fridays },
    { key: "behavior", label: "السلوك (أيام الجمعة)", days: fridays },
    { key: "interaction", label: "التفاعل (أيام الجمعة)", days: fridays },
    { key: "visitations", label: "الافتقاد (كل الأيام)", days: alldays },
    {
      key: "subadminsAttendance",
      label: "حضور الخدام (أيام الجمعة)",
      days: fridays
    }
  ];

  let html = "";
  for (let sec of sections) {
    html += await renderEditableTable(rec, sec);
  }
  $("admin-tables").innerHTML = html;
}

/* ===== جدول الأدمن قابل للتعديل ===== */
async function renderEditableTable(rec, sec) {
  const users =
    sec.key === "subadminsAttendance"
      ? await getSubadmins()
      : await getUsersByStage(state.stage);
  if (!rec[sec.key]) rec[sec.key] = [];
  const map = {};
  rec[sec.key].forEach((r) => (map[r.username] = r.records));
  users.forEach((u) => {
    if (!map[u.username]) map[u.username] = {};
  });

  let html = `<div class="card"><h4>${sec.label}</h4><table class="att-table"><thead><tr><th>الاسم</th>`;
  sec.days.forEach((d) => (html += `<th>${d}</th>`));
  html += "</tr></thead><tbody>";
  users.forEach((u) => {
    html += `<tr><td>${u.username}</td>`;
    sec.days.forEach((d) => {
      const v = map[u.username][d] || "";
      html += `<td data-user="${u.username}" data-day="${d}" data-sec="${
        sec.key
      }" class="${
        v === "+" ? "cell-plus" : v === "-" ? "cell-minus" : "cell-empty"
      }">${v || "—"}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  setTimeout(() => {
    document.querySelectorAll(`td[data-sec='${sec.key}']`).forEach((td) => {
      td.onclick = () => {
        const u = td.dataset.user,
          d = td.dataset.day,
          key = td.dataset.sec;
        const v = td.innerText.trim();
        const next = v === "—" ? "+" : v === "+" ? "-" : "—";
        td.innerText = next;
        td.className =
          next === "+"
            ? "cell-plus"
            : next === "-"
            ? "cell-minus"
            : "cell-empty";
      };
    });
  }, 0);
  return html;
}

/* ===== حفظ بيانات الأدمن ===== */
async function saveAdminData() {
  const { year, month } = getYM();
  const rec = await loadAttendance(state.stage, year, month);
  const tables = document.querySelectorAll("#admin-tables table");
  tables.forEach((t) => {
    const sec = t.parentElement.querySelector("h4").innerText;
  });
  const datasets = [
    "attendance",
    "behavior",
    "interaction",
    "visitations",
    "subadminsAttendance"
  ];
  datasets.forEach((ds) => {
    const tbl = document.querySelector(`[data-sec='${ds}']`)?.closest("table");
    if (!tbl) return;
    const rows = tbl.querySelectorAll("tbody tr");
    const map = {};
    rows.forEach((r) => {
      const name = r.children[0].innerText;
      const cells = r.querySelectorAll("td[data-sec]");
      map[name] = {};
      cells.forEach((c) => {
        map[name][c.dataset.day] =
          c.innerText.trim() === "—" ? "" : c.innerText.trim();
      });
    });
    rec[ds] = Object.keys(map).map((u) => ({ username: u, records: map[u] }));
  });
  rec.meta.updatedBy = currentUser.username;
  rec.meta.updatedAt = new Date().toISOString();
  await saveAttendance(rec);
  toast("✅ تم حفظ جميع التعديلات");
}

/* ===== التصدير إلى Excel ===== */
function exportExcel(selector, name) {
  const el = document.querySelector(selector);
  if (!el) return toast("⚠️ لا يوجد جدول للتصدير");
  const ws = XLSX.utils.table_to_sheet(el);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${name}_${Date.now()}.xlsx`);
}

/* ===== رسم الإحصائية ===== */
let chartInstance = null;
async function toggleChart() {
  const c = $("admin-chart-wrap");
  c.classList.toggle("hidden");
  if (!c.classList.contains("hidden")) await renderChart();
  else if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}
async function renderChart() {
  const ctx = $("adminChart").getContext("2d");
  const { year, month } = getYM();
  const rec = await loadAttendance(state.stage, year, month);
  const fridays = getFridaysOfMonth(year, month);
  const users = await getUsersByStage(state.stage);
  const totals = fridays.map((d) => {
    let present = 0;
    (rec.attendance || []).forEach((u) => {
      if (u.records[d] === "+") present++;
    });
    return Math.round((present / users.length) * 100);
  });
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: fridays.map((d) => String(d)),
      datasets: [
        {
          label: "نسبة الحضور %",
          data: totals,
          backgroundColor: "rgba(46,125,50,0.8)"
        }
      ]
    }
  });
}
