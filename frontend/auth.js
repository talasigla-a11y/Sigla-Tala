// ===============================
// SIGLA TALA - AUTHENTICATION JS
// ===============================

const API_BASE_URL = window.SIGLA_TALA_API_URL || "https://sigla-tala-08i8.onrender.com";

const API_URL = `${API_BASE_URL}/api/auth`;
const ADMIN_DASHBOARD_URL = "admin-dashboard.html";
const PATIENT_DASHBOARD_URL = "patient-dashboard.html";

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

const signinForm = document.getElementById("signinForm");
const signupForm = document.getElementById("signupForm");

const showSignup = document.getElementById("showSignup");
const showSignin = document.getElementById("showSignin");

const forgotPasswordLink =
    document.getElementById("forgotPasswordLink");

const toast = document.getElementById("toast");

const AUTH_VIEW_KEY = "siglaTalaAuthView";

let toastTimer;


function showAuthView(viewName, shouldRecordHistory = true) {

    const nextView =
        viewName === "signup" ?
            "signup" :
            "signin";

    if (signinCard) {
        signinCard.classList.toggle("hidden", nextView !== "signin");
    }

    if (signupCard) {
        signupCard.classList.toggle("hidden", nextView !== "signup");
    }

    sessionStorage.setItem(AUTH_VIEW_KEY, nextView);

    if (shouldRecordHistory && window.history && window.history.pushState) {
        const nextUrl = new URL(window.location.href);
        nextUrl.hash = nextView === "signup" ? "#signup" : "#signin";
        window.history.pushState({ authView: nextView }, "", nextUrl);
    }

    clearFormErrors(signinForm);
    clearFormErrors(signupForm);
}


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
            "signin";

    showAuthView(nextView, false);

});


// ===============================
// TOAST MESSAGE
// ===============================

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

function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

}


function setError(input, error, message) {

    if (input) {
        input.classList.add("invalid");
    }

    if (error) {
        error.textContent = message;
    }

}


function clearError(input, error) {

    if (input) {
        input.classList.remove("invalid");
    }

    if (error) {
        error.textContent = "";
    }

}


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

    showSignup.addEventListener("click", function (event) {

        event.preventDefault();
        showAuthView("signup");

    });

}


if (showSignin) {

    showSignin.addEventListener("click", function (event) {

        event.preventDefault();
        showAuthView("signin");

    });

}


// ===============================
// CLEAR ERRORS WHEN TYPING
// ===============================

document.querySelectorAll("input, select").forEach((input) => {

    input.addEventListener("input", function () {

        const error = document.getElementById(
            input.id + "Error"
        );

        if (error) {
            clearError(input, error);
        }

    });

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

        } else if (password.value.length < 6) {

            setError(
                password,
                passwordError,
                "Password must be at least 6 characters."
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


            // ===============================
            // OTP VERIFICATION
            // ===============================

            const otp = prompt(
                "Enter the 6-digit OTP sent to your email:"
            );


            if (!otp) {

                showToast(
                    "OTP verification cancelled.",
                    "error"
                );

                return;
            }


            const verifyResponse =
                await fetch(
                    `${API_URL}/verify-otp`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            email:
                                email.value.trim(),

                            otp:
                                otp.trim()

                        })

                    }
                );


            const verifyData =
                await verifyResponse
                    .json()
                    .catch(() => ({}));


            if (!verifyResponse.ok) {

                showToast(
                    verifyData.message ||
                    "Invalid OTP.",
                    "error"
                );

                return;
            }


            sessionStorage.removeItem(
                "pendingVerificationEmail"
            );


            showToast(
                "Account verified successfully!",
                "success"
            );


            signupForm.reset();


            signupCard.classList.add("hidden");
            signinCard.classList.remove("hidden");


            // Put registered email into login
            const signinEmail =
                document.getElementById("signinEmail");

            if (signinEmail) {
                signinEmail.value =
                    email.value.trim();
            }


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
                "OTP sent to your email.",
                "success"
            );


            // ===============================
            // LOGIN OTP
            // ===============================

            const otp = prompt(
                "Enter the 6-digit login OTP:"
            );


            if (!otp) {

                showToast(
                    "Login cancelled.",
                    "error"
                );

                return;
            }


            button.textContent =
                "Verifying OTP...";


            const verifyResponse =
                await fetch(
                    `${API_URL}/verify-login-otp`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            email:
                                email.value.trim(),

                            otp:
                                otp.trim()

                        })

                    }
                );


            const verifyData =
                await verifyResponse
                    .json()
                    .catch(() => ({}));


            if (!verifyResponse.ok) {

                showToast(
                    verifyData.message ||
                    "Invalid or expired OTP.",
                    "error"
                );

                return;
            }


            // ===============================
            // SAVE LOGIN SESSION
            // ===============================

            if (!verifyData.token) {

                showToast(
                    "Login token was not received.",
                    "error"
                );

                return;
            }


            localStorage.setItem(
                "token",
                verifyData.token
            );


            const loggedInUser =
                verifyData.user || {};

            localStorage.setItem(
                "user",
                JSON.stringify(loggedInUser)
            );


            showToast(
                "Login successful!",
                "success"
            );


            // ===============================
            // GO TO THE USER'S DASHBOARD
            // ===============================

            const redirectUrl =
                getDashboardUrlForUser(loggedInUser);

            setTimeout(function () {

                window.location.href =
                    redirectUrl;

            }, 500);


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
                    "Enter the 6-digit reset code sent to your email:"
                );

                if (!otp) {

                    showToast(
                        "Password reset cancelled.",
                        "error"
                    );

                    return;

                }

                const newPassword = prompt(
                    "Enter your new password (minimum 6 characters):"
                );

                if (!newPassword || newPassword.length < 6) {

                    showToast(
                        "New password must be at least 6 characters.",
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