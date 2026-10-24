
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const form = $("consentForm");
  const flatInput = $("flatNumber");
  const codeInput = $("accessCode");
  const agreeInput = $("agreeTerms");
  const submitButton = $("submitButton");
  const statusBox = $("consentStatus");

  function showStatus(message, isError = false) {
    if (statusBox) {
      statusBox.textContent = message;
      statusBox.style.color = isError ? "#b42318" : "#18794e";
      statusBox.style.display = "block";
    } else {
      alert(message);
    }
  }

  if (!form) {
    console.error("Consent form not found. Check the form ID in consent.html.");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const flat = (flatInput?.value || "").trim();
    const memberCode = (codeInput?.value || "").trim();
    const agreed = Boolean(agreeInput?.checked);

    if (!flat || !memberCode) {
      showStatus("Please enter your flat number and access code.", true);
      return;
    }

    if (!agreed) {
      showStatus("Please read and accept the Terms and Conditions.", true);
      return;
    }

    if (
      !window.supabase ||
      !window.SUPABASE_URL ||
      !window.SUPABASE_ANON_KEY
    ) {
      showStatus(
        "The page configuration is incomplete. Please contact the committee.",
        true
      );
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Please wait...";
    }

    try {
      const client = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );

      // Verify the member using the existing login function.
      const { data: loginData, error: loginError } =
        await client.rpc("member_login", {
          p_flat: flat,
          p_code: memberCode
        });

      if (loginError) {
        throw new Error(
          "We could not verify your details. Please check them and try again."
        );
      }

      // The existing function may return an object or a single-row array.
      const member = Array.isArray(loginData)
        ? loginData[0]
        : loginData;

      if (!member || typeof member !== "object") {
        throw new Error(
          "We could not verify your member details. Please contact the committee."
        );
      }

      // Support common response field names.
      const preallocatedSlot =
        member.pre_allocated_slot ??
        member.preallocated_slot ??
        member.preallocatedSlot;

      if (!preallocatedSlot) {
        throw new Error(
          "This flat does not appear to have a pre-allocated parking slot. Please contact the committee."
        );
      }

      // Record acceptance in the separate consent table.
      const { data: consentData, error: consentError } =
        await client.rpc("submit_preallocated_consent", {
          p_flat: flat,
          p_code: memberCode,
          p_agree: true
        });

      if (consentError) {
        throw new Error(
          "Your acceptance could not be recorded. Please try again or contact the committee."
        );
      }

      const result = Array.isArray(consentData)
        ? consentData[0]
        : consentData;

      if (!result || result.ok !== true) {
        throw new Error(
          "The system did not confirm your acceptance. Please contact the committee."
        );
      }

      showStatus(
        result.already_accepted
          ? "Your acceptance of the Terms and Conditions is already recorded."
          : "Thank you. Your acceptance of the Terms and Conditions has been recorded successfully."
      );

      form.reset();

    } catch (error) {
      console.error("Consent submission failed:", error);
      showStatus(
        error.message ||
          "Something went wrong. Please try again or contact the committee.",
        true
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "I Agree & Submit";
      }
    }
  });
});
