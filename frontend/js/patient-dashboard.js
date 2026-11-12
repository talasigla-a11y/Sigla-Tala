
const API_BASE_URL = window.SIGLA_TALA_API_URL || "https://api.siglatala.com";
const LOGIN_URL = "../pages/login.html";
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

function clearAuthSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("pendingVerificationEmail");
    sessionStorage.removeItem("siglaTalaAuthView");
}

function forceLogout(message = "You were logged out due to inactivity.") {
    clearAuthSession();

    if (typeof showToast === "function") {
        showToast(message, "warning");
    }

    setTimeout(function () {
        window.history.replaceState(null, "", LOGIN_URL);
        window.location.replace(LOGIN_URL);
    }, 500);
}

function resetInactivityTimer() {
    if (!localStorage.getItem("token")) return;
    clearTimeout(window.siglaInactivityTimer);
    window.siglaInactivityTimer = setTimeout(function () {
        forceLogout("You were logged out due to inactivity.");
    }, INACTIVITY_TIMEOUT_MS);
}

["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(function (eventName) {
    document.addEventListener(eventName, resetInactivityTimer, { passive: true });
});

window.addEventListener("beforeunload", function () {
    if (localStorage.getItem("token")) {
        clearAuthSession();
    }
});

window.addEventListener("pagehide", function () {
    if (localStorage.getItem("token")) {
        clearAuthSession();
    }
});

window.addEventListener("load", resetInactivityTimer);


const userMenu =
    document.getElementById("userMenu");

const userMenuTrigger =
    document.getElementById("userMenuTrigger");

const userMenuName =
    document.getElementById("userMenuName");

const userDropdown =
    document.getElementById("userDropdown");

const dropdownName =
    document.getElementById("dropdownName");

const dropdownEmail =
    document.getElementById("dropdownEmail");

const logOutBtn =
    document.getElementById("logOutBtn");

const toast =
    document.getElementById("toast");

const announcementGrid =
    document.getElementById("announcementGrid");

const patientAnnouncementModal = document.getElementById("patientAnnouncementModal");
const patientAnnouncementClose = document.getElementById("patientAnnouncementClose");
let patientAnnouncements = [];
let patientAnnouncementIndex = 0;



const dashboardView =
    document.getElementById("dashboardView");

const appointmentView =
    document.getElementById("appointmentView");

const patientCalendarWidget =
    document.getElementById("patientCalendarWidget");

const patientAppointmentsWidget =
    document.getElementById("patientAppointmentsWidget");

const accountView =
    document.getElementById("accountView");


const views = {

    dashboard:
        dashboardView,

    appointment:
        appointmentView,

    account:
        accountView

};



let currentUser = {};

let toastTimer;



function showToast(message, type = "success") {

    if (!toast) return;

    clearTimeout(toastTimer);

    toast.textContent = message;

    toast.className =
        "toast show " + type;

    toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);

}



function getFirstName(name) {

    if (!name) {
        return "Account";
    }

    return name
        .trim()
        .split(/\s+/)[0];

}



function showView(viewName) {

    Object.keys(views).forEach((key) => {

        if (views[key]) {

            if (key === viewName) {

                views[key].classList.remove(
                    "hidden"
                );

            } else {

                views[key].classList.add(
                    "hidden"
                );

            }

        }

    });


    document
        .querySelectorAll(
            ".user-dropdown-item[data-view]"
        )
        .forEach((button) => {

            button.classList.toggle(
                "active",
                button.dataset.view === viewName
            );

        });

    document
        .querySelectorAll(".patient-nav-item[data-patient-view]")
        .forEach((button) => {
            const buttonView = button.dataset.patientView;
            button.classList.toggle(
                "active",
                buttonView === viewName ||
                buttonView === "appointment"
            );
        });

    if (patientCalendarWidget && patientAppointmentsWidget) {
        const isAppointmentView = viewName === "appointment";
        patientCalendarWidget.classList.toggle("hidden", isAppointmentView);
        patientAppointmentsWidget.classList.toggle("hidden", !isAppointmentView);
    }


    closeUserMenu();

    if (viewName === "dashboard") {
        loadAnnouncements();
    }


    if (viewName === "appointment") {

        loadAppointments();

    }

}

const patientCalendarGrid = document.getElementById("patientCalendarGrid");
const patientCalendarLabel = document.getElementById("patientCalendarLabel");
const selectedDatePreview = document.getElementById("selectedDatePreview");
let patientCalendarDate = new Date();
let selectedCalendarDate = new Date();
let availabilityRequestId = 0;

function calendarDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatCalendarDate(value) {
    return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function updateAppointmentTimeOptions(bookedTimes, dateKey) {
    const booked = new Set(bookedTimes);
    Array.from(appointmentTime.options).forEach((option) => {
        if (!option.value) return;
        if (!option.dataset.defaultLabel) {
            option.dataset.defaultLabel = option.textContent;
        }
        const isBooked = booked.has(option.value);
        option.disabled = isBooked;
        option.textContent = isBooked
            ? `${option.dataset.defaultLabel} (Booked)`
            : option.dataset.defaultLabel;
    });
    if (appointmentTime.selectedOptions[0]?.disabled) {
        appointmentTime.value = "";
    }
    appointmentTime.dataset.availabilityDate = dateKey || "";
    const availabilityHint = document.getElementById("appointmentAvailabilityHint");
    if (availabilityHint) {
        availabilityHint.textContent = dateKey
            ? booked.size
                ? `${booked.size} time slot${booked.size === 1 ? "" : "s"} already booked.`
                : "All time slots are currently available."
            : "Select a date to view available time slots.";
    }
}

function renderDateAvailability(dateKey, bookedTimes) {
    const booked = new Set(bookedTimes);
    const slots = Array.from(appointmentTime.options).filter((option) => option.value);
    const availableCount = slots.filter((option) => !booked.has(option.value)).length;
    selectedDatePreview.innerHTML = `
        <h3>${escapeHTML(formatCalendarDate(dateKey))}</h3>
        <p>${availableCount ? `${availableCount} time slots available` : "No time slots available"} · ${booked.size} booked</p>
        <div class="availability-slot-list">
            ${slots.map((option) => {
                const isBooked = booked.has(option.value);
                return `<button type="button" class="availability-slot${isBooked ? " booked" : ""}" data-time-slot="${escapeHTML(option.value)}"${isBooked ? " disabled" : ""}>${escapeHTML(option.dataset.defaultLabel || option.textContent)}<span>${isBooked ? "Booked" : "Available"}</span></button>`;
            }).join("")}
        </div>`;
}

async function loadDateAvailability(dateKey) {
    if (!dateKey) {
        updateAppointmentTimeOptions([], "");
        selectedDatePreview.innerHTML = "<p>Select a date to view available time slots.</p>";
        return;
    }

    const requestId = ++availabilityRequestId;
    selectedDatePreview.innerHTML = `<p>Loading time availability for ${escapeHTML(formatCalendarDate(dateKey))}...</p>`;
    Array.from(appointmentTime.options).forEach((option) => {
        if (option.value) option.disabled = true;
    });
    if (appointmentTime.value) appointmentTime.value = "";
    const availabilityHint = document.getElementById("appointmentAvailabilityHint");
    if (availabilityHint) availabilityHint.textContent = "Checking available times...";
    try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/api/appointments/availability?date=${encodeURIComponent(dateKey)}`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Unable to load time availability.");
        if (requestId !== availabilityRequestId) return;
        const bookedTimes = Array.isArray(data.booked_times)
            ? data.booked_times.map((time) => String(time).trim())
            : [];
        updateAppointmentTimeOptions(bookedTimes, dateKey);
        renderDateAvailability(dateKey, bookedTimes);
    } catch (error) {
        if (requestId !== availabilityRequestId) return;
        console.error("APPOINTMENT AVAILABILITY ERROR:", error);
        updateAppointmentTimeOptions(Array.from(appointmentTime.options).filter((option) => option.value).map((option) => option.value), dateKey);
        const availabilityHint = document.getElementById("appointmentAvailabilityHint");
        if (availabilityHint) availabilityHint.textContent = "Unable to load time availability.";
        selectedDatePreview.innerHTML = "<p>Unable to load available times. Please try again.</p>";
    }
}

function renderPatientCalendar() {
    const year = patientCalendarDate.getFullYear();
    const month = patientCalendarDate.getMonth();
    patientCalendarLabel.textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(patientCalendarDate);
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = calendarDateKey(new Date());
    patientCalendarGrid.replaceChildren();
    for (let index = 0; index < firstDay; index += 1) {
        const blank = document.createElement("span");
        patientCalendarGrid.appendChild(blank);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        const key = calendarDateKey(date);
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = day;
        button.classList.toggle("today", key === todayKey);
        button.classList.toggle("selected", key === calendarDateKey(selectedCalendarDate));
        button.addEventListener("click", () => {
            selectedCalendarDate = date;
            if (appointmentDate) {
                appointmentDate.value = key;
                updateAppointmentTypeDetails();
            }
            renderPatientCalendar();
            loadDateAvailability(key);
        });
        patientCalendarGrid.appendChild(button);
    }
}

document.getElementById("patientCalendarPrev").addEventListener("click", () => {
    patientCalendarDate = new Date(patientCalendarDate.getFullYear(), patientCalendarDate.getMonth() - 1, 1);
    renderPatientCalendar();
});
document.getElementById("patientCalendarNext").addEventListener("click", () => {
    patientCalendarDate = new Date(patientCalendarDate.getFullYear(), patientCalendarDate.getMonth() + 1, 1);
    renderPatientCalendar();
});
document.querySelectorAll("[data-patient-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.patientView));
});

selectedDatePreview.addEventListener("click", (event) => {
    const slotButton = event.target.closest("[data-time-slot]");
    if (!slotButton || slotButton.disabled) return;
    const dateKey = calendarDateKey(selectedCalendarDate);
    appointmentDate.value = dateKey;
    appointmentTime.value = slotButton.dataset.timeSlot;
    updateAppointmentTypeDetails();
    showView("appointment");
});
renderPatientCalendar();
loadDateAvailability(calendarDateKey(selectedCalendarDate));


async function loadAnnouncements() {

    if (!announcementGrid) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/announcements`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || "Unable to load announcements.");
        }

        patientAnnouncements = data.announcements || [];

        if (!patientAnnouncements.length) {
            announcementGrid.innerHTML = `<p class="empty-state">No announcements posted yet.</p>`;
            return;
        }

        patientAnnouncementIndex = Math.min(patientAnnouncementIndex, patientAnnouncements.length - 1);
        renderPatientAnnouncement();
    } catch (error) {
        console.error("ANNOUNCEMENT LOAD ERROR:", error);
        announcementGrid.innerHTML = `<p class="empty-state">Unable to load announcements.</p>`;
    }
}

function renderPatientAnnouncement() {
    const announcement = patientAnnouncements[patientAnnouncementIndex];
    if (!announcement) return;

    announcementGrid.innerHTML = `
        <article class="announcement-card patient-announcement-slide">
            ${announcement.has_poster
                ? `<img class="patient-announcement-slide-poster" src="${API_BASE_URL}/api/announcements/${encodeURIComponent(announcement.id)}/poster" alt="Poster for ${escapeHTML(announcement.title)}">`
                : `<div class="patient-announcement-slide-placeholder" aria-hidden="true">Sigla Tala</div>`}
            <div class="patient-announcement-slide-content">
                <p class="announcement-date">${escapeHTML(new Date(announcement.created_at).toLocaleDateString())}</p>
                <h3>${escapeHTML(announcement.title)}</h3>
                <p>${escapeHTML(announcement.content || (announcement.has_poster ? "View the announcement poster." : ""))}</p>
                <button type="button" class="btn-secondary btn-compact announcement-view-btn">View announcement</button>
            </div>
        </article>
        <div class="patient-announcement-controls" aria-label="Announcement navigation">
            <button type="button" class="patient-announcement-prev" aria-label="Previous announcement">‹</button>
            <span aria-live="polite">${patientAnnouncementIndex + 1} / ${patientAnnouncements.length}</span>
            <button type="button" class="patient-announcement-next" aria-label="Next announcement">›</button>
        </div>`;

    announcementGrid.querySelector(".announcement-view-btn").addEventListener("click", () => openPatientAnnouncement(announcement));
    announcementGrid.querySelector(".patient-announcement-prev").addEventListener("click", () => {
        patientAnnouncementIndex = (patientAnnouncementIndex - 1 + patientAnnouncements.length) % patientAnnouncements.length;
        renderPatientAnnouncement();
    });
    announcementGrid.querySelector(".patient-announcement-next").addEventListener("click", () => {
        patientAnnouncementIndex = (patientAnnouncementIndex + 1) % patientAnnouncements.length;
        renderPatientAnnouncement();
    });
}

function openPatientAnnouncement(announcement) {
    document.getElementById("patientAnnouncementTitle").textContent = announcement.title || "Announcement";
    document.getElementById("patientAnnouncementDate").textContent = new Date(announcement.created_at).toLocaleDateString();
    document.getElementById("patientAnnouncementContent").textContent = announcement.content || "";
    const poster = document.getElementById("patientAnnouncementPoster");
    if (announcement.has_poster) {
        poster.src = `${API_BASE_URL}/api/announcements/${encodeURIComponent(announcement.id)}/poster`;
        poster.classList.remove("hidden");
    } else {
        poster.removeAttribute("src");
        poster.classList.add("hidden");
    }
    patientAnnouncementModal.classList.remove("hidden");
    patientAnnouncementModal.setAttribute("aria-hidden", "false");
    patientAnnouncementClose.focus();
}

function closePatientAnnouncement() {
    patientAnnouncementModal.classList.add("hidden");
    patientAnnouncementModal.setAttribute("aria-hidden", "true");
}

patientAnnouncementClose.addEventListener("click", closePatientAnnouncement);
patientAnnouncementModal.addEventListener("click", (event) => {
    if (event.target === patientAnnouncementModal) closePatientAnnouncement();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !patientAnnouncementModal.classList.contains("hidden")) closePatientAnnouncement();
});



function openUserMenu() {

    if (!userDropdown) return;

    userDropdown.classList.remove(
        "hidden"
    );

    if (userMenu) {
        userMenu.classList.add("open");
    }

    if (userMenuTrigger) {

        userMenuTrigger.setAttribute(
            "aria-expanded",
            "true"
        );

    }

}


function closeUserMenu() {

    if (!userDropdown) return;

    userDropdown.classList.add(
        "hidden"
    );

    if (userMenu) {
        userMenu.classList.remove("open");
    }

    if (userMenuTrigger) {

        userMenuTrigger.setAttribute(
            "aria-expanded",
            "false"
        );

    }

}


if (userMenuTrigger) {

    userMenuTrigger.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

            if (
                userDropdown.classList.contains(
                    "hidden"
                )
            ) {

                openUserMenu();

            } else {

                closeUserMenu();

            }

        }
    );

}


document.addEventListener(
    "click",
    function (event) {

        if (
            userMenu &&
            !userMenu.contains(event.target)
        ) {

            closeUserMenu();

        }

    }
);



document
    .querySelectorAll(
        ".user-dropdown-item[data-view]"
    )
    .forEach((button) => {

        button.addEventListener(
            "click",
            function () {

                showView(
                    button.dataset.view
                );

            }
        );

    });



if (logOutBtn) {

    logOutBtn.addEventListener(
        "click",
        function () {

            clearAuthSession();

            showToast(
                "You have been logged out.",
                "success"
            );

            setTimeout(function () {
                window.history.replaceState(null, "", LOGIN_URL);
                window.location.replace(LOGIN_URL);
            }, 500);

        }
    );

}



function loadUserInformation() {

    const savedUser =
        localStorage.getItem("user");


    if (!savedUser) {
        return false;
    }


    try {

        currentUser =
            JSON.parse(savedUser);

    } catch (error) {

        console.error(
            "USER DATA ERROR:",
            error
        );

        localStorage.removeItem("user");

        return false;

    }


    const name =
        currentUser.fullname ||
        currentUser.name ||
        "Patient";


    const email =
        currentUser.email ||
        "";


    if (userMenuName) {

        userMenuName.textContent =
            getFirstName(name);

    }


    if (dropdownName) {

        dropdownName.textContent =
            name;

    }


    if (dropdownEmail) {

        dropdownEmail.textContent =
            email;

    }


    const fullName =
        document.getElementById(
            "accFullName"
        );

    const accountEmail =
        document.getElementById(
            "accEmail"
        );

    const age =
        document.getElementById(
            "accAge"
        );

    const gender =
        document.getElementById(
            "accGender"
        );


    if (fullName) {

        fullName.value =
            name;

    }


    if (accountEmail) {

        accountEmail.value =
            email;

    }


    if (age) {

        age.value =
            currentUser.age || "";

    }


    if (gender) {

        gender.value =
            currentUser.gender || "";

    }


    return true;

}

async function loadSavedProfile() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Unable to load profile.");

        currentUser = { ...currentUser, ...data.user };
        localStorage.setItem("user", JSON.stringify(currentUser));
        loadUserInformation();
    } catch (error) {
        console.error("PROFILE LOAD ERROR:", error);
    }
}



async function checkSession() {

    const token =
        localStorage.getItem("token");

    const savedUser =
        localStorage.getItem("user");

    if (savedUser) {

        try {

            const parsedUser =
                JSON.parse(savedUser);

            if (
                parsedUser &&
                ["worker", "admin"].includes(String(parsedUser.role || "").toLowerCase())
            ) {

                window.location.href =
                    "../pages/admin-dashboard.html";

                return false;

            }

        } catch (error) {

            console.error(
                "USER PARSE ERROR:",
                error
            );

        }

    }


    if (!token || !savedUser) {

        window.location.href =
            LOGIN_URL;

        return false;

    }


    if (!loadUserInformation()) {

        localStorage.removeItem(
            "token"
        );

        localStorage.removeItem(
            "user"
        );

        window.location.href =
            LOGIN_URL;

        return false;

    }


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/dashboard`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            localStorage.removeItem(
                "token"
            );

            localStorage.removeItem(
                "user"
            );

            window.location.href =
                LOGIN_URL;

            return false;

        }


        if (
            !response.ok &&
            response.status !== 404
        ) {

            console.warn(
                "Session check failed:",
                response.status
            );

        }


    } catch (error) {

        console.warn(
            "Could not connect to session endpoint.",
            error
        );

    }


    return true;

}



const appointmentForm =
    document.getElementById(
        "appointmentForm"
    );

const appointmentType =
    document.getElementById(
        "apptType"
    );

const appointmentProvider =
    document.getElementById(
        "apptProvider"
    );

const appointmentRequirements =
    document.getElementById("apptRequirements");

const appointmentRequirementsList =
    document.getElementById("apptRequirementsList");

const otherAppointmentReasonField =
    document.getElementById("otherAppointmentReasonField");

const otherAppointmentReason =
    document.getElementById("otherAppointmentReason");

const otherAppointmentReasonError =
    document.getElementById("otherAppointmentReasonError");

const requirementsByAppointmentType = {
    "general consultation": [
        "Valid government-issued ID or Barangay ID showing proof of residency.",
        "Barangay Clearance or Certificate of Residency for first-time visitors.",
        "Individual Treatment Record (ITR) or Health Center Card for returning patients.",
        "PhilHealth ID number or PhilHealth YAKAP registration (optional; helpful for lab tests and medicines).",
        "Medical records or previous prescriptions for ongoing conditions, if applicable."
    ],
    vaccination: [
        "Infants and children: Mother and Child Booklet or Baby's Immunization (EPI) Card.",
        "Infants and children registering for the first time: Child's PSA or LCR Birth Certificate and the parent/guardian's valid ID.",
        "Adults and seniors: Valid government ID or Senior Citizen ID.",
        "Adults and seniors: Previous vaccination card or record, if available.",
        "Anti-rabies vaccination: Animal Bite Incident Form or referral."
    ],
    "prenatal check-up": [
        "Home-Based Mother Record (HBMR) or Pink Card; it may be provided at the first check-up.",
        "Valid ID of the mother.",
        "PSA Birth Certificate or Marriage Contract for record verification.",
        "PhilHealth Member ID or Member Data Record (MDR), if available.",
        "Previous ultrasound, blood test, or laboratory results, if available."
    ],
    dental: [
        "Valid government-issued ID or Barangay ID.",
        "Health Center Patient Card or record, if available.",
        "PhilHealth YAKAP enrollment, if available.",
        "Patients under 18 receiving a tooth extraction: signed parental consent form."
    ],
    "pediatric consultation": [
        "Child's PSA or Local Civil Registrar (LCR) Birth Certificate.",
        "Baby's Growth and Development Chart or Immunization Card, if available.",
        "Valid ID of the parent or legal guardian.",
        "If accompanied by someone other than a parent: authorization letter and the guardian's valid ID."
    ],
    other: []
};

let providerRequestId = 0;

async function updateAppointmentTypeDetails() {
    if (!appointmentType || !appointmentProvider) return;

    const requestId = ++providerRequestId;
    const selectedOption = appointmentType.options[appointmentType.selectedIndex];
    const appointmentTypeName = selectedOption.text.trim();
    const appointmentTypeKey = appointmentTypeName.toLowerCase();
    const requirements = requirementsByAppointmentType[appointmentTypeKey];
    const isOther = appointmentType.value === "other";

    if (!appointmentType.value) {
        appointmentProvider.textContent = "Assigned to: Select an appointment type";
        appointmentRequirements.classList.add("hidden");
        appointmentRequirementsList.replaceChildren();
        otherAppointmentReasonField.classList.add("hidden");
        return;
    }

    appointmentRequirementsList.replaceChildren();
    requirements.forEach((requirement) => {
        const item = document.createElement("li");
        item.textContent = requirement;
        appointmentRequirementsList.appendChild(item);
    });
    appointmentRequirements.classList.toggle("hidden", isOther);
    otherAppointmentReasonField.classList.toggle("hidden", !isOther);
    if (!isOther && otherAppointmentReason) {
        otherAppointmentReason.value = "";
        otherAppointmentReasonError.textContent = "";
    }

    if (!appointmentDate || !appointmentDate.value) {
        appointmentProvider.textContent = "Assigned worker details are available after selecting an appointment date.";
        return;
    }

    appointmentProvider.textContent = `Assigned to: Loading ${selectedOption.dataset.jobSpecification || "worker"}...`;

    const token = localStorage.getItem("token");
    if (!token) {
        appointmentProvider.textContent = "Assigned worker details are available after signing in.";
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/appointments/provider?appointment_type=${encodeURIComponent(appointmentTypeName)}&appointment_date=${encodeURIComponent(appointmentDate.value)}`,
            {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` }
            }
        );
        const data = await response.json().catch(() => ({}));

        if (requestId !== providerRequestId) return;

        if (!response.ok) {
            appointmentProvider.textContent =
                data.message || "Unable to load the assigned worker.";
            return;
        }

        appointmentProvider.textContent = data.provider
            ? `Responsible doctor/health worker: ${data.provider.fullname} (${data.provider.job_specification})`
            : `No ${data.job_specification} is currently assigned. Please contact the health center.`;
    } catch (error) {
        if (requestId !== providerRequestId) return;
        console.error("APPOINTMENT PROVIDER ERROR:", error);
        appointmentProvider.textContent = "Unable to connect to load the assigned worker.";
    }
}

if (appointmentType) {
    appointmentType.addEventListener("change", updateAppointmentTypeDetails);
}

const appointmentDate =
    document.getElementById(
        "apptDate"
    );

const appointmentTime =
    document.getElementById(
        "apptTime"
    );

if (appointmentDate) {
    appointmentDate.addEventListener("change", () => {
        updateAppointmentTypeDetails();
        if (appointmentDate.value) {
            selectedCalendarDate = new Date(`${appointmentDate.value}T00:00:00`);
            patientCalendarDate = new Date(
                selectedCalendarDate.getFullYear(),
                selectedCalendarDate.getMonth(),
                1
            );
            renderPatientCalendar();
            loadDateAvailability(appointmentDate.value);
        } else {
            loadDateAvailability("");
        }
    });
}

const appointmentFile =
    document.getElementById(
        "apptFile"
    );

const uploadDropText =
    document.getElementById(
        "uploadDropText"
    );

const defaultUploadDropText =
    "Click to upload files (PDF, images, DOC/DOCX; up to 5 files)";

const appointmentsList =
    document.getElementById(
        "appointmentsList"
    );



if (appointmentDate) {

    const today =
        new Date();


    const year =
        today.getFullYear();


    const month =
        String(
            today.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            today.getDate()
        ).padStart(2, "0");


    appointmentDate.min =
        `${year}-${month}-${day}`;

}



if (appointmentFile) {

    appointmentFile.addEventListener(
        "change",
        function () {

            if (!uploadDropText) {
                return;
            }

            if (appointmentFile.files && appointmentFile.files.length > 5) {
                appointmentFile.value = "";
                uploadDropText.textContent = defaultUploadDropText;
                showToast("Please select no more than 5 files.", "error");
                return;
            }

            if (
                appointmentFile.files &&
                appointmentFile.files.length > 0
            ) {

                uploadDropText.textContent =
                    Array.from(appointmentFile.files)
                        .map((file) => file.name)
                        .join(", ");

            } else {

                uploadDropText.textContent =
                    defaultUploadDropText;

            }

        }
    );

}



async function loadAppointments() {

    if (!appointmentsList) {
        return;
    }


    const token =
        localStorage.getItem("token");


    if (!token) {
        return;
    }


    appointmentsList.innerHTML =
        `<p class="empty-state">
            Loading appointments...
        </p>`;


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/api/appointments/my-appointments`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response
                .json()
                .catch(() => ({}));


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            localStorage.removeItem(
                "token"
            );

            localStorage.removeItem(
                "user"
            );

            window.location.href =
                LOGIN_URL;

            return;

        }


        if (!response.ok) {

            appointmentsList.innerHTML =
                `<p class="empty-state">
                    ${
                        data.message ||
                        "Unable to load appointments."
                    }
                </p>`;

            return;

        }


        renderAppointments(
            data.appointments || []
        );


    } catch (error) {

        console.error(
            "APPOINTMENT ERROR:",
            error
        );


        appointmentsList.innerHTML =
            `<p class="empty-state">
                Unable to connect to the server.
            </p>`;

    }

}



function renderAppointments(
    appointments
) {

    if (!appointmentsList) {
        return;
    }


    if (
        !appointments ||
        appointments.length === 0
    ) {

        appointmentsList.innerHTML =
            `<p class="empty-state">
                No appointments requested yet.
            </p>`;

        return;

    }


    appointmentsList.innerHTML =
        appointments.map(
            function (appointment) {

                const date =
                    appointment.appointment_date
                        ? new Date(
                            appointment.appointment_date
                        ).toLocaleDateString()
                        : "No date";


                const type =
                    appointment.appointment_type ||
                    "Appointment";


                const time =
                    appointment.time_preference ||
                    "No time selected";


                const status =
                    appointment.status ||
                    "Pending";

                const attachmentNames =
                    Array.isArray(appointment.attachments)
                        ? appointment.attachments
                            .map((attachment) => escapeHTML(attachment.file_name))
                            .join(", ")
                        : "";

                const otherReason = appointment.other_reason
                    ? `<br>Reason: ${escapeHTML(appointment.other_reason)}`
                    : "";

                const acceptedBy = appointment.status === "Accepted" && appointment.accepted_by_name
                    ? `<br>Accepted by: ${escapeHTML(appointment.accepted_by_name)}`
                    : "";

                return `

                    <div class="appointment-item">

                        <div class="appointment-item-top">

                            <span class="appointment-item-type">

                                ${escapeHTML(type)}

                            </span>

                            <span class="status-pill">

                                ${escapeHTML(status)}

                            </span>

                        </div>


                        <div class="appointment-item-detail">

                            Assigned to: ${escapeHTML(appointment.assigned_admin_name
                                ? `${appointment.job_specification} - ${appointment.assigned_admin_name}`
                                : appointment.job_specification || "Staff assignment pending")}
                            <br>
                            ${escapeHTML(date)}
                            ·
                            ${escapeHTML(time)}
                            ${acceptedBy}
                            ${otherReason}
                            ${attachmentNames ? `<br>Attachments: ${attachmentNames}` : ""}

                        </div>

                    </div>

                `;

            }
        ).join("");

}



function escapeHTML(value) {

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");

}



if (appointmentForm) {

    appointmentForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const typeError =
                document.getElementById(
                    "apptTypeError"
                );


            const dateError =
                document.getElementById(
                    "apptDateError"
                );

            const timeError =
                document.getElementById(
                    "apptTimeError"
                );

            const otherReason = otherAppointmentReason
                ? otherAppointmentReason.value.trim()
                : "";


            let valid = true;


            if (
                !appointmentType ||
                !appointmentType.value
            ) {

                if (typeError) {

                    typeError.textContent =
                        "Please select an appointment type.";

                }

                valid = false;

            } else if (typeError) {

                typeError.textContent = "";

            }

            if (
                appointmentType &&
                appointmentType.value === "other" &&
                !otherReason
            ) {
                otherAppointmentReasonError.textContent =
                    "Please tell us why you are choosing Other.";
                valid = false;
            } else if (otherAppointmentReasonError) {
                otherAppointmentReasonError.textContent = "";
            }


            if (
                !appointmentDate ||
                !appointmentDate.value
            ) {

                if (dateError) {

                    dateError.textContent =
                        "Please select an appointment date.";

                }

                valid = false;

            } else if (dateError) {

                dateError.textContent = "";

            }

            if (
                !appointmentTime ||
                !appointmentTime.value
            ) {

                if (timeError) {

                    timeError.textContent =
                        "Please select a time preference.";

                }

                valid = false;

            } else if (timeError) {

                timeError.textContent = "";

            }


            if (!valid) {
                return;
            }


            const token =
                localStorage.getItem("token");


            if (!token) {

                window.location.href =
                    LOGIN_URL;

                return;

            }


            const button =
                appointmentForm.querySelector(
                    ".btn-primary"
                );


            button.disabled = true;

            button.textContent =
                "Submitting...";


            try {

                const selectedOption =
                    appointmentType
                        .options[
                            appointmentType.selectedIndex
                        ];


                const appointmentData = new FormData();
                appointmentData.append("appointment_type", selectedOption.text);
                appointmentData.append("appointment_date", appointmentDate.value);
                appointmentData.append("time_preference", appointmentTime ? appointmentTime.value : "");
                if (appointmentType.value === "other") {
                    appointmentData.append("other_reason", otherReason);
                }
                if (appointmentFile && appointmentFile.files.length) {
                    Array.from(appointmentFile.files).forEach((file) => {
                        appointmentData.append("attachments", file);
                    });
                }

                const response =
                    await fetch(
                        `${API_BASE_URL}/api/appointments`,
                        {
                            method: "POST",

                            headers: {
                                Authorization: `Bearer ${token}`
                            },
                            body: appointmentData

                        }
                    );


                const data =
                    await response
                        .json()
                        .catch(() => ({}));


                if (
                    response.status === 401 ||
                    response.status === 403
                ) {

                    localStorage.removeItem(
                        "token"
                    );

                    localStorage.removeItem(
                        "user"
                    );

                    window.location.href =
                        LOGIN_URL;

                    return;

                }


                if (!response.ok) {

                    showToast(
                        data.message ||
                        "Failed to submit appointment.",
                        "error"
                    );

                    return;

                }


                showToast(
                    "Appointment submitted successfully!",
                    "success"
                );


                appointmentForm.reset();
                updateAppointmentTimeOptions([], "");
                selectedDatePreview.innerHTML = "<p>Select a date to view available time slots.</p>";
                document.getElementById("appointmentAvailabilityHint").textContent =
                    "Select a date to view available time slots.";
                loadAppointments();

                if (otherAppointmentReasonField) {
                    otherAppointmentReasonField.classList.add("hidden");
                }

                if (appointmentRequirements) {
                    appointmentRequirements.classList.add("hidden");
                }

                if (appointmentProvider) {
                    appointmentProvider.textContent =
                        "Assigned to: Select an appointment type";
                }


                if (uploadDropText) {

                    uploadDropText.textContent =
                        defaultUploadDropText;

                }


                loadAppointments();


            } catch (error) {

                console.error(
                    "SUBMIT APPOINTMENT ERROR:",
                    error
                );


                showToast(
                    "Cannot connect to the server.",
                    "error"
                );


            } finally {

                button.disabled = false;

                button.textContent =
                    "Save & Submit";

            }

        }
    );

}



const accountForm =
    document.getElementById(
        "accountForm"
    );

if (accountForm) {
    accountForm.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();
            const fullName = document.getElementById("accFullName");
            const age = document.getElementById("accAge");
            const gender = document.getElementById("accGender");
            const token = localStorage.getItem("token");

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        fullname: fullName ? fullName.value.trim() : "",
                        age: age ? Number(age.value) : 0,
                        gender: gender ? gender.value : ""
                    })
                });
                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.message || "Failed to save profile.");
                }

                currentUser = { ...currentUser, ...data.user };
                localStorage.setItem("user", JSON.stringify(currentUser));

                if (userMenuName) {
                    userMenuName.textContent = getFirstName(currentUser.fullname);
                }
                if (dropdownName) {
                    dropdownName.textContent = currentUser.fullname;
                }

                showToast("Profile saved successfully!", "success");
            } catch (error) {
                console.error("PROFILE SAVE ERROR:", error);
                showToast(error.message, "error");
            }
        }
    );
}


window.addEventListener("DOMContentLoaded", async function () {
    const loggedIn = await checkSession();
    if (!loggedIn) return;

    await loadSavedProfile();
    showView("dashboard");
    setInterval(loadAnnouncements, 15000);
    loadAppointments();
});