const toast = document.getElementById('toast');
const logOutBtn = document.getElementById('logOutBtn');
const LOGIN_URL = 'login.html';
const PATIENT_DASHBOARD_URL = 'patient-dashboard.html';
const API_BASE_URL = window.SIGLA_TALA_API_URL || 'https://sigla-tala-08i8.onrender.com';
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

function clearAuthSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('pendingVerificationEmail');
  sessionStorage.removeItem('siglaTalaAuthView');
}

function forceLogout(message = 'You were logged out due to inactivity.') {
  clearAuthSession();

  if (typeof showToast === 'function') {
    showToast(message, 'warning');
  }

  setTimeout(() => {
    window.history.replaceState(null, '', LOGIN_URL);
    window.location.replace(LOGIN_URL);
  }, 500);
}

function resetInactivityTimer() {
  if (!localStorage.getItem('token')) return;
  clearTimeout(window.siglaInactivityTimer);
  window.siglaInactivityTimer = setTimeout(() => {
    forceLogout('You were logged out due to inactivity.');
  }, INACTIVITY_TIMEOUT_MS);
}

['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach((eventName) => {
  document.addEventListener(eventName, resetInactivityTimer, { passive: true });
});

window.addEventListener('beforeunload', () => {
  if (localStorage.getItem('token')) {
    clearAuthSession();
  }
});

window.addEventListener('pagehide', () => {
  if (localStorage.getItem('token')) {
    clearAuthSession();
  }
});

window.addEventListener('load', resetInactivityTimer);

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null') || {};
  } catch (error) {
    console.error('USER PARSE ERROR:', error);
    return {};
  }
}

function ensureAdminAccess() {
  const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'admin' || localStorage.getItem('demoAdmin') === 'true';

  if (isDemoMode) {
    const currentDemoUser = {
      fullname: 'Admin User',
      email: 'admin@siglatala.com',
      role: 'admin'
    };
    localStorage.setItem('user', JSON.stringify(currentDemoUser));
    localStorage.setItem('demoAdmin', 'true');
    return true;
  }

  const token = localStorage.getItem('token');
  const user = getStoredUser();
  const role = user && user.role ? String(user.role).toLowerCase() : '';

  if (!token || !user || !role) {
    window.location.replace(LOGIN_URL);
    return false;
  }

  if (role !== 'admin') {
    window.location.replace(PATIENT_DASHBOARD_URL);
    return false;
  }

  return true;
}
 
// ===================== Toast helper =====================
let toastTimer;
function showToast(message, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
 
// ===================== Validation helpers =====================
function setError(inputEl, errorEl, message) {
  inputEl.classList.add('invalid');
  errorEl.textContent = message;
}
 
function clearError(inputEl, errorEl) {
  inputEl.classList.remove('invalid');
  errorEl.textContent = '';
}
 
function clearErrors(formEl) {
  formEl.querySelectorAll('input, select').forEach((el) => el.classList.remove('invalid'));
  formEl.querySelectorAll('.error-message').forEach((el) => (el.textContent = ''));
}
 
document.querySelectorAll('input, select').forEach((el) => {
  const handler = () => {
    const errorEl = document.getElementById(el.id + 'Error');
    if (errorEl) clearError(el, errorEl);
  };
  el.addEventListener('input', handler);
  el.addEventListener('change', handler);
});
 
// ===================== App shell elements =====================
const userMenu = document.getElementById('userMenu');
const userMenuTrigger = document.getElementById('userMenuTrigger');
const userMenuName = document.getElementById('userMenuName');
const userDropdown = document.getElementById('userDropdown');
const dropdownName = document.getElementById('dropdownName');
const dropdownEmail = document.getElementById('dropdownEmail');
const views = {
  dashboard: document.getElementById('dashboardView'),
  appointment: document.getElementById('appointmentView'),
  account: document.getElementById('accountView'),
  file: document.getElementById('fileView'),
};
 
const storedUser = getStoredUser();
let currentUser = {
  id: storedUser.id || null,
  name: storedUser.fullname || storedUser.name || 'Admin',
  email: storedUser.email || '',
  age: storedUser.age || '',
  gender: storedUser.gender || '',
  role: storedUser.role || '',
};
const today = new Date();
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
let calendarState = { year: today.getFullYear(), month: today.getMonth() };
let selectedDateISO = null;
let appointments = [];
let announcements = [];

const announcementGrid = document.getElementById('announcementGrid');
const newAnnouncementBtn = document.getElementById('newAnnouncementBtn');
const announcementFormPanel = document.getElementById('announcementFormPanel');
const announcementForm = document.getElementById('announcementForm');
const cancelAnnouncementBtn = document.getElementById('cancelAnnouncementBtn');
const calMonthLabel = document.getElementById('calMonthLabel');
const calendarGrid = document.getElementById('calendarGrid');
const calPrevBtn = document.getElementById('calPrevBtn');
const calNextBtn = document.getElementById('calNextBtn');
const statPending = document.getElementById('statPending');
const statAccepted = document.getElementById('statAccepted');
const calendarDayDetail = document.getElementById('calendarDayDetail');
const calendarDayTitle = document.getElementById('calendarDayTitle');
const calendarDayList = document.getElementById('calendarDayList');
 
function firstNameFrom(fullName) {
  return fullName.trim().split(/\s+/)[0] || 'Admin';
}
 
function showView(viewKey) {
  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== viewKey);
  });
  document.querySelectorAll('.user-dropdown-item[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewKey);
  });
  closeUserDropdown();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (viewKey === 'appointment') {
    loadAppointments().then(() => renderCalendar());
  }
  if (viewKey === 'file') loadMedicalReports();
}
 
function openUserDropdown() {
  userDropdown.classList.remove('hidden');
  userMenu.classList.add('open');
  userMenuTrigger.setAttribute('aria-expanded', 'true');
}
 
function closeUserDropdown() {
  userDropdown.classList.add('hidden');
  userMenu.classList.remove('open');
  userMenuTrigger.setAttribute('aria-expanded', 'false');
}
 
userMenuTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  if (userDropdown.classList.contains('hidden')) {
    openUserDropdown();
  } else {
    closeUserDropdown();
  }
});
 
document.addEventListener('click', (e) => {
  if (!userMenu.contains(e.target)) closeUserDropdown();
});
 
document.querySelectorAll('.user-dropdown-item[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

if (logOutBtn) {
  logOutBtn.addEventListener('click', () => {
    clearAuthSession();

    showToast('You have been logged out.', 'success');

    setTimeout(() => {
      window.history.replaceState(null, '', LOGIN_URL);
      window.location.replace(LOGIN_URL);
    }, 500);
  });
}

// ===================== Load appointments from API =====================
async function loadAppointments() {
  const isDemoMode = localStorage.getItem('demoAdmin') === 'true';
  const token = localStorage.getItem('token');

  // In demo mode without a real token, skip API loading
  if (isDemoMode && !token) {
    console.log('Demo mode: skipping API load');
    // Initialize with empty appointments for demo
    appointments = [];
    return;
  }

  if (!token) {
    console.warn('No token available to load appointments');
    appointments = [];
    return;
  }

  try {
    const headers = { Authorization: `Bearer ${token}` };

    const response = await fetch(`${API_BASE_URL}/api/appointments/admin/all-appointments`, {
      method: 'GET',
      headers: headers
    });

    const data = await response.json();

    if (response.ok && data.appointments) {
      appointments = data.appointments.map((apt) => ({
        id: apt.id,
        dateISO: apt.appointment_date ? apt.appointment_date.split('T')[0] : '',
        patientName: apt.patientName || 'Unknown Patient',
        type: apt.appointment_type || 'Appointment',
        time: apt.time_preference || 'No time selected',
        status: apt.status || 'Pending',
        user_id: apt.user_id
      }));
      console.log('Loaded appointments:', appointments);
    } else {
      console.warn('Failed to load appointments:', data);
      appointments = [];
    }
  } catch (error) {
    console.error('APPOINTMENT LOAD ERROR:', error);
    showToast('Failed to load appointments from server', 'error');
    appointments = [];
  }
}

// ===================== Update appointment status on API =====================
async function updateAppointmentStatusAPI(appointmentId, newStatus) {
  const token = localStorage.getItem('token');
  const isDemoMode = localStorage.getItem('demoAdmin') === 'true';

  if (!isDemoMode && !token) {
    console.warn('No token available to update appointment');
    return false;
  }

  try {
    const headers = isDemoMode ? { 'Content-Type': 'application/json' } : {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };

    const response = await fetch(`${API_BASE_URL}/api/appointments/admin/update-status`, {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify({
        appointmentId: appointmentId,
        status: newStatus
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Appointment status updated:', data);
      return true;
    } else {
      console.warn('Failed to update appointment status:', data);
      return false;
    }
  } catch (error) {
    console.error('UPDATE APPOINTMENT ERROR:', error);
    return false;
  }
}


// ===================== Boot straight into the dashboard =====================
async function initApp() {

  const demoUser = getStoredUser();
  if (demoUser && demoUser.role === 'admin' && !currentUser.email) {
    currentUser = {
      id: demoUser.id || null,
      name: demoUser.fullname || demoUser.name || 'Admin',
      email: demoUser.email || '',
      age: demoUser.age || '',
      gender: demoUser.gender || '',
      role: demoUser.role || ''
    };
  }

  userMenuName.textContent = firstNameFrom(currentUser.name);
  dropdownName.textContent = currentUser.name;
  dropdownEmail.textContent = currentUser.email || 'No email set';
 
  document.getElementById('accFullName').value = currentUser.name;
  document.getElementById('accEmail').value = currentUser.email;
  document.getElementById('accAge').value = currentUser.age;
  document.getElementById('accGender').value = currentUser.gender;
  await loadSavedProfile();
 
  renderAnnouncements();
  loadAnnouncements();

  showView('appointment');
}
 
if (ensureAdminAccess()) {
  initApp();
}

function renderAnnouncements() {
  if (!announcements.length) {
    announcementGrid.innerHTML = '<p class="empty-state">No announcements posted yet.</p>';
    return;
  }

  announcementGrid.innerHTML = announcements
    .map(
      (a) => `
      <article class="announcement-card">
        <button type="button" class="card-delete-btn" data-id="${a.id}" aria-label="Delete announcement">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0h10l-1 13a1 1 0 01-1 1H8a1 1 0 01-1-1L6 7z"/></svg>
        </button>
        <div class="announcement-date">${a.date}</div>
        <h3>${a.title}</h3>
        <p>${a.content}</p>
      </article>`
    )
    .join('');

  announcementGrid.querySelectorAll('.card-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/announcements/${btn.dataset.id}`, {
          method: 'DELETE',
        });

        if (!response.ok) throw new Error('Failed to delete announcement.');

        await loadAnnouncements();
        showToast('Announcement deleted.', 'success');
      } catch (error) {
        console.error('ANNOUNCEMENT DELETE ERROR:', error);
        showToast('Failed to delete announcement.', 'error');
      }
    });
  });
}

async function loadAnnouncements() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/announcements`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.message || 'Failed to load announcements.');

    announcements = (data.announcements || []).map((announcement) => ({
      ...announcement,
      date: new Date(announcement.created_at).toLocaleDateString(),
    }));
    renderAnnouncements();
  } catch (error) {
    console.error('ANNOUNCEMENT LOAD ERROR:', error);
    showToast('Failed to load announcements.', 'error');
  }
}

async function loadSavedProfile() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load profile.');

    currentUser.name = data.user.fullname;
    currentUser.age = data.user.age;
    currentUser.gender = data.user.gender;
    localStorage.setItem('user', JSON.stringify({ ...getStoredUser(), ...data.user }));
    userMenuName.textContent = firstNameFrom(currentUser.name);
    dropdownName.textContent = currentUser.name;
    document.getElementById('accFullName').value = currentUser.name;
    document.getElementById('accAge').value = currentUser.age;
    document.getElementById('accGender').value = currentUser.gender;
  } catch (error) {
    console.error('PROFILE LOAD ERROR:', error);
  }
}

newAnnouncementBtn.addEventListener('click', () => {
  announcementFormPanel.classList.remove('hidden');
  document.getElementById('annTitle').focus();
});
 
cancelAnnouncementBtn.addEventListener('click', () => {
  announcementForm.reset();
  clearErrors(announcementForm);
  announcementFormPanel.classList.add('hidden');
});

const annCloseBtn = document.getElementById('annCloseBtn');
if (annCloseBtn) {
  annCloseBtn.addEventListener('click', () => {
    announcementForm.reset();
    clearErrors(announcementForm);
    announcementFormPanel.classList.add('hidden');
  });
}
 
announcementForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const titleEl = document.getElementById('annTitle');
  const contentEl = document.getElementById('annContent');
  const titleError = document.getElementById('annTitleError');
  const contentError = document.getElementById('annContentError');
 
  let valid = true;
  if (!titleEl.value.trim()) {
    setError(titleEl, titleError, 'Title is required.');
    valid = false;
  }
  if (!contentEl.value.trim()) {
    setError(contentEl, contentError, 'Content is required.');
    valid = false;
  }
  if (!valid) return;

  const token = localStorage.getItem('token');
  const isDemoMode = localStorage.getItem('demoAdmin') === 'true';

  try {
    const response = await fetch(`${API_BASE_URL}/api/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && !isDemoMode ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        title: titleEl.value.trim(),
        content: contentEl.value.trim(),
      }),
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.message || 'Failed to post announcement.');

    await loadAnnouncements();
    announcementForm.reset();
    announcementFormPanel.classList.add('hidden');
    showToast('Announcement posted!', 'success');
  } catch (error) {
    console.error('ANNOUNCEMENT CREATE ERROR:', error);
    showToast('Failed to post announcement.', 'error');
  }
});
 
// ===================== Appointment calendar =====================

function isoDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
 
function updateCalendarStats() {
  statPending.textContent = appointments.filter((a) => a.status === 'Pending').length;
  statAccepted.textContent = appointments.filter((a) => a.status === 'Accepted').length;
}
 
function renderCalendar() {
  const { year, month } = calendarState;
  calMonthLabel.textContent = `${monthNames[month]} ${year}`;

  const monthAppointments = appointments.filter((a) => {
    const apptDate = new Date(a.dateISO + 'T00:00:00');
    return apptDate.getFullYear() === year && apptDate.getMonth() === month;
  });

  if (!selectedDateISO || !monthAppointments.some((a) => a.dateISO === selectedDateISO)) {
    selectedDateISO = monthAppointments[0]?.dateISO || isoDate(year, month, 1);
  }

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  let cellsHtml = '';
  for (let i = 0; i < firstWeekday; i++) {
    cellsHtml += '<div class="calendar-cell calendar-cell-empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dISO = isoDate(year, month, d);
    const dayAppts = appointments.filter((a) => a.dateISO === dISO);
    const hasPending = dayAppts.some((a) => a.status !== 'Accepted');
    const hasAccepted = dayAppts.some((a) => a.status === 'Accepted');

    let dotsHtml = '<div class="calendar-dots">';
    if (hasPending) dotsHtml += '<span class="calendar-dot dot-pending"></span>';
    if (hasAccepted) dotsHtml += '<span class="calendar-dot dot-accepted"></span>';
    dotsHtml += '</div>';

    const classes = ['calendar-cell'];
    if (dISO === todayISO) classes.push('calendar-cell-today');
    if (dISO === selectedDateISO) classes.push('calendar-cell-selected');

    cellsHtml += `<button type="button" class="${classes.join(' ')}" data-date="${dISO}">${d}${dotsHtml}</button>`;
  }

  calendarGrid.innerHTML = cellsHtml;

  calendarGrid.querySelectorAll('.calendar-cell:not(.calendar-cell-empty)').forEach((cell) => {
    cell.addEventListener('click', () => {
      selectedDateISO = cell.dataset.date;
      renderCalendar();
      renderDayDetail(selectedDateISO);
    });
  });

  updateCalendarStats();
  renderDayDetail(selectedDateISO);
}
 
function renderDayDetail(dateISO) {
  const dayAppts = appointments.filter((a) => a.dateISO === dateISO);
  const niceDate = new Date(dateISO + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
 
  calendarDayDetail.classList.remove('hidden');
  calendarDayTitle.textContent = `Scheduled Patients — ${niceDate}`;
 
  if (!dayAppts.length) {
    calendarDayList.innerHTML = '<p class="empty-state">No patients scheduled for this date.</p>';
    return;
  }
 
  calendarDayList.innerHTML = dayAppts
    .map((a) => {
      const actionMarkup =
        a.status === 'Accepted'
          ? '<span class="status-accepted-tag">Accepted</span>'
          : a.status === 'Rejected'
            ? '<span class="status-rejected-tag">Rejected</span>'
            : `
              <div class="appointment-actions">
                <button type="button" class="btn-accept" data-id="${a.id}">Accept</button>
                <button type="button" class="btn-reject" data-id="${a.id}">Reject</button>
              </div>
            `;

      return `
        <div class="day-patient-item">
          <div class="day-patient-main">
            <div class="day-patient-name">${a.patientName || 'Patient'}</div>
            <div class="day-patient-type">${a.type}</div>
            <div class="day-patient-time">${a.time}</div>
          </div>
          ${actionMarkup}
        </div>`;
    })
    .join('');
 
  calendarDayList.querySelectorAll('.btn-accept').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const appt = appointments.find((a) => a.id === Number(btn.dataset.id));
      if (appt) {
        const success = await updateAppointmentStatusAPI(appt.id, 'Accepted');
        if (success) {
          showToast('Appointment accepted.', 'success');
        } else {
          showToast('Failed to accept appointment.', 'error');
        }
      }
    });
  });

  calendarDayList.querySelectorAll('.btn-reject').forEach(( btn) => {
    btn.addEventListener('click', async () => {
      const appt = appointments.find((a) => a.id === Number(btn.dataset.id));
      if (appt) {
        const success = await updateAppointmentStatusAPI(appt.id, 'Rejected');
        if (success) {
          showToast('Appointment rejected.', 'error');
        } else {
          showToast('Failed to reject appointment.', 'error');
        }
      }
    });
  });
}
 
calPrevBtn.addEventListener('click', () => {
  calendarState.month -= 1;
  if (calendarState.month < 0) {
    calendarState.month = 11;
    calendarState.year -= 1;
  }
  renderCalendar();
});
 
calNextBtn.addEventListener('click', () => {
  calendarState.month += 1;
  if (calendarState.month > 11) {
    calendarState.month = 0;
    calendarState.year += 1;
  }
  renderCalendar();
});
 
// ===================== Account overview =====================
const accountForm = document.getElementById('accountForm');
accountForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fullname = document.getElementById('accFullName').value.trim();
  const age = Number(document.getElementById('accAge').value);
  const gender = document.getElementById('accGender').value;
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fullname, age, gender }),
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.message || 'Failed to save profile.');

    currentUser.name = data.user.fullname;
    currentUser.age = data.user.age;
    currentUser.gender = data.user.gender;
    localStorage.setItem('user', JSON.stringify({
      ...getStoredUser(),
      fullname: currentUser.name,
      age: currentUser.age,
      gender: currentUser.gender,
    }));
    userMenuName.textContent = firstNameFrom(currentUser.name);
    dropdownName.textContent = currentUser.name;
    showToast('Profile saved!', 'success');
  } catch (error) {
    console.error('PROFILE SAVE ERROR:', error);
    showToast(error.message, 'error');
  }
});
 
// ===================== File management =====================
const tabButtons = document.querySelectorAll('.tab-btn');
const pendingReportsTab = document.getElementById('pendingReportsTab');
const medicalReportsTab = document.getElementById('medicalReportsTab');
const pendingReportsList = document.getElementById('pendingReportsList');
const medicalReportsList = document.getElementById('medicalReportsList');
const pendingReportsCount = document.getElementById('pendingReportsCount');
const medicalReportFormPanel = document.getElementById('medicalReportFormPanel');
const medicalReportForm = document.getElementById('medicalReportForm');

function escapeReportHTML(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

async function loadMedicalReports() {
  try {
    const [pendingResponse, reportsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/medical-reports/pending`),
      fetch(`${API_BASE_URL}/api/medical-reports`),
    ]);
    const pendingData = await pendingResponse.json();
    const reportsData = await reportsResponse.json();
    const pending = pendingData.appointments || [];
    const reports = reportsData.reports || [];
    pendingReportsCount.textContent = pending.length;

    pendingReportsList.innerHTML = pending.length ? pending.map((item) => `
      <div class="day-patient-item">
        <div class="day-patient-main">
          <div class="day-patient-name">${escapeReportHTML(item.patient_name)}</div>
          <div class="day-patient-type">${escapeReportHTML(item.file_name || 'No file attached')}</div>
          <div class="day-patient-time">${escapeReportHTML(item.appointment_date)} - ${escapeReportHTML(item.time_preference)}</div>
        </div>
        <button type="button" class="btn-primary create-report-btn" data-appointment-id="${item.appointment_id}" data-user-id="${item.user_id}" data-patient="${escapeReportHTML(item.patient_name)}">Create Report</button>
      </div>`).join('') : '<p class="empty-state">No pending reports to encode.</p>';

    medicalReportsList.innerHTML = reports.length ? reports.map((report) => `
      <article class="announcement-card"><div class="announcement-date">${escapeReportHTML(report.recorded_date)}</div><h3>${escapeReportHTML(report.patient_name)}</h3><p><strong>${escapeReportHTML(report.diagnostic)}</strong><br>${escapeReportHTML(report.notes)}</p></article>
    `).join('') : '<p class="empty-state">No medical reports encoded yet.</p>';

    pendingReportsList.querySelectorAll('.create-report-btn').forEach((button) => button.addEventListener('click', () => openMedicalReportForm(button.dataset)));
  } catch (error) {
    console.error('MEDICAL REPORT LOAD ERROR:', error);
    showToast('Failed to load medical reports.', 'error');
  }
}

function openMedicalReportForm(data) {
  document.getElementById('reportAppointmentId').value = data.appointmentId;
  document.getElementById('reportUserId').value = data.userId;
  document.getElementById('reportPatientContext').textContent = `Report for ${data.patient}`;
  document.getElementById('reportDoctorName').value = currentUser.name;
  document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];
  medicalReportFormPanel.classList.remove('hidden');
}

async function saveMedicalReport(event) {
  event.preventDefault();
  try {
    const response = await fetch(`${API_BASE_URL}/api/medical-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment_id: document.getElementById('reportAppointmentId').value,
        user_id: document.getElementById('reportUserId').value,
        doctor_name: document.getElementById('reportDoctorName').value.trim(),
        recorded_date: document.getElementById('reportDate').value,
        diagnostic: document.getElementById('reportDiagnostic').value.trim(),
        notes: document.getElementById('reportNotes').value.trim(),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to save medical report.');
    medicalReportForm.reset();
    medicalReportFormPanel.classList.add('hidden');
    showToast(data.emailSent === false ? 'Report saved, but email failed.' : 'Report saved and emailed to the patient.', data.emailSent === false ? 'error' : 'success');
    loadMedicalReports();
  } catch (error) {
    console.error('MEDICAL REPORT SAVE ERROR:', error);
    showToast(error.message, 'error');
  }
}

medicalReportForm.addEventListener('submit', saveMedicalReport);
document.getElementById('cancelMedicalReportBtn').addEventListener('click', () => medicalReportFormPanel.classList.add('hidden'));
document.getElementById('closeMedicalReportBtn').addEventListener('click', () => medicalReportFormPanel.classList.add('hidden'));
 
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
    pendingReportsTab.classList.toggle('hidden', btn.dataset.tab !== 'pending');
    medicalReportsTab.classList.toggle('hidden', btn.dataset.tab !== 'medical');
  });
});