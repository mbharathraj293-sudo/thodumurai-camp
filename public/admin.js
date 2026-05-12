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

  // -----------------------------------------------------------------------
  // Show a status message in the table
  // -----------------------------------------------------------------------
  function showTableMessage(msg, isError = false) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 2rem; color: ${isError ? '#f44336' : '#aaa'};">
          ${msg}
        </td>
      </tr>`;
  }

  // -----------------------------------------------------------------------
  // Fetch registrations from backend, fall back to localStorage
  // -----------------------------------------------------------------------
  async function fetchRegistrations() {
    showTableMessage('⏳ Loading data...');

    let usedFallback = false;

    try {
      const response = await fetch('/api/admin/registrations');

      if (!response.ok) {
        // Server returned an error — log it and fall back
        const errData = await response.json().catch(() => ({}));
        console.error('[Admin] API error', response.status, errData.message || '');
        throw new Error(errData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();

      // Valid response — use it (even if data is empty)
      registrationsData = Array.isArray(result.data) ? result.data : [];
      updateStats(result.stats || {
        totalCount: registrationsData.length,
        onlineCount: registrationsData.filter(r => r.paymentMode === 'Online').length,
        offlineCount: registrationsData.filter(r => r.paymentMode === 'Offline').length
      });

      console.log(`[Admin] Loaded ${registrationsData.length} registrations (mode: ${result.mode || 'unknown'})`);

      if (result.mode === 'memory') {
        showBanner(
          '⚠️ Server is in <strong>Memory Mode</strong> — registrations reset when server restarts. ' +
          'Set up Google Sheets for persistent storage.',
          '#FF9800'
        );
      }

    } catch (err) {
      console.warn('[Admin] Backend fetch failed, using localStorage fallback:', err.message);
      usedFallback = true;

      const localRegs = JSON.parse(localStorage.getItem('silambam_fallback') || '[]');
      const sorted = [...localRegs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      registrationsData = sorted;
      updateStats({
        totalCount: sorted.length,
        onlineCount: sorted.filter(r => r.paymentMode === 'Online').length,
        offlineCount: sorted.filter(r => r.paymentMode === 'Offline').length
      });

      showBanner(
        `⚠️ Showing <strong>local browser data</strong> (backend unavailable: ${err.message}). ` +
        'Data is device-specific and may be incomplete.',
        '#f44336'
      );
    }

    renderTable(registrationsData);

    if (!usedFallback && registrationsData.length === 0) {
      showTableMessage('No registrations yet. Submissions will appear here.');
    }
  }

  // -----------------------------------------------------------------------
  // Show a dismissible banner at top of table
  // -----------------------------------------------------------------------
  function showBanner(html, color = '#FF9800') {
    const existing = document.getElementById('adminBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'adminBanner';
    banner.style.cssText = `
      background: ${color}22; border: 1px solid ${color};
      border-radius: 8px; padding: 12px 16px; margin-bottom: 1rem;
      color: #fff; font-size: 0.9rem; line-height: 1.5;
      display: flex; justify-content: space-between; align-items: center; gap: 1rem;
    `;
    banner.innerHTML = `<span>${html}</span>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1.2rem;line-height:1;">×</button>`;

    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) tableContainer.insertBefore(banner, tableContainer.firstChild);
  }

  // -----------------------------------------------------------------------
  // Update stat cards
  // -----------------------------------------------------------------------
  function updateStats(stats) {
    if (statTotal) statTotal.textContent = stats.totalCount ?? 0;
    if (statOnline) statOnline.textContent = stats.onlineCount ?? 0;
    if (statOffline) statOffline.textContent = stats.offlineCount ?? 0;
  }

  // -----------------------------------------------------------------------
  // Render table rows
  // -----------------------------------------------------------------------
  function renderTable(data) {
    if (!data || data.length === 0) {
      showTableMessage('No registrations found.');
      return;
    }

    tableBody.innerHTML = '';
    data.forEach(reg => {
      const row = document.createElement('tr');

      let dateStr = 'N/A';
      try {
        const d = new Date(reg.createdAt);
        dateStr = d.toLocaleDateString('en-IN') + ' ' +
          d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      } catch (_) {}

      const proofHtml = reg.paymentScreenshot
        ? `<button class="btn-view-img" onclick="window.viewImage('${reg.paymentScreenshot.replace(/'/g, "\\'")}')">View</button>`
        : `<span style="color:#777;">N/A</span>`;

      row.innerHTML = `
        <td>${dateStr}</td>
        <td><strong>${reg.studentName || '-'}</strong></td>
        <td>${reg.phoneNumber || '-'}</td>
        <td>${reg.city || '-'}</td>
        <td><span style="color:${reg.paymentMode === 'Online' ? '#4CAF50' : '#FF9800'}">${reg.paymentMode || '-'}</span></td>
        <td>${proofHtml}</td>
        <td>
          <button class="btn-delete" onclick="window.deleteReg('${reg._id}')">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  // -----------------------------------------------------------------------
  // Search filtering
  // -----------------------------------------------------------------------
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      if (!term) {
        renderTable(registrationsData);
        return;
      }
      const filtered = registrationsData.filter(reg =>
        (reg.studentName || '').toLowerCase().includes(term) ||
        (reg.phoneNumber || '').includes(term) ||
        (reg.city || '').toLowerCase().includes(term) ||
        (reg.fatherName || '').toLowerCase().includes(term)
      );
      renderTable(filtered);
    });
  }

  // -----------------------------------------------------------------------
  // View payment screenshot modal
  // -----------------------------------------------------------------------
  window.viewImage = (base64Str) => {
    if (!imgModal || !modalImg) return;
    modalImg.src = base64Str;
    imgModal.style.display = 'flex';
  };

  if (closeModal) {
    closeModal.addEventListener('click', () => {
      if (imgModal) imgModal.style.display = 'none';
    });
  }

  // Close modal on background click
  if (imgModal) {
    imgModal.addEventListener('click', (e) => {
      if (e.target === imgModal) imgModal.style.display = 'none';
    });
  }

  // -----------------------------------------------------------------------
  // Delete registration
  // -----------------------------------------------------------------------
  window.deleteReg = async (id) => {
    if (!confirm('Are you sure you want to delete this registration?')) return;

    try {
      const res = await fetch(`/api/admin/registrations/${id}`, { method: 'DELETE' });
      if (!res.ok) console.warn('[Admin] Server-side delete failed for ID:', id);
    } catch (e) {
      console.warn('[Admin] Could not reach server for delete:', e.message);
    }

    // Always remove from localStorage too
    let localRegs = JSON.parse(localStorage.getItem('silambam_fallback') || '[]');
    localRegs = localRegs.filter(r => String(r._id) !== String(id));
    localStorage.setItem('silambam_fallback', JSON.stringify(localRegs));

    // Refresh
    fetchRegistrations();
  };

  // -----------------------------------------------------------------------
  // Export to Excel
  // -----------------------------------------------------------------------
  const downloadExcelBtn = document.getElementById('downloadExcelBtn');
  if (downloadExcelBtn) {
    downloadExcelBtn.addEventListener('click', async () => {
      const originalText = downloadExcelBtn.textContent;
      downloadExcelBtn.textContent = '⏳ Downloading...';
      downloadExcelBtn.disabled = true;

      try {
        const response = await fetch('/api/admin/export');
        if (!response.ok) throw new Error(`Server returned HTTP ${response.status}`);

        const data = await response.json();
        if (!data.file) throw new Error('No file data returned from server.');

        // Decode Base64 → Blob → download
        const byteCharacters = atob(data.file);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteArray], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = data.fileName || 'Silambam_Registrations.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        console.log(`[Admin] Downloaded ${data.count} registrations as Excel.`);
      } catch (err) {
        alert('❌ Error downloading Excel: ' + err.message);
        console.error('[Admin] Export error:', err);
      } finally {
        downloadExcelBtn.textContent = originalText;
        downloadExcelBtn.disabled = false;
      }
    });
  }

  // -----------------------------------------------------------------------
  // Init — load data on page open
  // -----------------------------------------------------------------------
  fetchRegistrations();
});
