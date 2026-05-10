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
      const response = await fetch('http://localhost:3000/api/admin/registrations');
      const result = await response.json();

      if (response.ok) {
        registrationsData = result.data;
        updateStats(result.stats);
        renderTable(registrationsData);
      } else {
        tableBody.innerHTML = `<tr><td colspan="7">Failed to load data.</td></tr>`;
      }
    } catch (err) {
      console.error(err);
      tableBody.innerHTML = `<tr><td colspan="7">Error connecting to server.</td></tr>`;
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
        const response = await fetch(`http://localhost:3000/api/admin/registrations/${id}`, { method: 'DELETE' });
        if (response.ok) {
          fetchRegistrations(); // refetch
        } else {
          alert('Failed to delete');
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }
  };

  closeModal.addEventListener('click', () => {
    imgModal.style.display = 'none';
  });

  // Init
  fetchRegistrations();
});
