document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registrationForm');
  const paymentModes = document.querySelectorAll('input[name="paymentMode"]');
  const offlinePaymentBox = document.getElementById('offlinePaymentBox');
  const paymentScreenshotInput = document.getElementById('paymentScreenshot');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const imagePreview = document.getElementById('imagePreview');

  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
  const loader = submitBtn ? submitBtn.querySelector('.loader') : null;

  const successModal = document.getElementById('successModal');
  const closeModalBtn = document.getElementById('closeModalBtn');

  function showSuccess() {
    if (form) form.reset();
    if (offlinePaymentBox) offlinePaymentBox.style.display = 'block';
    if (successModal) successModal.classList.add('active');
  }

  // Input Validation elements
  const phoneInput = document.getElementById('phoneNumber');
  const aadharInput = document.getElementById('aadharNumber');

  // -----------------------------------------------------------------------
  // Payment mode toggle
  // -----------------------------------------------------------------------
  paymentModes.forEach(mode => {
    mode.addEventListener('change', (e) => {
      if (e.target.value === 'Online') {

        if (offlinePaymentBox) offlinePaymentBox.style.display = 'none';
        if (paymentScreenshotInput) paymentScreenshotInput.setAttribute('required', 'required');
      } else {

        if (offlinePaymentBox) offlinePaymentBox.style.display = 'block';
        if (paymentScreenshotInput) paymentScreenshotInput.removeAttribute('required');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Image preview (only if the input exists in HTML)
  // -----------------------------------------------------------------------
  let base64Image = null;

  if (paymentScreenshotInput) {
    paymentScreenshotInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        // Warn if file is very large (base64 of >2MB can slow submission)
        if (file.size > 2 * 1024 * 1024) {
          alert('Screenshot is large (>2MB). Consider using a smaller image for faster upload.');
        }
        const reader = new FileReader();
        reader.onload = function (event) {
          base64Image = event.target.result;
          if (imagePreview) imagePreview.src = base64Image;
          if (imagePreviewContainer) imagePreviewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        base64Image = null;
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
      }
    });
  }

  // -----------------------------------------------------------------------
  // Form submission
  // -----------------------------------------------------------------------
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validation
      let isValid = true;
      if (phoneInput && !/^\d{10}$/.test(phoneInput.value)) {
        document.getElementById('phoneError').style.display = 'block';
        isValid = false;
      } else {
        const pe = document.getElementById('phoneError');
        if (pe) pe.style.display = 'none';
      }

      if (aadharInput && !/^\d{12}$/.test(aadharInput.value)) {
        document.getElementById('aadharError').style.display = 'block';
        isValid = false;
      } else {
        const ae = document.getElementById('aadharError');
        if (ae) ae.style.display = 'none';
      }

      if (!isValid) return;

      // Collect data
      const formData = new FormData(form);
      const dataObj = Object.fromEntries(formData.entries());

      if (dataObj.paymentMode === 'Online') {
        dataObj.paymentScreenshot = base64Image;
      } else {
        dataObj.paymentScreenshot = null;
      }



      // Loading state
      if (submitBtn) submitBtn.setAttribute('disabled', 'true');
      if (btnText) btnText.style.display = 'none';
      if (loader) loader.style.display = 'block';

      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...dataObj,
            createdAt: new Date().toISOString()
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || 'Server error while submitting registration.');
        }

        showSuccess();

      } catch (error) {

        console.error("Registration Error:", error);
        alert("Error saving registration. Please try again.");

      } finally {

        if (submitBtn) submitBtn.removeAttribute('disabled');

        if (btnText) btnText.style.display = 'block';

        if (loader) loader.style.display = 'none';

      }
    });

    // -----------------------------------------------------------------------
    // Success modal close
    // -----------------------------------------------------------------------
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        if (successModal) successModal.classList.remove('active');
      });
    }

    // -----------------------------------------------------------------------
    // Numeric-only inputs
    // -----------------------------------------------------------------------
    if (phoneInput) {
      phoneInput.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
      });
    }
    if (aadharInput) {
      aadharInput.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
      });
    }


    // other code above

    const offlineRadio = document.querySelector('input[name="paymentMode"][value="Offline"]');
    if (offlineRadio && offlinePaymentBox) {
      offlineRadio.addEventListener('change', () => {
        offlinePaymentBox.style.display = offlineRadio.checked ? 'block' : 'none';
      });

      if (offlineRadio.checked) {
        offlinePaymentBox.style.display = 'block';
      }
    }
  }
});
