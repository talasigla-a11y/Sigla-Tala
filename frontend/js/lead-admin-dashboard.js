const API_BASE_URL = window.SIGLA_TALA_API_URL || "https://api.siglatala.com";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");
const role = user && user.role ? String(user.role).toLowerCase() : "";
const toast = document.getElementById("toast");
let reportData = { appointments: [] };
let workers = [];
let schedules = [];
let editingScheduleId = null;
let schedulePlannerDate = new Date();
let selectedScheduleDate = new Date();
let selectedScheduleDates = new Set();
let multiDateSelectMode = false;
let assignmentAppointments = [];
let activityLogs = [];
const MORNING_START = "07:00";
const MORNING_END = "17:00";
const ACTIVITY_ROLES = ["patient", "worker", "admin", "lead-admin"];
let reportPage = 1;
const reportPageSize = 10;
let toastTimer;

if (!token || role !== "lead-admin") {
    window.location.replace("../pages/login.html");
}

document.getElementById("leadAdminName").textContent = user && user.fullname ? user.fullname : "Lead Admin";
const leadAdminUserMenu = document.getElementById("leadAdminUserMenu");
const leadAdminMenuTrigger = document.getElementById("leadAdminMenuTrigger");
const leadAdminUserDropdown = document.getElementById("leadAdminUserDropdown");

leadAdminMenuTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = !leadAdminUserDropdown.classList.contains("hidden");
    leadAdminUserDropdown.classList.toggle("hidden", isOpen);
    leadAdminUserMenu.classList.toggle("open", !isOpen);
    leadAdminMenuTrigger.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", (event) => {
    if (!leadAdminUserMenu.contains(event.target)) {
        leadAdminUserDropdown.classList.add("hidden");
        leadAdminUserMenu.classList.remove("open");
        leadAdminMenuTrigger.setAttribute("aria-expanded", "false");
    }
});
const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = `${today.slice(0, 8)}01`;
document.getElementById("fromDate").value = firstOfMonth;
document.getElementById("toDate").value = today;
document.getElementById("scheduleDate").value = scheduleDateKey(new Date());

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

function formatDateOnly(value) {
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

function normalizeTime(value) {
    return String(value || "").slice(0, 5);
}

function normalizeDate(value) {
    const text = String(value || "");
    const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
}

function formatDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || "") : date.toLocaleString();
}

function renderBars(elementId, records, labelKey) {
    const element = document.getElementById(elementId);
    if (!records.length) { element.innerHTML = "<p class='field-hint'>No data matches the selected filters.</p>"; return; }
    const valueKey = labelKey === "category" ? "patients" : "total";
    const max = Math.max(...records.map((record) => Number(record[valueKey] || 0)), 1);
    const scaleStep = Math.max(1, Math.ceil(max / 4));
    const scaleMax = scaleStep * 4;
    const scale = [scaleMax, scaleStep * 3, scaleStep * 2, scaleStep, 0];
    element.innerHTML = records.map((record) => {
        const label = labelKey === "date" ? formatDateOnly(record[labelKey]) : (record[labelKey] || "Unspecified");
        return `
        <div class="bar-column" title="${escapeHtml(`${label}: ${Number(record[valueKey] || 0)}`)}">
          <strong class="bar-value">${Number(record[valueKey] || 0)}</strong>
          <span class="bar-track"><span class="bar-fill" style="height:${(Number(record[valueKey] || 0) / scaleMax) * 100}%"></span></span>
          <span class="bar-label">${escapeHtml(label)}</span>
        </div>`;
    }).join("");
    element.innerHTML = `<div class="chart-scale" aria-hidden="true">${scale.map((value) => `<span>${value}</span>`).join("")}</div><div class="chart-columns">${element.innerHTML}</div>`;
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
    populateReportFilters();
    reportPage = 1;
    renderReportAnalytics();
    renderReportTable();
}

function renderReportAnalytics() {
    const appointments = filteredReportAppointments(false);
    const uniquePatients = new Set(appointments.map((item) => item.user_id || item.patient_name).filter(Boolean));
    const accepted = appointments.filter((item) => String(item.status || "").toLowerCase() === "accepted").length;
    const rejected = appointments.filter((item) => String(item.status || "").toLowerCase() === "rejected").length;
    document.getElementById("totalAppointments").textContent = appointments.length;
    document.getElementById("uniquePatients").textContent = uniquePatients.size;
    document.getElementById("acceptedAppointments").textContent = accepted;
    document.getElementById("rejectedAppointments").textContent = rejected;

    const byDate = new Map();
    const byAppointmentType = new Map();
    appointments.forEach((appointment) => {
        const date = normalizeDate(appointment.date);
        const type = appointment.category || "Unspecified";
        byDate.set(date, (byDate.get(date) || 0) + 1);
        if (!byAppointmentType.has(type)) {
            byAppointmentType.set(type, { category: type, total: 0, patientIds: new Set() });
        }
        const stats = byAppointmentType.get(type);
        stats.total += 1;
        const patientKey = appointment.user_id || appointment.patient_name;
        if (patientKey) stats.patientIds.add(patientKey);
    });
    const daily = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));
    const categories = [...byAppointmentType.values()]
        .map(({ category, total, patientIds }) => ({ category, total, patients: patientIds.size }))
        .sort((a, b) => b.patients - a.patients || b.total - a.total || a.category.localeCompare(b.category));
    renderBars("dailyChart", daily, "date");
    renderBars("categoryChart", categories, "category");

    const totalPatients = categories.reduce((sum, category) => sum + Number(category.patients || 0), 0);
    document.getElementById("categoryRows").innerHTML = categories.length
        ? categories.map((category) => {
            const patients = Number(category.patients || 0);
            const share = totalPatients ? `${((patients / totalPatients) * 100).toFixed(1)}%` : "0%";
            return `<tr><td>${escapeHtml(category.category)}</td><td><strong>${patients}</strong></td><td>${Number(category.total || 0)}</td><td>${share}</td></tr>`;
        }).join("")
        : emptyRow(4);
    document.getElementById("categoryStatus").textContent = `${categories.length} appointment type${categories.length === 1 ? "" : "s"}`;
}

function populateReportFilters() {
    const worker = document.getElementById("workerFilter");
    const category = document.getElementById("categoryFilter");
    const workerValue = worker.value;
    const categoryValue = category.value;
    const workersInReport = [...new Set(reportData.appointments.map((item) => item.worker_name).filter(Boolean))].sort();
    const categoriesInReport = [...new Set(reportData.appointments.map((item) => item.category).filter(Boolean))].sort();
    worker.innerHTML = `<option value="">All workers</option>${workersInReport.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}`;
    category.innerHTML = `<option value="">All appointment types</option>${categoriesInReport.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}`;
    worker.value = workersInReport.includes(workerValue) ? workerValue : "";
    category.value = categoriesInReport.includes(categoryValue) ? categoryValue : "";
}

function filteredReportAppointments(includeSearch = true) {
    const status = document.getElementById("statusFilter").value;
    const worker = document.getElementById("workerFilter").value;
    const category = document.getElementById("categoryFilter").value;
    const search = includeSearch ? document.getElementById("reportSearch").value.trim().toLowerCase() : "";
    return reportData.appointments.filter((item) => {
        const searchable = `${item.patient_name || ""} ${item.worker_name || ""} ${item.category || ""}`.toLowerCase();
        return (!status || item.status === status) &&
            (!worker || item.worker_name === worker) &&
            (!category || item.category === category) &&
            (!search || searchable.includes(search));
    });
}

function renderReportTable() {
    const filtered = filteredReportAppointments();
    const totalPages = Math.max(1, Math.ceil(filtered.length / reportPageSize));
    reportPage = Math.min(reportPage, totalPages);
    const start = (reportPage - 1) * reportPageSize;
    const visible = filtered.slice(start, start + reportPageSize);
    document.getElementById("reportRows").innerHTML = visible.length
        ? visible.map((appointment) => `<tr class="clickable-report-row" tabindex="0" data-id="${appointment.id}"><td>${escapeHtml(formatDateOnly(appointment.date))}</td><td>${escapeHtml(appointment.patient_name)}</td><td>${escapeHtml(appointment.category)}</td><td>${escapeHtml(appointment.worker_name || "Unassigned")}</td><td>${statusMarkup(appointment.status)}</td></tr>`).join("")
        : emptyRow(5, "No appointments match the current filters.");
    document.querySelectorAll(".clickable-report-row").forEach((row) => {
        row.addEventListener("click", () => openAppointmentDetails(Number(row.dataset.id)));
        row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") openAppointmentDetails(Number(row.dataset.id)); });
    });
    const from = filtered.length ? start + 1 : 0;
    const to = Math.min(start + reportPageSize, filtered.length);
    document.getElementById("reportStatus").textContent = `${filtered.length} appointment record(s)`;
    document.getElementById("paginationStatus").textContent = `Showing ${from}-${to} of ${filtered.length} records`;
    document.getElementById("previousPageBtn").disabled = reportPage <= 1;
    document.getElementById("nextPageBtn").disabled = reportPage >= totalPages;
}

async function openAppointmentDetails(appointmentId) {
    try {
        const details = await request(`/appointments/${appointmentId}`);
        const appointment = details.appointment;
        document.getElementById("drawerTitle").textContent = appointment.patient_name || "Patient history";
        document.getElementById("drawerContent").innerHTML = `
          <section class="drawer-section"><h3>Appointment</h3><dl class="detail-list">
            <dt>Date</dt><dd>${escapeHtml(formatDateOnly(appointment.date))}</dd>
            <dt>Time</dt><dd>${escapeHtml(appointment.time_preference || "—")}</dd>
            <dt>Category</dt><dd>${escapeHtml(appointment.category || "—")}</dd>
            <dt>Status</dt><dd>${statusMarkup(appointment.status)}</dd>
            <dt>Assigned worker</dt><dd>${escapeHtml(appointment.worker_name || "Unassigned")}</dd>
          </dl></section>
          <section class="drawer-section"><h3>Patient profile</h3><dl class="detail-list">
            <dt>Email</dt><dd>${escapeHtml(appointment.patient_email || "—")}</dd>
            <dt>Age</dt><dd>${escapeHtml(appointment.patient_age || "—")}</dd>
            <dt>Gender</dt><dd>${escapeHtml(appointment.patient_gender || "—")}</dd>
          </dl></section>
          <section class="drawer-section"><h3>Patient history</h3>${details.history.length ? `<div class="history-list">${details.history.map((item) => `<article class="history-item"><strong>${escapeHtml(formatDateOnly(item.date))} · ${escapeHtml(item.category || "Appointment")}</strong><span>${statusMarkup(item.status)} · ${escapeHtml(item.worker_name || "Unassigned")}</span>${item.diagnostic ? `<p><b>Diagnosis:</b> ${escapeHtml(item.diagnostic)}</p>` : ""}${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}</article>`).join("")}</div>` : "<p class='field-hint'>No previous history found.</p>"}</section>`;
        document.getElementById("appointmentDrawer").classList.remove("hidden");
        document.getElementById("drawerBackdrop").classList.remove("hidden");
        document.getElementById("appointmentDrawer").setAttribute("aria-hidden", "false");
    } catch (error) { showToast(error.message, "error"); }
}

function closeAppointmentDetails() {
    document.getElementById("appointmentDrawer").classList.add("hidden");
    document.getElementById("drawerBackdrop").classList.add("hidden");
    document.getElementById("appointmentDrawer").setAttribute("aria-hidden", "true");
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
        assignmentAppointments = data.appointments || [];
        renderAssignments();
    } catch (error) { showToast(error.message, "error"); }
}

function renderAssignments() {
    const query = document.getElementById("assignmentSearch").value.trim().toLowerCase();
    const filtered = assignmentAppointments.filter((appointment) => {
        const searchable = `${appointment.patient_name || ""} ${appointment.category || ""} ${appointment.worker_name || ""}`.toLowerCase();
        return !query || searchable.includes(query);
    });
    document.getElementById("assignmentRows").innerHTML = filtered.length
        ? filtered.map((appointment) => `<tr><td>${escapeHtml(formatDateOnly(appointment.date))}</td><td>${escapeHtml(appointment.patient_name || "—")}</td><td>${escapeHtml(appointment.category || "—")}</td><td>${escapeHtml(appointment.worker_name || "Unassigned")}</td></tr>`).join("")
        : emptyRow(4, "No appointments match the current search.");
}

async function loadSchedules() {
    renderScheduleCalendar();
    renderSelectedDateSchedules();
    try {
        const from = new Date(schedulePlannerDate.getFullYear(), schedulePlannerDate.getMonth(), 1);
        const to = new Date(schedulePlannerDate.getFullYear(), schedulePlannerDate.getMonth() + 1, 0);
        const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const data = await request(`/schedules?from=${dateKey(from)}&to=${dateKey(to)}`);
        schedules = data.schedules || [];
        populateSpecializations();
        renderSchedules();
        renderScheduleCalendar();
        renderSelectedDateSchedules();
    } catch (error) { showToast(error.message, "error"); }
}

function scheduleDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function scheduleLabelDate(value, options = { weekday: "long", year: "numeric", month: "long", day: "numeric" }) {
    const datePart = normalizeDate(value);
    const [year, month, day] = datePart.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day));
}

function renderScheduleCalendar() {
    const year = schedulePlannerDate.getFullYear();
    const month = schedulePlannerDate.getMonth();
    const grid = document.getElementById("scheduleCalendarGrid");
    document.getElementById("scheduleMonthLabel").textContent =
        new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(schedulePlannerDate);
    grid.replaceChildren();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const scheduleCounts = new Map();
    schedules.forEach((schedule) => {
        const date = normalizeDate(schedule.schedule_date);
        scheduleCounts.set(date, (scheduleCounts.get(date) || 0) + 1);
    });

    for (let index = 0; index < firstDay; index += 1) {
        const blank = document.createElement("span");
        blank.className = "schedule-calendar-blank";
        grid.appendChild(blank);
    }

    const todayKey = scheduleDateKey(new Date());
    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        const key = scheduleDateKey(date);
        const count = scheduleCounts.get(key) || 0;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "schedule-calendar-day";
        button.classList.toggle("selected", selectedScheduleDates.has(key));
        button.classList.toggle("multi-selected", multiDateSelectMode && selectedScheduleDates.has(key));
        button.classList.toggle("today", key === todayKey);
        button.classList.toggle("has-schedules", count > 0);
        button.setAttribute("aria-label", `${scheduleLabelDate(key)}${count ? `, ${count} worker${count === 1 ? "" : "s"} scheduled` : ", no workers scheduled"}`);
        button.innerHTML = `<span>${day}</span>${count ? `<small>${count} assigned</small>` : ""}`;
        button.addEventListener("click", () => selectScheduleDate(date));
        grid.appendChild(button);
    }
}

function selectScheduleDate(date) {
    selectedScheduleDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    schedulePlannerDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const key = scheduleDateKey(selectedScheduleDate);
    if (multiDateSelectMode) {
        if (selectedScheduleDates.has(key)) selectedScheduleDates.delete(key);
        else selectedScheduleDates.add(key);
    } else {
        selectedScheduleDates = new Set([key]);
    }
    updateScheduleDateSelection();
    document.getElementById("scheduleDateFilter").value = "";
    renderScheduleCalendar();
    renderSelectedDateSchedules();
    renderSchedules();
}

function updateScheduleDateSelection() {
    const dates = [...selectedScheduleDates].sort();
    document.getElementById("scheduleDate").value = dates[0] || "";
    document.getElementById("scheduleDatesSummary").textContent = dates.length
        ? dates.map((date) => scheduleLabelDate(date, { month: "short", day: "numeric", year: "numeric" })).join(", ")
        : "None — select date(s) in the calendar";
    document.getElementById("multiDateHint").textContent = multiDateSelectMode
        ? `${dates.length} date${dates.length === 1 ? "" : "s"} selected. Click calendar dates to add or remove them; click “Select multiple dates” again when done.`
        : dates.length > 1
            ? `${dates.length} dates selected for the schedule form. Use “Clear dates” to start over.`
            : "Select a date to view its schedule. Turn on “Select multiple dates” to assign a worker to several dates at once.";
    document.getElementById("schedulePlannerCard").classList.toggle("multi-date-mode", multiDateSelectMode);
}

function scheduleActionButtons(schedule) {
    return `<div class="schedule-actions"><button type="button" class="btn-secondary btn-compact edit-schedule" data-id="${schedule.id}">Edit</button><button type="button" class="btn-danger btn-compact delete-schedule" data-id="${schedule.id}">Delete</button></div>`;
}

function bindScheduleActions(container) {
    container.querySelectorAll(".edit-schedule").forEach((button) => {
        button.addEventListener("click", () => beginScheduleEdit(Number(button.dataset.id)));
    });
    container.querySelectorAll(".delete-schedule").forEach((button) => {
        button.addEventListener("click", () => removeSchedule(Number(button.dataset.id)));
    });
}

function renderSelectedDateSchedules() {
    const key = scheduleDateKey(selectedScheduleDate);
    const selected = schedules
        .filter((schedule) => normalizeDate(schedule.schedule_date) === key)
        .sort((a, b) => normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));
    document.getElementById("scheduleSelectedDateLabel").textContent = `Scheduled Workers — ${scheduleLabelDate(key)}`;
    const roster = document.getElementById("selectedDateSchedules");
    roster.innerHTML = selected.length
        ? `<div class="schedule-roster-list">${selected.map((schedule) => `
            <article class="schedule-roster-item">
              <span class="schedule-roster-avatar" aria-hidden="true">${escapeHtml(String(schedule.worker_name || "W").trim().charAt(0).toUpperCase())}</span>
              <div class="schedule-roster-worker"><strong>${escapeHtml(schedule.worker_name)}</strong><span>${escapeHtml(schedule.job_specification || "Health worker")}</span><small>${escapeHtml(normalizeTime(schedule.start_time))}–${escapeHtml(normalizeTime(schedule.end_time))}${schedule.notes ? ` · ${escapeHtml(schedule.notes)}` : ""}</small></div>
              ${scheduleActionButtons(schedule)}
            </article>`).join("")}</div>`
        : `<div class="schedule-roster-empty"><strong>No workers scheduled</strong><span>No workers are assigned for this date.</span></div>`;
    bindScheduleActions(roster);
}

function printSelectedDateSchedule() {
    const key = scheduleDateKey(selectedScheduleDate);
    const selected = schedules
        .filter((schedule) => normalizeDate(schedule.schedule_date) === key)
        .sort((a, b) => normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));
    const rows = selected.length
        ? selected.map((schedule) => `<tr><td>${escapeHtml(normalizeTime(schedule.start_time))}–${escapeHtml(normalizeTime(schedule.end_time))}</td><td>${escapeHtml(schedule.worker_name)}</td><td>${escapeHtml(schedule.job_specification || "Health worker")}</td><td>${escapeHtml(schedule.notes || "—")}</td></tr>`).join("")
        : `<tr><td colspan="4">No workers are assigned for this date.</td></tr>`;
    const printSheet = document.getElementById("schedulePrintSheet");
    printSheet.innerHTML = `
        <header class="schedule-print-header"><div class="schedule-print-logo">S</div><div><h1>Sigla Tala</h1><p>Barangay Health Care Center · Worker Duty Roster</p></div></header>
        <h2>Daily Worker Schedule</h2><p class="schedule-print-date">${escapeHtml(scheduleLabelDate(key))}</p>
        <table><thead><tr><th>Duty hours</th><th>Worker</th><th>Specialization</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>
        <footer class="schedule-print-footer"><span>Prepared by: __________________________</span><span>Printed on: ${escapeHtml(new Date().toLocaleDateString())}</span></footer>`;
    window.print();
}

function populateSpecializations() {
    const select = document.getElementById("scheduleSpecialization");
    const currentValue = select.value;
    const specializations = [...new Set(schedules.map((schedule) => schedule.job_specification).filter(Boolean))].sort();
    select.innerHTML = `<option value="">All specializations</option>${specializations.map((specialization) => `<option value="${escapeHtml(specialization)}">${escapeHtml(specialization)}</option>`).join("")}`;
    select.value = specializations.includes(currentValue) ? currentValue : "";
}

function formatScheduleDate(value) {
    return formatDateOnly(value);
}

function renderSchedules() {
    const query = document.getElementById("scheduleSearch").value.trim().toLowerCase();
    const specialization = document.getElementById("scheduleSpecialization").value;
    const date = document.getElementById("scheduleDateFilter").value;
    const filtered = schedules.filter((schedule) => {
        const workerMatch = String(schedule.worker_name || "").toLowerCase().includes(query) || String(schedule.job_specification || "").toLowerCase().includes(query);
        const scheduleDate = normalizeDate(schedule.schedule_date);
        const startTime = normalizeTime(schedule.start_time);
        const endTime = normalizeTime(schedule.end_time);
        return workerMatch &&
            (!specialization || String(schedule.job_specification || "").toLowerCase() === specialization.toLowerCase()) &&
            (!date || scheduleDate === date) &&
            startTime >= MORNING_START &&
            endTime <= MORNING_END &&
            startTime < endTime;
    });
    const table = document.getElementById("scheduleRows");
    table.innerHTML = filtered.length ? filtered.map((schedule) => {
        const hours = `${escapeHtml(normalizeTime(schedule.start_time))}–${escapeHtml(normalizeTime(schedule.end_time))}`;
        const attendanceStatus = String(schedule.attendance_status || "").toLowerCase();
        const lateValue = attendanceStatus === "late" && schedule.late_hours !== null ? escapeHtml(schedule.late_hours) : "";
        return `<tr data-schedule-id="${schedule.id}">
          <td>${escapeHtml(formatScheduleDate(schedule.schedule_date))}</td>
          <td>${escapeHtml(schedule.worker_name)}</td>
          <td>${escapeHtml(schedule.job_specification || "—")}</td>
          <td>${hours}</td>
          <td>${escapeHtml(schedule.notes || "—")}</td>
          <td><select class="attendance-status" aria-label="Attendance status for ${escapeHtml(schedule.worker_name)}">
            <option value="" ${!attendanceStatus ? "selected" : ""}>Not marked</option>
            <option value="present" ${attendanceStatus === "present" ? "selected" : ""}>Present</option>
            <option value="absent" ${attendanceStatus === "absent" ? "selected" : ""}>Absent</option>
            <option value="late" ${attendanceStatus === "late" ? "selected" : ""}>Late</option>
          </select></td>
          <td><input class="attendance-late-hours" type="number" min="0.01" max="24" step="0.25" placeholder="Hours" aria-label="Hours late for ${escapeHtml(schedule.worker_name)}" value="${lateValue}" ${attendanceStatus === "late" ? "" : "disabled"}></td>
          <td><div class="schedule-actions"><button type="button" class="btn-primary btn-compact save-attendance" data-id="${schedule.id}">Save status</button>${scheduleActionButtons(schedule)}</div></td>
        </tr>`;
    }).join("") : emptyRow(8, "No schedules match the current filters.");
    bindScheduleActions(table);
    bindScheduleAttendance(table);
}

function bindScheduleAttendance(container) {
    container.querySelectorAll(".attendance-status").forEach((select) => {
        select.addEventListener("change", () => {
            const lateHours = select.closest("tr").querySelector(".attendance-late-hours");
            lateHours.disabled = select.value !== "late";
            if (select.value !== "late") lateHours.value = "";
        });
    });
    container.querySelectorAll(".save-attendance").forEach((button) => {
        button.addEventListener("click", async () => {
            const row = button.closest("tr");
            const attendanceStatus = row.querySelector(".attendance-status").value;
            const lateHoursInput = row.querySelector(".attendance-late-hours");
            const lateHours = lateHoursInput.value;
            if (!attendanceStatus) {
                showToast("Select Present, Absent, or Late before saving.", "error");
                return;
            }
            if (attendanceStatus === "late" && (!lateHours || Number(lateHours) <= 0 || Number(lateHours) > 24)) {
                showToast("Enter late hours greater than 0 and no more than 24.", "error");
                lateHoursInput.focus();
                return;
            }
            button.disabled = true;
            try {
                await request(`/schedules/${button.dataset.id}/attendance`, {
                    method: "PUT",
                    body: JSON.stringify({ attendanceStatus, lateHours: attendanceStatus === "late" ? Number(lateHours) : null })
                });
                showToast("Attendance saved.");
                await loadSchedules();
            } catch (error) {
                showToast(error.message, "error");
            } finally {
                button.disabled = false;
            }
        });
    });
}

function beginScheduleEdit(scheduleId) {
    const schedule = schedules.find((item) => Number(item.id) === scheduleId);
    if (!schedule) return;
    editingScheduleId = scheduleId;
    document.getElementById("scheduleWorker").value = schedule.worker_id;
    document.getElementById("scheduleDate").value = String(schedule.schedule_date).slice(0, 10);
    multiDateSelectMode = false;
    document.getElementById("toggleMultiDateBtn").setAttribute("aria-pressed", "false");
    document.getElementById("toggleMultiDateBtn").textContent = "Select multiple dates";
    selectScheduleDate(new Date(`${normalizeDate(schedule.schedule_date)}T00:00:00`));
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
    updateScheduleDateSelection();
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
    if (start < MORNING_START || start > MORNING_END || end < MORNING_START || end > MORNING_END) {
        message.textContent = "Morning shifts must be between 7:00 AM and 5:00 PM.";
        message.className = "form-validation-message error";
        return false;
    }
    if (start >= end) {
        message.textContent = "End time must be later than start time.";
        message.className = "form-validation-message error";
        return false;
    }
    message.textContent = "Valid morning shift.";
    message.className = "form-validation-message valid";
    return true;
}

async function loadActivity() {
    try {
        const data = await request(`/activity-logs${rangeQuery()}`);
        activityLogs = data.logs || [];
        populateActivityRoleFilter();
        renderActivityLogs();
    } catch (error) { showToast(error.message, "error"); }
}

function populateActivityRoleFilter() {
    const select = document.getElementById("activityRoleFilter");
    const currentValue = select.value;
    const roles = ACTIVITY_ROLES;
    select.innerHTML = `<option value="">All roles</option>${roles.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
    select.value = roles.includes(currentValue) ? currentValue : "";
}

function renderActivityLogs() {
    const roleFilter = document.getElementById("activityRoleFilter").value.toLowerCase();
    const nameFilter = document.getElementById("activityNameFilter").value.trim().toLowerCase();
    const filtered = activityLogs.filter((log) => {
        const roleName = String(log.actor_role || "System").toLowerCase();
        const actorName = String(log.actor_name || "System").toLowerCase();
        return (!roleFilter || roleName === roleFilter) && (!nameFilter || actorName.includes(nameFilter));
    });
    document.getElementById("activityRows").innerHTML = filtered.length
        ? filtered.map((log) => `<tr><td>${escapeHtml(formatDateTime(log.created_at))}</td><td>${escapeHtml(log.actor_name || "System")}</td><td>${escapeHtml(log.actor_role || "System")}</td><td>${escapeHtml(log.action)}</td><td>${escapeHtml(log.entity_type)} #${escapeHtml(log.entity_id || "—")}</td><td>${escapeHtml(log.details || "—")}</td></tr>`).join("")
        : emptyRow(6, "No activity matches the selected role and name.");
}

function excelCell(value, header = false) {
    const type = typeof value === "number" ? "Number" : "String";
    const style = header ? ' ss:StyleID="Header"' : "";
    return `<Cell${style}><Data ss:Type="${type}">${escapeHtml(value)}</Data></Cell>`;
}

function excelRow(values, header = false) {
    return `<Row>${values.map((value) => excelCell(value, header)).join("")}</Row>`;
}

function excelSheetName(dateValue, usedNames) {
    const baseName = formatDateOnly(dateValue)
        .replace(/[\\/*?:[\]]/g, "")
        .slice(0, 31) || "Date";
    let name = baseName;
    let suffix = 2;
    while (usedNames.has(name)) {
        const suffixText = ` (${suffix})`;
        name = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
        suffix += 1;
    }
    usedNames.add(name);
    return name;
}

function exportExcel() {
    const headers = ["Date", "Time", "Patient", "Category", "Worker", "Status"];
    const rows = reportData.appointments.map((appointment) => [
        formatDateOnly(appointment.date),
        appointment.time_preference,
        appointment.patient_name,
        appointment.category,
        appointment.worker_name || "Unassigned",
        appointment.status
    ]);
    const categoryRows = (reportData.categories || []).map((category) => [
        category.category,
        Number(category.patients || 0),
        Number(category.total || 0)
    ]);
    const appointmentsByDate = reportData.appointments.reduce((groups, appointment) => {
        const dateKey = String(appointment.date || "").slice(0, 10);
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(appointment);
        return groups;
    }, {});
    const usedSheetNames = new Set(["Appointments", "Categories"]);
    const dateWorksheets = Object.keys(appointmentsByDate).sort().map((dateKey) => {
        const dateRows = appointmentsByDate[dateKey].map((appointment) => [
            formatDateOnly(appointment.date),
            appointment.time_preference,
            appointment.patient_name,
            appointment.category,
            appointment.worker_name || "Unassigned",
            appointment.status
        ]);
        return `<Worksheet ss:Name="${escapeHtml(excelSheetName(dateKey, usedSheetNames))}"><Table>${excelRow(headers, true)}${dateRows.map((row) => excelRow(row)).join("")}</Table></Worksheet>`;
    }).join("");
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1E8E5A" ss:Pattern="Solid"/></Style></Styles>
 <Worksheet ss:Name="Appointments"><Table>${excelRow(headers, true)}${rows.map((row) => excelRow(row)).join("")}</Table></Worksheet>
 <Worksheet ss:Name="Categories"><Table>${excelRow(["Appointment category", "Patients", "Appointments"], true)}${categoryRows.map((row) => excelRow(row)).join("")}</Table></Worksheet>
 ${dateWorksheets}
</Workbook>`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
    link.download = `sigla-tala-report-${document.getElementById("fromDate").value}-to-${document.getElementById("toDate").value}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
}

document.getElementById("refreshBtn").addEventListener("click", async () => { await loadReport(); await loadAssignments(); await loadSchedules(); await loadActivity(); });
["statusFilter", "workerFilter", "categoryFilter"].forEach((id) => document.getElementById(id).addEventListener("change", () => {
    reportPage = 1;
    renderReportAnalytics();
    renderReportTable();
}));
document.getElementById("reportSearch").addEventListener("input", () => { reportPage = 1; renderReportTable(); });
document.getElementById("previousPageBtn").addEventListener("click", () => { reportPage -= 1; renderReportTable(); });
document.getElementById("nextPageBtn").addEventListener("click", () => { reportPage += 1; renderReportTable(); });
document.getElementById("drawerCloseBtn").addEventListener("click", closeAppointmentDetails);
document.getElementById("drawerBackdrop").addEventListener("click", closeAppointmentDetails);
document.getElementById("exportBtn").addEventListener("click", exportExcel);
document.getElementById("reloadAssignmentsBtn").addEventListener("click", loadAssignments);
document.getElementById("assignmentSearch").addEventListener("input", renderAssignments);
document.getElementById("reloadActivityBtn").addEventListener("click", loadActivity);
document.getElementById("activityRoleFilter").addEventListener("change", renderActivityLogs);
document.getElementById("activityNameFilter").addEventListener("input", renderActivityLogs);
document.getElementById("scheduleSearch").addEventListener("input", renderSchedules);
document.getElementById("scheduleSpecialization").addEventListener("change", renderSchedules);
document.getElementById("scheduleDateFilter").addEventListener("change", renderSchedules);
document.getElementById("scheduleMonthPrev").addEventListener("click", async () => {
    schedulePlannerDate = new Date(schedulePlannerDate.getFullYear(), schedulePlannerDate.getMonth() - 1, 1);
    selectedScheduleDate = new Date(schedulePlannerDate);
    if (!multiDateSelectMode) selectedScheduleDates.clear();
    updateScheduleDateSelection();
    document.getElementById("scheduleDateFilter").value = "";
    await loadSchedules();
});
document.getElementById("scheduleMonthNext").addEventListener("click", async () => {
    schedulePlannerDate = new Date(schedulePlannerDate.getFullYear(), schedulePlannerDate.getMonth() + 1, 1);
    selectedScheduleDate = new Date(schedulePlannerDate);
    if (!multiDateSelectMode) selectedScheduleDates.clear();
    updateScheduleDateSelection();
    document.getElementById("scheduleDateFilter").value = "";
    await loadSchedules();
});
document.getElementById("plannerTodayBtn").addEventListener("click", async () => {
    const now = new Date();
    schedulePlannerDate = new Date(now.getFullYear(), now.getMonth(), 1);
    selectedScheduleDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!multiDateSelectMode) selectedScheduleDates.clear();
    updateScheduleDateSelection();
    document.getElementById("scheduleDateFilter").value = "";
    await loadSchedules();
});
document.getElementById("toggleMultiDateBtn").addEventListener("click", (event) => {
    multiDateSelectMode = !multiDateSelectMode;
    event.currentTarget.setAttribute("aria-pressed", String(multiDateSelectMode));
    event.currentTarget.textContent = multiDateSelectMode ? "Done selecting dates" : "Select multiple dates";
    updateScheduleDateSelection();
    renderScheduleCalendar();
});
document.getElementById("clearSelectedDatesBtn").addEventListener("click", () => {
    selectedScheduleDates.clear();
    updateScheduleDateSelection();
    renderScheduleCalendar();
});
document.getElementById("printScheduleBtn").addEventListener("click", printSelectedDateSchedule);
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
    tab.setAttribute("aria-selected", "true");
    document.querySelectorAll(".lead-tab").forEach((item) => {
        if (item !== tab) item.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".lead-panel").forEach((panel) => panel.classList.toggle("hidden", panel.id !== tab.dataset.panel));
    if (tab.dataset.panel === "assignmentsPanel") await loadAssignments();
    if (tab.dataset.panel === "schedulesPanel") await loadSchedules();
    if (tab.dataset.panel === "activityPanel") await loadActivity();
}));
document.getElementById("scheduleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateScheduleTime()) { showToast("Please correct the schedule time.", "error"); return; }
    const datesToSave = editingScheduleId
        ? [document.getElementById("scheduleDate").value]
        : [...selectedScheduleDates].sort();
    if (!datesToSave.length) {
        showToast("Select at least one date on the worker schedule calendar.", "error");
        return;
    }

    const workerId = document.getElementById("scheduleWorker").value;
    const startTime = document.getElementById("scheduleStart").value;
    const endTime = document.getElementById("scheduleEnd").value;
    const notes = document.getElementById("scheduleNotes").value;
    const savedDates = [];
    const failedDates = [];
    const isEditing = Boolean(editingScheduleId);

    try {
        for (const scheduleDate of datesToSave) {
            const schedule = {
                scheduleId: isEditing ? editingScheduleId : null,
                workerId,
                scheduleDate,
                startTime,
                endTime,
                notes
            };
            try {
                await request("/schedules", { method: isEditing ? "PUT" : "POST", body: JSON.stringify(schedule) });
                savedDates.push(scheduleDate);
            } catch (error) {
                failedDates.push({ date: scheduleDate, message: error.message });
                if (isEditing) break;
            }
        }

        if (savedDates.length) {
            const lastSavedDate = savedDates[savedDates.length - 1];
            const [year, month, day] = lastSavedDate.split("-").map(Number);
            selectedScheduleDate = new Date(year, month - 1, day);
            schedulePlannerDate = new Date(year, month - 1, 1);
            if (!failedDates.length) {
                selectedScheduleDates = new Set([lastSavedDate]);
                multiDateSelectMode = false;
                document.getElementById("toggleMultiDateBtn").setAttribute("aria-pressed", "false");
                document.getElementById("toggleMultiDateBtn").textContent = "Select multiple dates";
                resetScheduleForm();
            }
        }

        updateScheduleDateSelection();
        await loadSchedules();
        if (failedDates.length) {
            const failures = failedDates.map((item) => `${scheduleLabelDate(item.date, { month: "short", day: "numeric" })}: ${item.message}`).join("; ");
            showToast(`${savedDates.length} saved; ${failedDates.length} failed. ${failures}`, "error");
        } else {
            showToast(isEditing ? "Worker schedule updated." : `${savedDates.length} worker schedule${savedDates.length === 1 ? "" : "s"} saved.`);
        }
    } catch (error) {
        showToast(error.message, "error");
    }
});

updateScheduleDateSelection();
renderScheduleCalendar();
renderSelectedDateSchedules();
loadWorkers();
loadReport();
