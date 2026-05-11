require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

const Registration = require('./models/Registration');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("FATAL ERROR: MONGODB_URI environment variable is missing.");
  console.error("Please add your MongoDB Atlas connection string to your Vercel Environment Variables.");
}

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
};
// API ROUTES

/**
 * @route POST /api/register
 * @desc Register a student
 */
app.post('/api/register', async (req, res) => {
  try {
    await connectDB();
    const {
      studentName, fatherName, dob, age, phoneNumber,
      aadharNumber, address, city, category,
      paymentMode, paymentScreenshot
    } = req.body;

    const newRegistration = new Registration({
      studentName, fatherName, dob, age, phoneNumber,
      aadharNumber, address, city, category,
      paymentMode, paymentScreenshot
    });
    await newRegistration.save();
    res.status(201).json({ message: 'Registration Successfully Submitted', data: newRegistration });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration. Ensure MongoDB is connected.', error: error.message });
  }
});

/**
 * @route GET /api/admin/registrations
 * @desc Fetch all registrations
 */
app.get('/api/admin/registrations', async (req, res) => {
  try {
    await connectDB();
    const registrations = await Registration.find().sort({ createdAt: -1 });
    
    const totalCount = registrations.length;
    const onlineCount = registrations.filter(r => r.paymentMode === 'Online').length;
    const offlineCount = registrations.filter(r => r.paymentMode === 'Offline').length;

    res.status(200).json({ stats: { totalCount, onlineCount, offlineCount }, data: registrations });
  } catch (error) {
    console.error('Admin Fetch Error:', error);
    res.status(500).json({ message: 'Failed to fetch registrations. Ensure MongoDB is connected.' });
  }
});

/**
 * @route DELETE /api/admin/registrations/:id
 * @desc Delete a registration entry
 */
app.delete('/api/admin/registrations/:id', async (req, res) => {
  try {
    await connectDB();
    await Registration.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Registration deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete registration.' });
  }
});

/**
 * @route GET /api/admin/export
 * @desc Generate and download Excel sheet
 */
app.get('/api/admin/export', async (req, res) => {
  try {
    await connectDB();
    const registrations = await Registration.find().sort({ createdAt: -1 });
    
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
    
    // Generate Base64 strictly for Serverless payload safety
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

// Start server only if not running in a serverless environment (like Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Export the Express API for Vercel Serverless Functions
module.exports = app;
