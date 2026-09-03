// ======================================
// SIGLA TALA - PATIENT DASHBOARD JS
// ======================================

const API_BASE_URL = window.SIGLA_TALA_API_URL || "https://sigla-tala-08i8.onrender.com";
const LOGIN_URL = "login.html";
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

// ======================================
// GET ELEMENTS
// ======================================

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


// ======================================
// DASHBOARD VIEWS
// ======================================

const dashboardView =
    document.getElementById("dashboardView");

const appointmentView =
    document.getElementById("appointmentView");

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


// ======================================
// USER DATA
// ======================================

let currentUser = {};

let toastTimer;


// ======================================
// TOAST
// ======================================

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


// ======================================
// FIRST NAME
// ======================================

function getFirstName(name) {

    if (!name) {
        return "Account";
    }

    return name
        .trim()
        .split(/\s+/)[0];

}


// ======================================
// SHOW VIEW
// ======================================

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


    // Highlight active menu
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


    closeUserMenu();

    if (viewName === "dashboard") {
        loadAnnouncements();
    }


    // Load appointments whenever
    // appointment page is opened
    if (viewName === "appointment") {

        loadAppointments();

    }

}

// ======================================
// LOAD ANNOUNCEMENTS
// ======================================

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

        const announcements = data.announcements || [];

        if (!announcements.length) {
            announcementGrid.innerHTML = `<p class="empty-state">No announcements posted yet.</p>`;
            return;
        }

        announcementGrid.innerHTML = announcements.map((announcement) => `
            <article class="announcement-card">
                <div class="announcement-date">
                    ${escapeHTML(new Date(announcement.created_at).toLocaleDateString())}
                </div>
                <h3>${escapeHTML(announcement.title)}</h3>
                <p>${escapeHTML(announcement.content)}</p>
            </article>
        `).join("");
    } catch (error) {
        console.error("ANNOUNCEMENT LOAD ERROR:", error);
        announcementGrid.innerHTML = `<p class="empty-state">Unable to load announcements.</p>`;
    }
}


// ======================================
// USER MENU
// ======================================

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


// Close menu when clicking outside
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


// ======================================
// DROPDOWN NAVIGATION
// ======================================

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


// ======================================
// LOGOUT
// ======================================

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


// ======================================
// LOAD USER INFORMATION
// ======================================

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


    // Header
    if (userMenuName) {

        userMenuName.textContent =
            getFirstName(name);

    }


    // Dropdown
    if (dropdownName) {

        dropdownName.textContent =
            name;

    }


    if (dropdownEmail) {

        dropdownEmail.textContent =
            email;

    }


    // Account form
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


// ======================================
// SESSION CHECK
// ======================================

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
                String(parsedUser.role || "").toLowerCase() === "admin"
            ) {

                window.location.href =
                    "admin-dashboard.html";

                return false;

            }

        } catch (error) {

            console.error(
                "USER PARSE ERROR:",
                error
            );

        }

    }


    // No login
    if (!token || !savedUser) {

        window.location.href =
            LOGIN_URL;

        return false;

    }


    // Check saved user data
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


    // Optional backend verification
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


        // If endpoint doesn't exist,
        // don't immediately destroy the
        // local login session.
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

        // We keep the local session here.
        // This allows the dashboard to work
        // even if /dashboard isn't implemented.
    }


    return true;

}


// ======================================
// APPOINTMENT ELEMENTS
// ======================================

const appointmentForm =
    document.getElementById(
        "appointmentForm"
    );

const appointmentType =
    document.getElementById(
        "apptType"
    );

const appointmentDate =
    document.getElementById(
        "apptDate"
    );

const appointmentFile =
    document.getElementById(
        "apptFile"
    );

const uploadDropText =
    document.getElementById(
        "uploadDropText"
    );

const appointmentsList =
    document.getElementById(
        "appointmentsList"
    );


// ======================================
// MINIMUM APPOINTMENT DATE
// ======================================

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


// ======================================
// FILE UPLOAD DISPLAY
// ======================================

if (appointmentFile) {

    appointmentFile.addEventListener(
        "change",
        function () {

            if (!uploadDropText) {
                return;
            }


            if (
                appointmentFile.files &&
                appointmentFile.files.length > 0
            ) {

                uploadDropText.textContent =
                    appointmentFile.files[0].name;

            } else {

                uploadDropText.textContent =
                    "Click to upload files (PDF, Image)";

            }

        }
    );

}


// ======================================
// LOAD APPOINTMENTS
// ======================================

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


// ======================================
// RENDER APPOINTMENTS
// ======================================

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

                            ${escapeHTML(date)}
                            ·
                            ${escapeHTML(time)}

                        </div>

                    </div>

                `;

            }
        ).join("");

}


// ======================================
// SECURITY - ESCAPE HTML
// ======================================

function escapeHTML(value) {

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");

}


// ======================================
// SUBMIT APPOINTMENT
// ======================================

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
                    "timePrefError"
                );


            const selectedTime =
                document.querySelector(
                    'input[name="timePref"]:checked'
                );


            let valid = true;


            // Appointment type
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


            // Date
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


            // Time
            if (!selectedTime) {

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
                appointmentData.append("time_preference", selectedTime.value);
                if (appointmentFile && appointmentFile.files.length) {
                    appointmentData.append("attachment", appointmentFile.files[0]);
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


                if (uploadDropText) {

                    uploadDropText.textContent =
                        "Click to upload files (PDF, Image)";

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


// ======================================
// ACCOUNT FORM
// ======================================

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