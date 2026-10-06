"use strict";

const API_BASE_URL = window.SIGLA_TALA_API_URL || "https://api.siglatala.com";
const loadingMessage = document.getElementById("receiptLoading");
const verifiedSection = document.getElementById("receiptVerified");
const errorSection = document.getElementById("receiptError");

function showReceiptError(message) {
    loadingMessage.classList.add("hidden");
    errorSection.classList.remove("hidden");
    document.getElementById("receiptErrorMessage").textContent = message;
}

function showVerifiedReceipt(receipt) {
    const fields = {
        receiptNumber: `ST-${String(receipt.appointment_id).padStart(8, "0")}`,
        receiptPatient: receipt.patient_name,
        receiptType: receipt.appointment_type,
        receiptDate: receipt.appointment_date,
        receiptTime: receipt.time_preference || "Not provided",
        receiptReason: receipt.other_reason || "Not applicable",
        receiptWorker: receipt.accepted_by_name
            ? `${receipt.accepted_by_name} (${receipt.job_specification})`
            : receipt.job_specification,
        receiptStatus: receipt.status
    };

    Object.entries(fields).forEach(([id, value]) => {
        document.getElementById(id).textContent = value || "Not provided";
    });
    if (receipt.diagnosis) {
        document.getElementById("receiptDiagnosis").textContent = receipt.diagnosis;
        document.getElementById("receiptDiagnosisRow").classList.remove("hidden");
    }
    if (receipt.medical_notes) {
        document.getElementById("receiptMedicalNotes").textContent = receipt.medical_notes;
        document.getElementById("receiptMedicalNotesRow").classList.remove("hidden");
    }

    loadingMessage.classList.add("hidden");
    verifiedSection.classList.remove("hidden");
}

async function verifyReceiptFromLink() {
    const linkParameters = new URLSearchParams(window.location.hash.slice(1));
    const appointmentId = linkParameters.get("appointment_id");
    const token = linkParameters.get("token");

    window.history.replaceState(null, "", window.location.pathname);

    if (!/^\d+$/.test(appointmentId || "") || !/^[a-f0-9]{64}$/i.test(token || "")) {
        showReceiptError("The receipt link is incomplete or malformed.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/appointments/receipt/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId, token })
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.receipt) {
            showReceiptError(data.message || "This private receipt link is invalid or no longer active.");
            return;
        }

        showVerifiedReceipt(data.receipt);
    } catch (error) {
        console.error("VERIFY RECEIPT PAGE ERROR:", error);
        showReceiptError("Unable to connect to Sigla Tala to verify this receipt. Please try again.");
    }
}

verifyReceiptFromLink();
