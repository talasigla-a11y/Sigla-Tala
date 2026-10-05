// ===============================
// SIGLA TALA - AUTHENTICATION JS
// ===============================

// Uses a configurable API URL so the same frontend can run locally or on the production domain.
const API_BASE_URL = window.SIGLA_TALA_API_URL || "https://api.siglatala.com";

const API_URL = `${API_BASE_URL}/api/auth`;
const ADMIN_DASHBOARD_URL = "admin-dashboard.html";
const PATIENT_DASHBOARD_URL = "patient-dashboard.html";

// Sends administrators and patients to their appropriate dashboard after login.
function getDashboardUrlForUser(user) {

    const role =
        user && user.role ?
            String(user.role).toLowerCase() :
            "patient";

    return role === "admin" ?
        ADMIN_DASHBOARD_URL :
        PATIENT_DASHBOARD_URL;

}

// ===============================
// ELEMENTS
// ===============================

const signinCard = document.getElementById("signinCard");
const signupCard = document.getElementById("signupCard");
const otpCard = document.getElementById("otpCard");

const signinForm = document.getElementById("signinForm");
const signupForm = document.getElementById("signupForm");
const otpForm = document.getElementById("otpForm");

const otpEmailInput = document.getElementById("otpEmail");
const otpInput = document.getElementById("otpInput");

const showSignup = document.getElementById("showSignup");
const showSignin = document.getElementById("showSignin");
const backToSignin = document.getElementById("backToSignin");

const forgotPasswordLink =
    document.getElementById("forgotPasswordLink");

const toast = document.getElementById("toast");

const AUTH_VIEW_KEY = "siglaTalaAuthView";

let toastTimer;


// Switches between sign-in, sign-up, and OTP panels.
function showAuthView(viewName, shouldRecordHistory = true) {

    const nextView =
        viewName === "signup" ?
            "signup" :
            viewName === "otp" ?
                "otp" :
                "signin";

    if (signinCard) {
        signinCard.classList.toggle("hidden", nextView !== "signin");
    }

    if (signupCard) {
        signupCard.classList.toggle("hidden", nextView !== "signup");
    }

    if (otpCard) {
        otpCard.classList.toggle("hidden", nextView !== "otp");
    }

    sessionStorage.setItem(AUTH_VIEW_KEY, nextView);

    if (shouldRecordHistory && window.history && window.history.pushState) {
        const nextUrl = new URL(window.location.href);
        nextUrl.hash = nextView === "signup" ? "#signup" : nextView === "otp" ? "#otp" : "#signin";
        window.history.pushState({ authView: nextView }, "", nextUrl);
    }

    clearFormErrors(signinForm);
    clearFormErrors(signupForm);
    if (otpForm) {
        clearFormErrors(otpForm);
    }
}


// Restores the correct sign-in, sign-up, or OTP panel after browser navigation.
window.addEventListener("popstate", function () {

    const stateView =
        window.history.state &&
        window.history.state.authView;

    const savedView =
        sessionStorage.getItem(AUTH_VIEW_KEY);

    const nextView =
        stateView === "signup" ||
        savedView === "signup" ||
        window.location.hash === "#signup" ?
            "signup" :
            stateView === "otp" ||
            savedView === "otp" ||
            window.location.hash === "#otp" ?
                "otp" :
                "signin";

    showAuthView(nextView, false);

});


// ===============================
// OTP FLOW
// ===============================

let activeOtpFlow = null;

function showOtpPage(mode, email) {
    activeOtpFlow = { mode, email: String(email || "").trim() };

    if (otpEmailInput) {
        otpEmailInput.value = activeOtpFlow.email;
    }

    if (otpInput) {
        otpInput.value = "";
        otpInput.focus();
    }

    showAuthView("otp", true);
}

if (backToSignin) {
    backToSignin.addEventListener("click", function (event) {
        event.preventDefault();
        activeOtpFlow = null;
        showAuthView("signin");
    });
}

if (otpForm) {
    otpForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!activeOtpFlow || !activeOtpFlow.email) {
            showToast("OTP session expired. Please try again.", "error");
            showAuthView("signin");
            return;
        }

        const otpValue = (otpInput ? otpInput.value : "").trim();
        const otpError = document.getElementById("otpInputError");

        if (!otpValue || !/^\d{6}$/.test(otpValue)) {
            setError(otpInput, otpError, "Enter the 6-digit OTP.");
            return;
        }

        const button = otpForm.querySelector(".btn-primary");
        button.disabled = true;
        button.textContent = "Verifying...";

        try {
            const url = activeOtpFlow.mode === "login"
                ? `${API_URL}/verify-login-otp`
                : `${API_URL}/verify-otp`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: activeOtpFlow.email,
                    otp: otpValue
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                showToast(data.message || "Invalid OTP.", "error");
                return;
            }

            if (activeOtpFlow.mode === "login") {
                if (!data.token) {
                    showToast("Login token was not received.", "error");
                    return;
                }

                localStorage.setItem("token", data.token);
                const loggedInUser = data.user || {};
                localStorage.setItem("user", JSON.stringify(loggedInUser));
                showToast("Login successful!", "success");
                const redirectUrl = getDashboardUrlForUser(loggedInUser);
                setTimeout(function () {
                    window.location.href = redirectUrl;
                }, 500);
                return;
            }

            const verifiedEmail = activeOtpFlow.email;
            sessionStorage.removeItem("pendingVerificationEmail");
            showToast("Account verified successfully!", "success");
            otpForm.reset();
            activeOtpFlow = null;
            const signupFormLocal = document.getElementById("signupForm");
            if (signupFormLocal) {
                signupFormLocal.reset();
            }
            const signinEmail = document.getElementById("signinEmail");
            if (signinEmail) {
                signinEmail.value = verifiedEmail;
            }
            showAuthView("signin");
        } catch (error) {
            console.error("OTP VERIFY ERROR:", error);
            showToast("Cannot connect to the server.", "error");
        } finally {
            button.disabled = false;
            button.textContent = "Verify";
        }
    });
}

// ===============================
// TOAST MESSAGE
// ===============================

// Displays a short success or error message without interrupting the form flow.
function showToast(message, type = "success") {

    if (!toast) return;

    clearTimeout(toastTimer);

    toast.textContent = message;
    toast.className = "toast show " + type;

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


// ===============================
// VALIDATION HELPERS
// ===============================

// Performs the browser-side email check before sending a request to the API.
function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

}

// Matches the backend password policy before a signup or reset request is sent.
function isStrongPassword(password) {

    return /^(?=.*[A-Z])(?=.*\d)(?=.*[_*&%]).{8,}$/.test(password);

}


// Shows a field-level validation message and marks the input as invalid.
function setError(input, error, message) {

    if (input) {
        input.classList.add("invalid");
    }

    if (error) {
        error.textContent = message;
    }

}


// Removes the validation state from one input field.
function clearError(input, error) {

    if (input) {
        input.classList.remove("invalid");
    }

    if (error) {
        error.textContent = "";
    }

}


// Resets all validation messages before a new submission is processed.
function clearFormErrors(form) {

    if (!form) return;

    form.querySelectorAll("input, select").forEach((input) => {
        input.classList.remove("invalid");
    });

    form.querySelectorAll(".error-message").forEach((error) => {
        error.textContent = "";
    });

}


// ===============================
// SWITCH LOGIN / SIGNUP
// ===============================

if (showSignup) {

    // Opens the sign-up panel when the user selects the registration link.
    showSignup.addEventListener("click", function (event) {

        event.preventDefault();
        showAuthView("signup");

    });

}


if (showSignin) {

    // Returns to the sign-in panel when the user selects the login link.
    showSignin.addEventListener("click", function (event) {

        event.preventDefault();
        showAuthView("signin");

    });

}


// ===============================
// CLEAR ERRORS WHEN TYPING
// ===============================

document.querySelectorAll("input, select").forEach((input) => {

    // Clears a field's error message as soon as its value changes.
    input.addEventListener("input", function () {

        const error = document.getElementById(
            input.id + "Error"
        );

        if (error) {
            clearError(input, error);
        }

    });

    // Also clears validation feedback when a selection changes.
    input.addEventListener("change", function () {

        const error = document.getElementById(
            input.id + "Error"
        );

        if (error) {
            clearError(input, error);
        }

    });

});


// ===============================
// SIGN UP
// ===============================

if (signupForm) {

    // Validates registration details, creates the account, then verifies its OTP.
    signupForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const fullName =
            document.getElementById("fullName");

        const age =
            document.getElementById("age");

        const gender =
            document.getElementById("gender");

        const email =
            document.getElementById("signupEmail");

        const password =
            document.getElementById("signupPassword");


        const fullNameError =
            document.getElementById("fullNameError");

        const ageError =
            document.getElementById("ageError");

        const genderError =
            document.getElementById("genderError");

        const emailError =
            document.getElementById("signupEmailError");

        const passwordError =
            document.getElementById("signupPasswordError");


        let valid = true;


        // Full name
        if (!fullName.value.trim()) {

            setError(
                fullName,
                fullNameError,
                "Full name is required."
            );

            valid = false;
        }


        // Age
        if (!age.value) {

            setError(
                age,
                ageError,
                "Age is required."
            );

            valid = false;

        } else if (
            Number(age.value) < 0 ||
            Number(age.value) > 120
        ) {

            setError(
                age,
                ageError,
                "Please enter a valid age."
            );

            valid = false;

        }


        // Gender
        if (!gender.value) {

            setError(
                gender,
                genderError,
                "Please select your gender."
            );

            valid = false;

        }


        // Email
        if (!email.value.trim()) {

            setError(
                email,
                emailError,
                "Email is required."
            );

            valid = false;

        } else if (!isValidEmail(email.value.trim())) {

            setError(
                email,
                emailError,
                "Please enter a valid email."
            );

            valid = false;

        }


        // Password
        if (!password.value) {

            setError(
                password,
                passwordError,
                "Password is required."
            );

            valid = false;

        } else if (!isStrongPassword(password.value)) {

            setError(
                password,
                passwordError,
                "Use at least 8 characters, one uppercase letter, one number, and one of these symbols: _ * & %."
            );

            valid = false;

        }


        if (!valid) {
            return;
        }


        const button =
            signupForm.querySelector(".btn-primary");

        button.disabled = true;
        button.textContent = "Creating account...";


        try {

            const response = await fetch(
                `${API_URL}/register`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        fullname:
                            fullName.value.trim(),

                        age:
                            Number(age.value),

                        gender:
                            gender.value,

                        email:
                            email.value.trim(),

                        password:
                            password.value

                    })

                }
            );


            const data =
                await response.json().catch(() => ({}));


            if (!response.ok) {

                showToast(
                    data.message ||
                    "Registration failed.",
                    "error"
                );

                return;
            }


            showToast(
                data.message ||
                "OTP sent to your email.",
                "success"
            );

            sessionStorage.setItem(
                "pendingVerificationEmail",
                email.value.trim()
            );

            showOtpPage("signup", email.value.trim());
            return;


        } catch (error) {

            console.error(
                "SIGNUP ERROR:",
                error
            );

            showToast(
                "Cannot connect to the server.",
                "error"
            );

        } finally {

            button.disabled = false;
            button.textContent = "Sign up";

        }

    });

}


// ===============================
// SIGN IN
// ===============================

if (signinForm) {

    // Checks credentials, verifies the login OTP, and opens the user's dashboard.
    signinForm.addEventListener("submit", async function (event) {

        event.preventDefault();


        const email =
            document.getElementById("signinEmail");

        const password =
            document.getElementById("signinPassword");


        const emailError =
            document.getElementById("signinEmailError");

        const passwordError =
            document.getElementById("signinPasswordError");


        let valid = true;


        // Email validation
        if (!email.value.trim()) {

            setError(
                email,
                emailError,
                "Email is required."
            );

            valid = false;

        } else if (!isValidEmail(email.value.trim())) {

            setError(
                email,
                emailError,
                "Please enter a valid email."
            );

            valid = false;

        }


        // Password validation
        if (!password.value) {

            setError(
                password,
                passwordError,
                "Password is required."
            );

            valid = false;

        }


        if (!valid) {
            return;
        }


        const button =
            signinForm.querySelector(".btn-primary");

        button.disabled = true;
        button.textContent = "Signing in...";


        try {

            // ===============================
            // LOGIN REQUEST
            // ===============================

            const controller = new AbortController();
            const requestTimeout = setTimeout(() => controller.abort(), 20000);

            const response =
                await fetch(
                    `${API_URL}/login`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            email:
                                email.value.trim(),

                            password:
                                password.value

                        }),
                        signal: controller.signal

                    }
                );

            clearTimeout(requestTimeout);


            const data =
                await response
                    .json()
                    .catch(() => ({}));


            if (!response.ok) {

                showToast(
                    data.error ||
                    data.message ||
                    "Login failed.",
                    "error"
                );

                return;
            }


            showToast(
                data.message || "Login OTP requested.",
                "success"
            );

            showOtpPage("login", email.value.trim());
            return;


        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            showToast(
                error.name === "AbortError" ?
                    "The server took too long to respond. Please try again." :
                    "Cannot connect to the server.",
                "error"
            );

        } finally {

            button.disabled = false;
            button.textContent = "Sign in";

        }

    });

}


// ===============================
// FORGOT PASSWORD
// ===============================

if (forgotPasswordLink) {

    // Requests a reset OTP and completes the password recovery flow.
    forgotPasswordLink.addEventListener(
        "click",
        async function (event) {

            event.preventDefault();

            const emailInput =
                document.getElementById("signinEmail");

            const emailValue =
                emailInput ?
                    emailInput.value.trim() :
                    "";

            if (!emailValue || !isValidEmail(emailValue)) {

                showToast(
                    "Please enter your email first.",
                    "error"
                );

                if (emailInput) {
                    emailInput.focus();
                }

                return;

            }

            try {

                const response = await fetch(
                    `${API_URL}/forgot-password`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            email: emailValue
                        })
                    }
                );

                const data = await response
                    .json()
                    .catch(() => ({}));

                if (!response.ok) {

                    showToast(
                        data.message ||
                        "Unable to send reset code.",
                        "error"
                    );

                    return;

                }

                showToast(
                    data.message ||
                    "Password reset OTP sent to your email.",
                    "success"
                );

                const otp = prompt(
                    "Enter the 6-digit reset code:"
                );

                if (!otp) {

                    showToast(
                        "Password reset cancelled.",
                        "error"
                    );

                    return;

                }

                const newPassword = prompt(
                    "Enter a password with 8+ characters, an uppercase letter, a number, and one of these symbols: _ * & %."
                );

                if (!newPassword || !isStrongPassword(newPassword)) {

                    showToast(
                        "Password must be at least 8 characters and include an uppercase letter, a number, and one of these symbols: _ * & %.",
                        "error"
                    );

                    return;

                }

                const resetResponse = await fetch(
                    `${API_URL}/reset-password`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            email: emailValue,
                            otp: otp.trim(),
                            newPassword: newPassword
                        })
                    }
                );

                const resetData = await resetResponse
                    .json()
                    .catch(() => ({}));

                if (!resetResponse.ok) {

                    showToast(
                        resetData.message ||
                        "Password reset failed.",
                        "error"
                    );

                    return;

                }

                showToast(
                    resetData.message ||
                    "Password reset successfully.",
                    "success"
                );

                const passwordInput =
                    document.getElementById("signinPassword");

                if (passwordInput) {
                    passwordInput.value = "";
                }

            } catch (error) {

                console.error(
                    "FORGOT PASSWORD ERROR:",
                    error
                );

                showToast(
                    "Cannot connect to the server.",
                    "error"
                );

            }

        }
    );

}


// ===============================
// CHECK IF ALREADY LOGGED IN
// ===============================

window.addEventListener(
    "DOMContentLoaded",
    // Selects the initial auth panel and redirects an existing signed-in user.
    function () {

        const token =
            localStorage.getItem("token");

        const rawUser =
            localStorage.getItem("user");

        const preferredView =
            window.location.hash === "#signup" ||
            sessionStorage.getItem(AUTH_VIEW_KEY) === "signup" ?
                "signup" :
                "signin";

        showAuthView(preferredView, false);

        if (token && rawUser) {

            try {

                const user =
                    JSON.parse(rawUser);

                window.location.href =
                    getDashboardUrlForUser(user);

            } catch (error) {

                console.error(
                    "USER PARSE ERROR:",
                    error
                );

                localStorage.removeItem("user");

            }

        }

    }
);