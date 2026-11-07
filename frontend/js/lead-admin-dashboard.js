const API_BASE_URL = window.SIGLA_TALA_API_URL || "https://api.siglatala.com";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");
const role = user && user.role ? String(user.role).toLowerCase() : "";
const toast = document.getElementById("toast");
let reportData = { appointments: [] };
let workers = [];
let toastTimer;

if (!token || role !== "lead-admin") {
    window.location.replace("../pages/login.html");
}

document.getElementById("leadAdminName").textContent = user && user.fullname ? user.fullname : "Lead Admin";
const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = `${today.slice(0, 8)}01`;
document.getElementById("fromDate").value = firstOfMonth;
document.getElementById("toDate").value = today;
document.getElementById("scheduleDate").value = today;

function showToast(message, type = "success") {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}/api/lead-admin${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
}

function rangeQuery() {
    return `?from=${encodeURIComponent(document.getElementById("fromDate").value)}&to=${encodeURIComponent(document.getElementById("toDate").value)}`;
}

function emptyRow(colspan, message = "No records found.") {
    return `<tr><td colspan="${colspan}">${message}</td></tr>`;
}

function renderBars(elementId, records, labelKey) {
    const element = document.getElementById(elementId);
    if (!records.length) { element.innerHTML = "<p class='field-hint'>No data for this date range.</p>"; return; }
    const max = Math.max(...records.map((record) => Number(record.total)), 1);
    element.innerHTML = records.map((record) => `
        <div class="bar-row"><span>${escapeHtml(record[labelKey] || "Unspecified")}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(Number(record.total) / max) * 100}%"></span></span>
        <strong>${Number(record.total)}</strong></div>`).join("");
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

function statusMarkup(status) {
    const normalized = String(status || "").toLowerCase();
    return `<span class="status-pill ${normalized}">${escapeHtml(status)}</span>`;
}

function renderReport(report) {
    reportData = report;
    const summary = report.summary || {};
    document.getElementById("totalAppointments").textContent = Number(summary.total_appointments || 0);
    document.getElementById("uniquePatients").textContent = Number(summary.unique_patients || 0);
    document.getElementById("pendingAppointments").textContent = Number(summary.pending || 0);
    document.getElementById("completedAppointments").textContent = Number(summary.completed || 0);
    renderBars("dailyChart", report.daily || [], "date");
    renderBars("categoryChart", report.categories || [], "category");
    document.getElementById("reportRows").innerHTML = report.appointments.length
        ? report.appointments.map((appointment) => `<tr><td>${escapeHtml(appointment.date)}</td><td>${escapeHtml(appointment.patient_name)}</td><td>${escapeHtml(appointment.category)}</td><td>${escapeHtml(appointment.worker_name || "Unassigned")}</td><td>${statusMarkup(appointment.status)}</td></tr>`).join("")
        : emptyRow(5);
    document.getElementById("reportStatus").textContent = `${report.appointments.length} appointment record(s)`;
}

async function loadReport() {
    try { renderReport(await request(`/report${rangeQuery()}`)); }
    catch (error) { showToast(error.message, "error"); }
}

async function loadWorkers() {
    try {
        const data = await request("/workers");
        workers = data.workers || [];
        document.getElementById("scheduleWorker").innerHTML = workers.map((worker) => `<option value="${worker.id}">${escapeHtml(worker.fullname)}${worker.job_specification ? ` — ${escapeHtml(worker.job_specification)}` : ""}</option>`).join("");
    } catch (error) { showToast(error.message, "error"); }
}

async function loadAssignments() {
    try {
        const data = await request(`/report${rangeQuery()}`);
        const rows = data.appointments || [];
        document.getElementById("assignmentRows").innerHTML = rows.length ? rows.map((appointment) => `<tr><td>${escapeHtml(appointment.date)}</td><td>${escapeHtml(appointment.patient_name)}</td><td>${escapeHtml(appointment.category)}</td><td>${escapeHtml(appointment.worker_name || "Unassigned")}</td><td><select class="assignment-select" data-id="${appointment.id}"><option value="">Select worker</option>${workers.map((worker) => `<option value="${worker.id}" ${worker.fullname === appointment.worker_name ? "selected" : ""}>${escapeHtml(worker.fullname)}</option>`).join("")}</select></td></tr>`).join("") : emptyRow(5);
        document.querySelectorAll(".assignment-select").forEach((select) => select.addEventListener("change", assignAppointment));
    } catch (error) { showToast(error.message, "error"); }
}

async function assignAppointment(event) {
    if (!event.target.value) return;
    try {
        await request("/appointments/assign", { method: "PUT", body: JSON.stringify({ appointmentId: event.target.dataset.id, workerId: event.target.value }) });
        showToast("Appointment assigned.");
        await loadReport();
        await loadAssignments();
    } catch (error) { showToast(error.message, "error"); }
}

async function loadSchedules() {
    try {
        const data = await request(`/schedules${rangeQuery()}`);
        document.getElementById("scheduleRows").innerHTML = data.schedules.length ? data.schedules.map((schedule) => `<tr><td>${escapeHtml(schedule.schedule_date)}</td><td>${escapeHtml(schedule.worker_name)}</td><td>${escapeHtml(schedule.job_specification || "—")}</td><td>${escapeHtml(schedule.start_time)}–${escapeHtml(schedule.end_time)}</td><td>${escapeHtml(schedule.notes || "—")}</td></tr>`).join("") : emptyRow(5);
    } catch (error) { showToast(error.message, "error"); }
}

async function loadActivity() {
    try {
        const data = await request(`/activity-logs${rangeQuery()}`);
        document.getElementById("activityRows").innerHTML = data.logs.length ? data.logs.map((log) => `<tr><td>${escapeHtml(new Date(log.created_at).toLocaleString())}</td><td>${escapeHtml(log.actor_name || "System")}</td><td>${escapeHtml(log.action)}</td><td>${escapeHtml(log.entity_type)} #${escapeHtml(log.entity_id || "—")}</td><td>${escapeHtml(log.details || "—")}</td></tr>`).join("") : emptyRow(5);
    } catch (error) { showToast(error.message, "error"); }
}

function exportCsv() {
    const headers = ["Date", "Time", "Patient", "Category", "Worker", "Status"];
    const rows = reportData.appointments.map((appointment) => [appointment.date, appointment.time_preference, appointment.patient_name, appointment.category, appointment.worker_name || "Unassigned", appointment.status]);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `sigla-tala-appointments-${document.getElementById("fromDate").value}-to-${document.getElementById("toDate").value}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

document.getElementById("refreshBtn").addEventListener("click", async () => { await loadReport(); await loadSchedules(); await loadActivity(); });
document.getElementById("exportBtn").addEventListener("click", exportCsv);
document.getElementById("reloadAssignmentsBtn").addEventListener("click", loadAssignments);
document.getElementById("reloadActivityBtn").addEventListener("click", loadActivity);
document.getElementById("logoutBtn").addEventListener("click", () => { localStorage.removeItem("token"); localStorage.removeItem("user"); window.location.replace("../pages/login.html"); });
document.querySelectorAll(".lead-tab").forEach((tab) => tab.addEventListener("click", async () => {
    document.querySelectorAll(".lead-tab").forEach((item) => item.classList.toggle("active", item === tab));
    document.querySelectorAll(".lead-panel").forEach((panel) => panel.classList.toggle("hidden", panel.id !== tab.dataset.panel));
    if (tab.dataset.panel === "assignmentsPanel") await loadAssignments();
    if (tab.dataset.panel === "schedulesPanel") await loadSchedules();
    if (tab.dataset.panel === "activityPanel") await loadActivity();
}));
document.getElementById("scheduleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await request("/schedules", { method: "POST", body: JSON.stringify({ workerId: document.getElementById("scheduleWorker").value, scheduleDate: document.getElementById("scheduleDate").value, startTime: document.getElementById("scheduleStart").value, endTime: document.getElementById("scheduleEnd").value, notes: document.getElementById("scheduleNotes").value }) });
        showToast("Worker schedule saved.");
        await loadSchedules();
    } catch (error) { showToast(error.message, "error"); }
});

loadWorkers();
loadReport();
