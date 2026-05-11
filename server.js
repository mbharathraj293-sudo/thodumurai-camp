require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// GOOGLE SHEETS CONNECTION
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

let fallbackDb = []; // Zero-config in-memory fallback to prevent crashes

if (!GOOGLE_SCRIPT_URL || !GOOGLE_SCRIPT_URL.startsWith('https://script.google.com/')) {
  console.warn("WARNING: GOOGLE_SCRIPT_URL is missing or invalid. Using Zero-Config Memory Mode.");
}

// API ROUTES

/**
 * @route POST /api/register
 * @desc Forwards form data to Google Sheets
 */
app.post('/api/register', async (req, res) => {
  try {
    if (!GOOGLE_SCRIPT_URL || !GOOGLE_SCRIPT_URL.startsWith('https://script.google.com/')) {
      const newReg = { _id: Date.now().toString(), createdAt: new Date().toISOString(), ...req.body };
      fallbackDb.push(newReg);
      return res.status(201).json({ message: 'Registration Successfully Submitted (Memory Mode)', data: newReg });
    }

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    
    let result;
    try {
      result = await response.json();
    } catch (e) {
      return res.status(500).json({ message: "Setup Error: Google Apps Script failed. Ensure you deployed it as a 'Web app' and set Access to 'Anyone'." });
    }
    
    if (result.status !== 'success') throw new Error(result.error);

    res.status(201).json({ message: 'Registration Successfully Submitted', data: { _id: result.id, ...req.body } });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: error.message || 'Server error during registration.' });
  }
});

/**
 * @route GET /api/admin/registrations
 * @desc Fetches data from Google Sheets
 */
app.get('/api/admin/registrations', async (req, res) => {
  try {
    if (!GOOGLE_SCRIPT_URL || !GOOGLE_SCRIPT_URL.startsWith('https://script.google.com/')) {
      const sorted = [...fallbackDb].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      const totalCount = sorted.length;
      const onlineCount = sorted.filter(r => r.paymentMode === 'Online').length;
      const offlineCount = sorted.filter(r => r.paymentMode === 'Offline').length;
      return res.status(200).json({ stats: { totalCount, onlineCount, offlineCount }, data: sorted });
    }

    const response = await fetch(GOOGLE_SCRIPT_URL);
    let result;
    try {
      result = await response.json();
    } catch (e) {
      return res.status(500).json({ message: "Setup Error: Google Apps Script not accessible. Did you set access to 'Anyone'?" });
    }
    
    if (result.status !== 'success') throw new Error(result.error);

    const registrations = result.data || [];
    
    const totalCount = registrations.length;
    const onlineCount = registrations.filter(r => r.paymentMode === 'Online').length;
    const offlineCount = registrations.filter(r => r.paymentMode === 'Offline').length;

    res.status(200).json({ stats: { totalCount, onlineCount, offlineCount }, data: registrations });
  } catch (error) {
    console.error('Admin Fetch Error:', error);
    res.status(500).json({ message: 'Failed to fetch registrations.' });
  }
});

/**
 * @route DELETE /api/admin/registrations/:id
 * @desc Forwards delete command to Google Sheets
 */
app.delete('/api/admin/registrations/:id', async (req, res) => {
  try {
    if (!GOOGLE_SCRIPT_URL || !GOOGLE_SCRIPT_URL.startsWith('https://script.google.com/')) {
      fallbackDb = fallbackDb.filter(r => r._id !== req.params.id);
      return res.status(200).json({ message: 'Registration deleted successfully' });
    }

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', id: req.params.id })
    });
    const result = await response.json();

    if (result.status !== 'success') throw new Error(result.error);
    
    res.status(200).json({ message: 'Registration deleted successfully' });
  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).json({ message: 'Failed to delete registration.' });
  }
});

/**
 * @route GET /api/admin/export
 * @desc Generates Excel from Google Sheets data
 */
app.get('/api/admin/export', async (req, res) => {
  try {
    let registrations = [];
    if (!GOOGLE_SCRIPT_URL || !GOOGLE_SCRIPT_URL.startsWith('https://script.google.com/')) {
      registrations = [...fallbackDb].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      const response = await fetch(GOOGLE_SCRIPT_URL);
      const result = await response.json();
      if (result.status !== 'success') throw new Error(result.error);
      registrations = result.data || [];
    }
    
    const excelData = registrations.map(reg => ({
      'Date Submitted': new Date(reg.createdAt).toISOString().split('T')[0],
      'Student Name': reg.studentName,
      'Father Name': reg.fatherName,
      'DOB': new Date(reg.dob).toISOString().split('T')[0],
      'Age': reg.age,
      'Phone': reg.phoneNumber,
      'Aadhar': reg.aadharNumber,
      'City': reg.city,
      'Address': reg.address,
      'Payment Mode': reg.paymentMode
    }));

    const worksheet = xlsx.utils.json_to_sheet(excelData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Registrations');
    
    const base64Excel = xlsx.write(workbook, { type: 'base64', bookType: 'xlsx' });

    res.status(200).json({ 
      message: 'Success', 
      fileName: 'Silambam_Registrations_2026.xlsx',
      file: base64Excel 
    });
  } catch (error) {
    console.error('Export Error:', error);
    res.status(500).json({ message: 'Failed to generate export file.' });
  }
});

// Start server only if not running in a serverless environment
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
