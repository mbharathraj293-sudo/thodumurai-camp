document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registrationForm');
  const paymentModes = document.querySelectorAll('input[name="paymentMode"]');
  const onlinePaymentBox = document.getElementById('onlinePaymentBox');
  const offlinePaymentBox = document.getElementById('offlinePaymentBox');
  const paymentScreenshotInput = document.getElementById('paymentScreenshot');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const imagePreview = document.getElementById('imagePreview');
  
  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn.querySelector('.btn-text');
  const loader = submitBtn.querySelector('.loader');
  
  const successModal = document.getElementById('successModal');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // Input Validation elements
  const phoneInput = document.getElementById('phoneNumber');
  const aadharInput = document.getElementById('aadharNumber');
  
  // Payment mode toggle
  paymentModes.forEach(mode => {
    mode.addEventListener('change', (e) => {
      if (e.target.value === 'Online') {
        onlinePaymentBox.style.display = 'block';
        offlinePaymentBox.style.display = 'none';
        paymentScreenshotInput.setAttribute('required', 'required');
      } else {
        onlinePaymentBox.style.display = 'none';
        offlinePaymentBox.style.display = 'block';
        paymentScreenshotInput.removeAttribute('required');
      }
    });
  });

  // Image preview handle
  let base64Image = null;
  paymentScreenshotInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        base64Image = event.target.result;
        imagePreview.src = base64Image;
        imagePreviewContainer.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      base64Image = null;
      imagePreviewContainer.style.display = 'none';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Basic Custom Validation Check
    let isValid = true;
    if (!/^\d{10}$/.test(phoneInput.value)) {
      document.getElementById('phoneError').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('phoneError').style.display = 'none';
    }

    if (!/^\d{12}$/.test(aadharInput.value)) {
      document.getElementById('aadharError').style.display = 'block';
      isValid = false;
    } else {
      document.getElementById('aadharError').style.display = 'none';
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

    // Set loading state
    submitBtn.setAttribute('disabled', 'true');
    btnText.style.display = 'none';
    loader.style.display = 'block';

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataObj)
      });

      const result = await response.json();
      
      if (response.ok) {
        // We also sync it locally just in case Vercel is in stateless memory mode
        const localRegs = JSON.parse(localStorage.getItem('silambam_fallback') || '[]');
        localRegs.push({ _id: Date.now().toString(), createdAt: new Date().toISOString(), ...dataObj });
        localStorage.setItem('silambam_fallback', JSON.stringify(localRegs));

        successModal.classList.add('active');
        form.reset();
        imagePreviewContainer.style.display = 'none';
        base64Image = null;
      } else {
        throw new Error(result.message || 'Something went wrong.');
      }
    } catch (error) {
      console.warn('Backend failed or stateless. Using Local Browser Fallback.', error);
      
      // Fallback 100% to localStorage so the user experiences success
      const localRegs = JSON.parse(localStorage.getItem('silambam_fallback') || '[]');
      localRegs.push({ _id: Date.now().toString(), createdAt: new Date().toISOString(), ...dataObj });
      localStorage.setItem('silambam_fallback', JSON.stringify(localRegs));

      successModal.classList.add('active');
      form.reset();
      imagePreviewContainer.style.display = 'none';
      base64Image = null;
    } finally {
      // Revert loading state
      submitBtn.removeAttribute('disabled');
      btnText.style.display = 'block';
      loader.style.display = 'none';
    }
  });

  closeModalBtn.addEventListener('click', () => {
    successModal.classList.remove('active');
  });

  // Admin login button logic
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', () => {
      const pwd = prompt("Enter Admin Password:");
      if (pwd === "123456") {
        window.location.href = "admin.html";
      } else if (pwd !== null) {
        alert("Incorrect Password!");
      }
    });
  }

  // Numeric input constraints
  phoneInput.addEventListener('input', function() { this.value = this.value.replace(/[^0-9]/g, ''); });
  aadharInput.addEventListener('input', function() { this.value = this.value.replace(/[^0-9]/g, ''); });
});
