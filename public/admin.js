document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('tableBody');
  const searchInput = document.getElementById('searchInput');
  const statTotal = document.getElementById('statTotal');
  const statOnline = document.getElementById('statOnline');
  const statOffline = document.getElementById('statOffline');

  const imgModal = document.getElementById('imgModal');
  const modalImg = document.getElementById('modalImg');
  const closeModal = document.getElementById('closeModal');

  let registrationsData = [];

  // Fetch Data
  async function fetchRegistrations() {
    try {
      const response = await fetch('/api/admin/registrations');
      const result = await response.json();

      if (response.ok && result.data && result.data.length > 0) {
        registrationsData = result.data;
        updateStats(result.stats);
        renderTable(registrationsData);
      } else {
        throw new Error("Backend empty or unconfigured.");
      }
    } catch (err) {
      console.warn("Using Local Browser Fallback Mode for Admin Portal.");
      const localRegs = JSON.parse(localStorage.getItem('silambam_fallback') || '[]');
      const sorted = localRegs.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      const stats = {
        totalCount: sorted.length,
        onlineCount: sorted.filter(r => r.paymentMode === 'Online').length,
        offlineCount: sorted.filter(r => r.paymentMode === 'Offline').length
      };

      registrationsData = sorted;
      updateStats(stats);
      renderTable(registrationsData);
    }
  }

  function updateStats(stats) {
    statTotal.textContent = stats.totalCount;
    statOnline.textContent = stats.onlineCount;
    statOffline.textContent = stats.offlineCount;
  }

  function renderTable(data) {
    if (data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No registrations found</td></tr>`;
      return;
    }

    tableBody.innerHTML = '';
    data.forEach(reg => {
      const row = document.createElement('tr');
      const date = new Date(reg.createdAt).toLocaleDateString() + ' ' + new Date(reg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      const proofHtml = reg.paymentScreenshot 
        ? `<button class="btn-view-img" onclick="window.viewImage('${reg.paymentScreenshot}')">View</button>` 
        : `<span style="color:#777;">N/A</span>`;

      row.innerHTML = `
        <td>${date}</td>
        <td><strong>${reg.studentName}</strong></td>
        <td>${reg.phoneNumber}</td>
        <td>${reg.city}</td>
        <td><span style="color:${reg.paymentMode === 'Online' ? '#4CAF50' : '#FF9800'}">${reg.paymentMode}</span></td>
        <td>${proofHtml}</td>
        <td>
          <button class="btn-delete" onclick="window.deleteReg('${reg._id}')">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  // Search filtering
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = registrationsData.filter(reg => {
      return (
        reg.studentName.toLowerCase().includes(term) ||
        reg.phoneNumber.includes(term) ||
        reg.city.toLowerCase().includes(term) ||
        reg.fatherName.toLowerCase().includes(term)
      );
    });
    renderTable(filtered);
  });

  // Global functions for inline handlers
  window.viewImage = (base64Str) => {
    modalImg.src = base64Str;
    imgModal.style.display = 'flex';
  };

  window.deleteReg = async (id) => {
    if (confirm("Are you sure you want to delete this registration?")) {
      try {
        await fetch(`/api/admin/registrations/${id}`, { method: 'DELETE' });
      } catch (e) {}

      // Delete locally too
      let localRegs = JSON.parse(localStorage.getItem('silambam_fallback') || '[]');
      localRegs = localRegs.filter(r => r._id !== String(id));
      localStorage.setItem('silambam_fallback', JSON.stringify(localRegs));
      
      fetchRegistrations(); // refetch
    }
  };

  closeModal.addEventListener('click', () => {
    imgModal.style.display = 'none';
  });

  // Export Excel Handled via Base64 for Vercel Safety
  const downloadExcelBtn = document.getElementById('downloadExcelBtn');
  if (downloadExcelBtn) {
    downloadExcelBtn.addEventListener('click', async () => {
      const originalText = downloadExcelBtn.textContent;
      downloadExcelBtn.textContent = '⏳ Downloading...';
      downloadExcelBtn.disabled = true;

      try {
        const response = await fetch('/api/admin/export');
        if (!response.ok) throw new Error('Failed to fetch Excel data');
        
        const data = await response.json();
        
        // Decode Base64 to binary
        const byteCharacters = atob(data.file);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Trigger browser native download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        alert('Error downloading Excel: ' + err.message);
      } finally {
        downloadExcelBtn.textContent = originalText;
        downloadExcelBtn.disabled = false;
      }
    });
  }

  // Init
  fetchRegistrations();
});
