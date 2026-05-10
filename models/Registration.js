const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  studentName: { type: String, required: true },
  fatherName: { type: String, required: true },
  dob: { type: Date, required: true },
  age: { type: Number, required: true },
  phoneNumber: { type: String, required: true, match: /^[0-9]{10}$/ },
  aadharNumber: { type: String, required: true, match: /^[0-9]{12}$/ },
  address: { type: String, required: true },
  city: { type: String, required: true },
  category: { type: String, default: 'Thodumurai' },
  paymentMode: { type: String, enum: ['Online', 'Offline'], required: true },
  paymentScreenshot: { type: String, default: null }, // Base64 string for simplicity as per requirements
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Registration', registrationSchema);
