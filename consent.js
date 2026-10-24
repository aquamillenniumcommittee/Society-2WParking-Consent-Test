
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const form = $("verifyForm");
  const flatInput = $("flat");
  const codeInput = $("accessCode");
  const agreeInput = $("agreeTerms");
  const submitButton = $("verifyButton");
  const statusBox = $("verifyMessage");

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
    alert("The form could not be found. Please contact the committee.");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const flat = (flatInput?.value || "").trim();
    const code = (codeInput?.value || "").trim();

    if (!flat || !code) {
      showStatus("Please enter your flat number and access code.", true);
      return;
    }

    if (!agreeInput?.checked) {
      showStatus("Please accept the Terms and Conditions.", true);
      return;
    }

    if (
      !window.supabase ||
      !window.SUPABASE_URL ||
      !window.SUPABASE_ANON_KEY
    ) {
      showStatus("The Supabase configuration is missing.", true);
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

      const { data: loginData, error: loginError } =
        await client.rpc("member_login", {
          p_flat: flat,
          p_code: code
        });

      if (loginError) {
        throw new Error(
          "Member verification failed. Please check your details or contact the committee."
        );
      }

      const member = Array.isArray(loginData)
        ? loginData[0]
        : loginData;

      if (!member || typeof member !== "object") {
        throw new Error("The login response could not be read.");
      }

      const slot =
        member.pre_allocated_slot ??
        member.preallocated_slot ??
        member.preallocatedSlot;

      if (!slot) {
        throw new Error(
          "No pre-allocated slot was found for this flat."
        );
      }

      const { data: result, error: consentError } =
        await client.rpc("submit_preallocated_consent", {
          p_flat: flat,
          p_code: code,
          p_agree: true
        });

      if (consentError) {
        throw new Error(
          "Acceptance could not be recorded. Please contact the committee."
        );
      }

      const response = Array.isArray(result) ? result[0] : result;

      if (!response || response.ok !== true) {
        throw new Error("The system did not confirm the acceptance.");
      }

      showStatus(
        response.already_accepted
          ? "Your acceptance is already recorded."
          : "Thank you. Your acceptance has been recorded successfully."
      );

      form.reset();
    } catch (error) {
      console.error("Consent submission error:", error);
      showStatus(error.message || "Something went wrong.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Verify my details";
      }
    }
  });
});
