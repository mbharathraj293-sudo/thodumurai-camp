document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registrationForm');
  const paymentModes = document.querySelectorAll('input[name="paymentMode"]');
  const onlinePaymentBox = document.getElementById('onlinePaymentBox');
  const offlinePaymentBox = document.getElementById('offlinePaymentBox');
  const paymentScreenshotInput = document.getElementById('paymentScreenshot');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const imagePreview = document.getElementById('imagePreview');

  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
  const loader = submitBtn ? submitBtn.querySelector('.loader') : null;

  const successModal = document.getElementById('successModal');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // Input Validation elements
  const phoneInput = document.getElementById('phoneNumber');
  const aadharInput = document.getElementById('aadharNumber');

  // -----------------------------------------------------------------------
  // Payment mode toggle
  // -----------------------------------------------------------------------
  paymentModes.forEach(mode => {
    mode.addEventListener('change', (e) => {
      if (e.target.value === 'Online') {
        if (onlinePaymentBox) onlinePaymentBox.style.display = 'block';
        if (offlinePaymentBox) offlinePaymentBox.style.display = 'none';
        if (paymentScreenshotInput) paymentScreenshotInput.setAttribute('required', 'required');
      } else {
        if (onlinePaymentBox) onlinePaymentBox.style.display = 'none';
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

      // Build the local entry (always saved locally as backup)
      const localEntry = {
        _id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        ...dataObj
      };

      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataObj)
        });

        const result = await response.json();

        if (response.ok) {
          // Sync to localStorage as local backup
          const localRegs = JSON.parse(localStorage.getItem('silambam_fallback') || '[]');
          localRegs.push(localEntry);
          localStorage.setItem('silambam_fallback', JSON.stringify(localRegs));

          showSuccess();
        } else {
          throw new Error(result.message || 'Something went wrong.');
        }
      } catch (error) {
        console.warn('Backend unavailable. Saving to local storage.', error.message);

        // Fallback: save to localStorage so registration is not lost
        const localRegs = JSON.parse(localStorage.getItem('silambam_fallback') || '[]');
        localRegs.push(localEntry);
        localStorage.setItem('silambam_fallback', JSON.stringify(localRegs));

        showSuccess();
      } finally {
        if (submitBtn) submitBtn.removeAttribute('disabled');
        if (btnText) btnText.style.display = 'block';
        if (loader) loader.style.display = 'none';
      }
    });
  }

  function showSuccess() {
    if (successModal) successModal.classList.add('active');
    if (form) form.reset();
    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
    base64Image = null;
  }

  // -----------------------------------------------------------------------
  // Success modal close
  // -----------------------------------------------------------------------
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      if (successModal) successModal.classList.remove('active');
    });
  }

  // -----------------------------------------------------------------------
  // Admin login button — opens admin panel with password
  // -----------------------------------------------------------------------
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', () => {
      const pwd = prompt('Enter Admin Password:');
      if (pwd === null) return; // User cancelled
      if (pwd === '123456') {
        window.location.href = '/admin.html';
      } else {
        alert('Incorrect Password! Access Denied.');
      }
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
});
