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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/silambam_camp';
let isConnectedToMongo = false;
const LOCAL_DB_PATH = path.join(__dirname, 'local_db.json');

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000 // Fast fail
})
.then(() => {
  console.log('Connected to MongoDB successfully');
  isConnectedToMongo = true;
})
.catch((err) => {
  console.error('MongoDB connection failed. Using local JSON file fallback database!', err.message);
  isConnectedToMongo = false;
  // Initialize local DB file if it doesn't exist
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify([]));
  }
});


// Helper for Local DB
const getLocalData = () => {
  if (!fs.existsSync(LOCAL_DB_PATH)) return [];
  const data = fs.readFileSync(LOCAL_DB_PATH);
  return JSON.parse(data);
};

const saveLocalData = (data) => {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
};

// API ROUTES

/**
 * @route POST /api/register
 * @desc Register a student
 */
app.post('/api/register', async (req, res) => {
  try {
    const {
      studentName, fatherName, dob, age, phoneNumber,
      aadharNumber, address, city, category,
      paymentMode, paymentScreenshot
    } = req.body;

    if (isConnectedToMongo) {
      const newRegistration = new Registration({
        studentName, fatherName, dob, age, phoneNumber,
        aadharNumber, address, city, category,
        paymentMode, paymentScreenshot
      });
      await newRegistration.save();
      res.status(201).json({ message: 'Registration Successfully Submitted', data: newRegistration });
    } else {
      // Local DB Fallback (Allows user to test without installing MongoDB)
      const registrations = getLocalData();
      const newReg = {
        _id: Date.now().toString(),
        studentName, fatherName, dob, age, phoneNumber,
        aadharNumber, address, city, category,
        paymentMode, paymentScreenshot,
        createdAt: new Date().toISOString()
      };
      registrations.push(newReg);
      saveLocalData(registrations);
      res.status(201).json({ message: 'Registration Successfully Submitted (Local Mode)', data: newReg });
    }
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
});

/**
 * @route GET /api/admin/registrations
 * @desc Fetch all registrations
 */
app.get('/api/admin/registrations', async (req, res) => {
  try {
    let registrations = [];
    if (isConnectedToMongo) {
      registrations = await Registration.find().sort({ createdAt: -1 });
    } else {
      registrations = getLocalData().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    // Stats calculation
    const totalCount = registrations.length;
    const onlineCount = registrations.filter(r => r.paymentMode === 'Online').length;
    const offlineCount = registrations.filter(r => r.paymentMode === 'Offline').length;

    res.status(200).json({
      stats: { totalCount, onlineCount, offlineCount },
      data: registrations
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch registrations.' });
  }
});

/**
 * @route DELETE /api/admin/registrations/:id
 * @desc Delete a registration entry
 */
app.delete('/api/admin/registrations/:id', async (req, res) => {
  try {
    if (isConnectedToMongo) {
      await Registration.findByIdAndDelete(req.params.id);
    } else {
      let registrations = getLocalData();
      registrations = registrations.filter(r => r._id !== req.params.id);
      saveLocalData(registrations);
    }
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
    let registrations = [];
    if (isConnectedToMongo) {
      registrations = await Registration.find().sort({ createdAt: -1 });
    } else {
      registrations = getLocalData().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    // Map data for excel
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

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Silambam_Registrations_2026.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
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
