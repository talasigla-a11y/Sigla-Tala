const API_BASE_URL = window.SIGLA_TALA_API_URL || "https://api.siglatala.com";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");
const role = user && user.role ? String(user.role).toLowerCase() : "";
const toast = document.getElementById("toast");
let reportData = { appointments: [] };
let workers = [];
let schedules = [];
let editingScheduleId = null;
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
    const valueKey = labelKey === "category" ? "patients" : "total";
    const max = Math.max(...records.map((record) => Number(record[valueKey] || 0)), 1);
    element.innerHTML = records.map((record) => `
        <div class="bar-row"><span class="bar-label">${escapeHtml(record[labelKey] || "Unspecified")}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(Number(record[valueKey] || 0) / max) * 100}%"></span></span>
        <strong>${Number(record[valueKey] || 0)}</strong></div>`).join("");
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
    const categories = report.categories || [];
    const totalPatients = categories.reduce((sum, category) => sum + Number(category.patients || 0), 0);
    document.getElementById("categoryRows").innerHTML = categories.length
        ? categories.map((category) => {
            const patients = Number(category.patients || 0);
            const share = totalPatients ? `${((patients / totalPatients) * 100).toFixed(1)}%` : "0%";
            return `<tr><td>${escapeHtml(category.category)}</td><td><strong>${patients}</strong></td><td>${Number(category.total || 0)}</td><td>${share}</td></tr>`;
        }).join("")
        : emptyRow(4);
    document.getElementById("categoryStatus").textContent = `${categories.length} categor${categories.length === 1 ? "y" : "ies"}`;
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
        schedules = data.schedules || [];
        populateSpecializations();
        renderSchedules();
    } catch (error) { showToast(error.message, "error"); }
}

function populateSpecializations() {
    const select = document.getElementById("scheduleSpecialization");
    const currentValue = select.value;
    const specializations = [...new Set(schedules.map((schedule) => schedule.job_specification).filter(Boolean))].sort();
    select.innerHTML = `<option value="">All specializations</option>${specializations.map((specialization) => `<option value="${escapeHtml(specialization)}">${escapeHtml(specialization)}</option>`).join("")}`;
    select.value = specializations.includes(currentValue) ? currentValue : "";
}

function formatScheduleDate(value) {
    const datePart = String(value || "").slice(0, 10);
    const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return datePart;

    const [, year, month, day] = match;
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric"
    }).format(new Date(Number(year), Number(month) - 1, Number(day)));
}

function renderSchedules() {
    const query = document.getElementById("scheduleSearch").value.trim().toLowerCase();
    const specialization = document.getElementById("scheduleSpecialization").value;
    const filtered = schedules.filter((schedule) => {
        const workerMatch = String(schedule.worker_name || "").toLowerCase().includes(query) || String(schedule.job_specification || "").toLowerCase().includes(query);
        return workerMatch && (!specialization || schedule.job_specification === specialization);
    });
    document.getElementById("scheduleRows").innerHTML = filtered.length ? filtered.map((schedule) => {
        const overnight = schedule.end_time < schedule.start_time;
        const hours = `${escapeHtml(schedule.start_time)}–${escapeHtml(schedule.end_time)}${overnight ? " (+1 day)" : ""}`;
        return `<tr><td>${escapeHtml(formatScheduleDate(schedule.schedule_date))}</td><td>${escapeHtml(schedule.worker_name)}</td><td>${escapeHtml(schedule.job_specification || "—")}</td><td>${hours}</td><td>${escapeHtml(schedule.notes || "—")}</td><td class="schedule-actions"><button type="button" class="btn-secondary btn-compact edit-schedule" data-id="${schedule.id}">Edit</button><button type="button" class="btn-danger btn-compact delete-schedule" data-id="${schedule.id}">Delete</button></td></tr>`;
    }).join("") : emptyRow(6, "No schedules match the current filters.");
    document.querySelectorAll(".edit-schedule").forEach((button) => button.addEventListener("click", () => beginScheduleEdit(Number(button.dataset.id))));
    document.querySelectorAll(".delete-schedule").forEach((button) => button.addEventListener("click", () => removeSchedule(Number(button.dataset.id))));
}

function beginScheduleEdit(scheduleId) {
    const schedule = schedules.find((item) => Number(item.id) === scheduleId);
    if (!schedule) return;
    editingScheduleId = scheduleId;
    document.getElementById("scheduleWorker").value = schedule.worker_id;
    document.getElementById("scheduleDate").value = String(schedule.schedule_date).slice(0, 10);
    document.getElementById("scheduleStart").value = String(schedule.start_time).slice(0, 5);
    document.getElementById("scheduleEnd").value = String(schedule.end_time).slice(0, 5);
    document.getElementById("scheduleNotes").value = schedule.notes || "";
    document.getElementById("scheduleFormTitle").textContent = "Edit worker schedule";
    document.getElementById("cancelScheduleEditBtn").classList.remove("hidden");
    validateScheduleTime();
    document.getElementById("scheduleForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetScheduleForm() {
    editingScheduleId = null;
    document.getElementById("scheduleForm").reset();
    document.getElementById("scheduleDate").value = document.getElementById("toDate").value;
    document.getElementById("scheduleFormTitle").textContent = "Set worker schedule";
    document.getElementById("cancelScheduleEditBtn").classList.add("hidden");
    document.getElementById("timeValidationMessage").textContent = "";
}

async function removeSchedule(scheduleId) {
    if (!window.confirm("Delete this worker schedule?")) return;
    try {
        await request(`/schedules/${scheduleId}`, { method: "DELETE" });
        showToast("Worker schedule deleted.");
        await loadSchedules();
    } catch (error) { showToast(error.message, "error"); }
}

function validateScheduleTime() {
    const start = document.getElementById("scheduleStart").value;
    const end = document.getElementById("scheduleEnd").value;
    const message = document.getElementById("timeValidationMessage");
    if (!start || !end) { message.textContent = ""; return true; }
    if (start === end) {
        message.textContent = "Start and end time must be different.";
        message.className = "form-validation-message error";
        return false;
    }
    message.textContent = end < start ? "Overnight shift: ends the next day." : "Same-day shift.";
    message.className = "form-validation-message valid";
    return true;
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
document.getElementById("scheduleSearch").addEventListener("input", renderSchedules);
document.getElementById("scheduleSpecialization").addEventListener("change", renderSchedules);
document.getElementById("scheduleStart").addEventListener("change", validateScheduleTime);
document.getElementById("scheduleEnd").addEventListener("change", validateScheduleTime);
document.querySelectorAll(".shift-template").forEach((button) => button.addEventListener("click", () => {
    document.getElementById("scheduleStart").value = button.dataset.start;
    document.getElementById("scheduleEnd").value = button.dataset.end;
    validateScheduleTime();
}));
document.getElementById("cancelScheduleEditBtn").addEventListener("click", resetScheduleForm);
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
    if (!validateScheduleTime()) { showToast("Please correct the schedule time.", "error"); return; }
    try {
        const schedule = { scheduleId: editingScheduleId, workerId: document.getElementById("scheduleWorker").value, scheduleDate: document.getElementById("scheduleDate").value, startTime: document.getElementById("scheduleStart").value, endTime: document.getElementById("scheduleEnd").value, notes: document.getElementById("scheduleNotes").value };
        await request("/schedules", { method: editingScheduleId ? "PUT" : "POST", body: JSON.stringify(schedule) });
        showToast("Worker schedule saved.");
        resetScheduleForm();
        await loadSchedules();
    } catch (error) { showToast(error.message, "error"); }
});

loadWorkers();
loadReport();
