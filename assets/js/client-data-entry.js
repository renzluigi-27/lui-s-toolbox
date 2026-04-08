    const PASSWORD = "rlpgulla";

    function checkPassword() {
      const passwordInput = document.getElementById("password");
      const authStatus = document.getElementById("authStatus");
      const authSection = document.getElementById("authSection");
      const form = document.getElementById("clientForm");

      if (passwordInput.value !== PASSWORD) {
        authStatus.textContent = "Access Denied";
        return;
      }

      authStatus.textContent = "";
      authSection.style.display = "none";
      form.style.display = "block";
    }
  

    const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyQVXGFYy3aD8eR2ClRR6D6CD6NoWwLN2NX6xIAxnnpC0qQbvf0Yz3tYlv4kaIY9l-UHA/exec";

    document.getElementById("clientForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      const status = document.getElementById("status");
      status.className = "";
      status.textContent = "Submitting...";
      status.style.display = "block";

      const formData = new FormData(this);
      const payload = {};
      formData.forEach((value, key) => {
        payload[key] = value;
      });

      console.log("[client-data-entry] payload:", payload);

      try {
        const response = await fetch(WEB_APP_URL, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        console.log("[client-data-entry] response:", response);

        let result = { success: response.ok };
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          result = await response.json();
        }

        if (result.success) {
          status.className = "success";
          status.textContent = "Submitted successfully.";
          this.reset();
        } else {
          status.className = "error";
          status.textContent = "Submission failed.";
        }
      } catch (error) {
        console.log("[client-data-entry] error:", error);
        status.className = "error";
        status.textContent = "Error submitting form.";
      }
    });
  

  fetch('/components/footer.html')
    .then(res => res.text())
    .then(data => {
      document.getElementById('footer').innerHTML = data;
    });
  
