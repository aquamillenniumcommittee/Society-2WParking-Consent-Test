
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const verifyForm = $("verifyForm");
  const flatInput = $("flat");
  const codeInput = $("accessCode");
  const verifyButton = $("verifyButton");
  const verifyMessage = $("verifyMessage");

  const termsCard = $("termsCard");
  const verifiedFlat = $("verifiedFlat");
  const verifiedSlot = $("verifiedSlot");
  const agreeTerms = $("agreeTerms");

  const consentForm = $("consentForm");
  const submitButton = $("submitButton");
  const submitMessage = $("submitMessage");

  let supabaseClient = null;
  let verifiedMember = null;
  let memberCode = "";

  function showMessage(id, message, type = "error") {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.classList.remove("success", "error");

    if (message) {
      element.classList.add(type);
    }
  }

  function getClient() {
    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      throw new Error(
        "The connection library could not be loaded. Please refresh and try again."
      );
    }

    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      throw new Error(
        "Website configuration is missing. Please contact the committee."
      );
    }

    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );
    }

    return supabaseClient;
  }

  function normalizeCode(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function resetConsentSection() {
    verifiedMember = null;

    termsCard.classList.add("hidden");
    verifiedFlat.textContent = "";
    verifiedSlot.textContent = "";

    agreeTerms.checked = false;
    submitButton.disabled = true;

    showMessage("submitMessage", "");
  }

  if (
    !verifyForm ||
    !flatInput ||
    !codeInput ||
    !verifyButton ||
    !verifyMessage ||
    !termsCard ||
    !verifiedFlat ||
    !verifiedSlot ||
    !agreeTerms ||
    !consentForm ||
    !submitButton ||
    !submitMessage
  ) {
    console.error("Consent page is missing one or more required HTML elements.");
    return;
  }

  // STEP 1: Verify the member's details only.
  verifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const flat = flatInput.value.trim();
    memberCode = normalizeCode(codeInput.value);

    showMessage("verifyMessage", "");
    resetConsentSection();

    if (!flat || !memberCode) {
      showMessage(
        "verifyMessage",
        "Please enter your flat number and access code."
      );
      return;
    }

    verifyButton.disabled = true;
    verifyButton.textContent = "Verifying...";

    try {
      const client = getClient();

      const { data, error } = await client.rpc("member_login", {
        p_flat: flat,
        p_code: memberCode
      });

      if (error) {
        console.error("Member verification error:", error);
        throw new Error(
          "Your details could not be verified. Please check your flat number and access code."
        );
      }

      const member = Array.isArray(data) ? data[0] : data;

      if (!member || member.ok !== true) {
        throw new Error(
          member?.message ||
          "Your details could not be verified. Please check your details."
        );
      }

      const slot =
        member.pre_allocated_slot ??
        member.preallocated_slot ??
        member.preallocatedSlot;

      if (!slot) {
        throw new Error(
          "No pre-allocated parking slot was found for this flat. Please contact the committee."
        );
      }

      verifiedMember = {
        flat: member.flat || flat,
        slot: slot
      };

      verifiedFlat.textContent = verifiedMember.flat;
      verifiedSlot.textContent = verifiedMember.slot;

      agreeTerms.checked = false;
      submitButton.disabled = true;

      termsCard.classList.remove("hidden");

      showMessage(
        "verifyMessage",
        "Your details have been verified. Please review the Terms & Conditions below.",
        "success"
      );

      termsCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      console.error("Verification error:", error);

      resetConsentSection();

      showMessage(
        "verifyMessage",
        error.message || "Verification failed. Please try again."
      );
    } finally {
      verifyButton.disabled = false;
      verifyButton.textContent = "Verify my details";
    }
  });

  // STEP 2: Enable consent submission only after agreement is ticked.
  agreeTerms.addEventListener("change", () => {
    submitButton.disabled = !agreeTerms.checked || !verifiedMember;
    showMessage("submitMessage", "");
  });

  // STEP 3: Record consent only after the member submits the agreement.
  consentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!verifiedMember) {
      showMessage(
        "submitMessage",
        "Please verify your details first."
      );
      return;
    }

    if (!agreeTerms.checked) {
      showMessage(
        "submitMessage",
        "Please read and accept the Terms & Conditions."
      );
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    showMessage("submitMessage", "");

    try {
      const client = getClient();

      const { data, error } = await client.rpc(
        "submit_preallocated_consent",
        {
          p_flat: verifiedMember.flat,
          p_code: memberCode,
          p_agree: true
        }
      );

      if (error) {
        console.error("Consent recording error:", error);
        throw new Error(
          "Acceptance could not be recorded. Please try again or contact the committee."
        );
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (!result || result.ok !== true) {
        throw new Error(
          result?.message ||
          "The system did not confirm that your acceptance was recorded."
        );
      }

      let confirmation =
        result.message ||
        (result.already_accepted
          ? "Your acceptance is already recorded."
          : "Thank you. Your acceptance has been recorded successfully.");

      if (result.agreed_at) {
        confirmation +=
          " Recorded at: " +
          new Date(result.agreed_at).toLocaleString();
      }

      showMessage("submitMessage", confirmation, "success");

      const status = $("consentStatus");
      if (status) {
        status.textContent = "Your acceptance has been recorded.";
      }

      // Prevent a second submission from this page.
      agreeTerms.disabled = true;
      submitButton.textContent = "Acceptance Recorded";
    } catch (error) {
      console.error("Consent submission error:", error);

      showMessage(
        "submitMessage",
        error.message || "Submission failed. Please try again."
      );

      submitButton.disabled = !agreeTerms.checked || !verifiedMember;
      submitButton.textContent = "I Agree & Submit";
    }
  });
});
