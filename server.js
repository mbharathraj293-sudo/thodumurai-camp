require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const xlsx = require('xlsx');

// --- Node.js fetch compatibility (Node < 18 doesn't have global fetch) ---
let fetchFn;
(async () => {
  try {
    // Node 18+ has global fetch
    if (typeof fetch !== 'undefined') {
      fetchFn = fetch;
    } else {
      // Fallback: try node-fetch if installed
      const nodeFetch = require('node-fetch');
      fetchFn = nodeFetch.default || nodeFetch;
    }
  } catch (e) {
    fetchFn = null;
    console.warn('WARNING: fetch is not available. Google Sheets integration will be disabled.');
  }
})();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// --- GOOGLE SHEETS CONNECTION ---
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

const isGoogleConfigured = () =>
  GOOGLE_SCRIPT_URL &&
  GOOGLE_SCRIPT_URL.trim() !== '' &&
  GOOGLE_SCRIPT_URL !== 'your_google_apps_script_url_here' &&
  GOOGLE_SCRIPT_URL.startsWith('https://script.google.com/');

// NOTE: On Vercel serverless, in-memory fallbackDb resets on every cold start.
// If GOOGLE_SCRIPT_URL is not configured, data is NOT persisted across requests.
let fallbackDb = [];

if (!isGoogleConfigured()) {
  console.warn('==============================================');
  console.warn('WARNING: GOOGLE_SCRIPT_URL is not configured.');
  console.warn('Running in MEMORY-ONLY mode.');
  console.warn('Data will NOT persist across server restarts.');
  console.warn('Set GOOGLE_SCRIPT_URL in your .env or Vercel env vars.');
  console.warn('==============================================');
}

// --- Helper: Safe fetch with timeout ---
async function safeFetch(url, options = {}, timeoutMs = 15000) {
  if (!fetchFn) {
    throw new Error('fetch is not available on this server. Please upgrade Node.js to v18+.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// --- Helper: Parse Google Sheets response safely ---
async function parseGoogleResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Google Apps Script returned non-JSON:', text.slice(0, 500));
    throw new Error(
      "Google Apps Script returned an invalid response. " +
      "Ensure the script is deployed as a 'Web app' with access set to 'Anyone'."
    );
  }
}

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * @route GET /api/health
 * @desc Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    mode: isGoogleConfigured() ? 'google-sheets' : 'memory-only',
    googleConfigured: isGoogleConfigured(),
    timestamp: new Date().toISOString()
  });
});

/**
 * @route POST /api/register
 * @desc Forwards form data to Google Sheets (or memory fallback)
 */
app.post('/api/register', async (req, res) => {
  try {
    console.log('[POST /api/register] Incoming registration:', req.body?.studentName);

    if (!isGoogleConfigured()) {
      const newReg = {
        _id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        ...req.body
      };
      fallbackDb.push(newReg);
      console.log('[Memory Mode] Saved registration. Total in memory:', fallbackDb.length);
      return res.status(201).json({
        message: 'Registration Submitted (Memory Mode — data may not persist on Vercel)',
        data: newReg
      });
    }

    const response = await safeFetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(req.body)
    });

    const result = await parseGoogleResponse(response);

    if (result.status !== 'success') {
      throw new Error(result.error || 'Google Apps Script returned an error.');
    }

    console.log('[Google Sheets] Registration saved with ID:', result.id);
    res.status(201).json({
      message: 'Registration Successfully Submitted',
      data: { _id: result.id, ...req.body }
    });

  } catch (error) {
    console.error('[POST /api/register] Error:', error.message);
    res.status(500).json({
      message: error.message || 'Server error during registration.',
      hint: !isGoogleConfigured()
        ? 'Google Sheets is not configured. Set GOOGLE_SCRIPT_URL in environment variables.'
        : undefined
    });
  }
});

/**
 * @route GET /api/admin/registrations
 * @desc Fetches all registrations from Google Sheets (or memory fallback)
 */
app.get('/api/admin/registrations', async (req, res) => {
  try {
    console.log('[GET /api/admin/registrations] Fetching data...');

    if (!isGoogleConfigured()) {
      const sorted = [...fallbackDb].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      console.log('[Memory Mode] Returning', sorted.length, 'registrations.');
      return res.status(200).json({
        stats: {
          totalCount: sorted.length,
          onlineCount: sorted.filter(r => r.paymentMode === 'Online').length,
          offlineCount: sorted.filter(r => r.paymentMode === 'Offline').length
        },
        data: sorted,
        mode: 'memory'
      });
    }

    const response = await safeFetch(GOOGLE_SCRIPT_URL);
    const result = await parseGoogleResponse(response);

    if (result.status !== 'success') {
      throw new Error(result.error || 'Failed to fetch data from Google Sheets.');
    }

    const registrations = Array.isArray(result.data) ? result.data : [];
    console.log('[Google Sheets] Fetched', registrations.length, 'registrations.');

    res.status(200).json({
      stats: {
        totalCount: registrations.length,
        onlineCount: registrations.filter(r => r.paymentMode === 'Online').length,
        offlineCount: registrations.filter(r => r.paymentMode === 'Offline').length
      },
      data: registrations,
      mode: 'google-sheets'
    });

  } catch (error) {
    console.error('[GET /api/admin/registrations] Error:', error.message);
    res.status(500).json({
      message: 'Failed to fetch registrations: ' + error.message,
      hint: 'Check your GOOGLE_SCRIPT_URL and make sure the Apps Script is deployed with access set to Anyone.'
    });
  }
});

/**
 * @route DELETE /api/admin/registrations/:id
 * @desc Deletes a registration from Google Sheets (or memory fallback)
 */
app.delete('/api/admin/registrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[DELETE /api/admin/registrations/:id] Deleting ID:', id);

    if (!isGoogleConfigured()) {
      const before = fallbackDb.length;
      fallbackDb = fallbackDb.filter(r => r._id !== id);
      console.log('[Memory Mode] Deleted. Records before:', before, 'after:', fallbackDb.length);
      return res.status(200).json({ message: 'Registration deleted successfully' });
    }

    const response = await safeFetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'delete', id })
    });
    const result = await parseGoogleResponse(response);

    if (result.status !== 'success') {
      throw new Error(result.error || 'Failed to delete from Google Sheets.');
    }

    console.log('[Google Sheets] Deleted ID:', id);
    res.status(200).json({ message: 'Registration deleted successfully' });

  } catch (error) {
    console.error('[DELETE /api/admin/registrations/:id] Error:', error.message);
    res.status(500).json({ message: 'Failed to delete registration: ' + error.message });
  }
});

/**
 * @route GET /api/admin/export
 * @desc Generates and returns an Excel file as Base64
 */
app.get('/api/admin/export', async (req, res) => {
  try {
    console.log('[GET /api/admin/export] Generating Excel...');
    let registrations = [];

    if (!isGoogleConfigured()) {
      registrations = [...fallbackDb].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      const response = await safeFetch(GOOGLE_SCRIPT_URL);
      const result = await parseGoogleResponse(response);
      if (result.status !== 'success') throw new Error(result.error || 'Failed to fetch data.');
      registrations = Array.isArray(result.data) ? result.data : [];
    }

    console.log('[Export] Building Excel for', registrations.length, 'registrations.');

    const excelData = registrations.map(reg => ({
      'Date Submitted': reg.createdAt ? new Date(reg.createdAt).toLocaleString('en-IN') : 'N/A',
      'Student Name': reg.studentName || '',
      'Father Name': reg.fatherName || '',
      'DOB': reg.dob || '',
      'Age': reg.age || '',
      'Phone': reg.phoneNumber || '',
      'Aadhar': reg.aadharNumber || '',
      'City': reg.city || '',
      'Address': reg.address || '',
      'Category': reg.category || '',
      'Payment Mode': reg.paymentMode || ''
    }));

    if (excelData.length === 0) {
      // Return empty sheet rather than crashing
      excelData.push({ 'Date Submitted': 'No registrations found', 'Student Name': '', 'Father Name': '', 'DOB': '', 'Age': '', 'Phone': '', 'Aadhar': '', 'City': '', 'Address': '', 'Category': '', 'Payment Mode': '' });
    }

    const worksheet = xlsx.utils.json_to_sheet(excelData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Registrations');

    const base64Excel = xlsx.write(workbook, { type: 'base64', bookType: 'xlsx' });

    res.status(200).json({
      message: 'Success',
      fileName: `Silambam_Registrations_${new Date().toISOString().split('T')[0]}.xlsx`,
      file: base64Excel,
      count: registrations.length
    });

  } catch (error) {
    console.error('[GET /api/admin/export] Error:', error.message);
    res.status(500).json({ message: 'Failed to generate export file: ' + error.message });
  }
});

// --- Catch-all: serve index.html for unknown routes (SPA fallback) ---
app.get('*', (req, res) => {
  // Don't intercept API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API route not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start server only when running directly (not in serverless) ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\nServer running on http://localhost:${PORT}`);
    console.log(`Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`Mode: ${isGoogleConfigured() ? 'Google Sheets' : 'Memory Only'}\n`);
  });
}

// Export for Vercel serverless
module.exports = app;
