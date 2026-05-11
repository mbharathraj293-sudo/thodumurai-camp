// Copy and paste this entirely into Google Apps Script
// Go to Google Sheets -> Extensions -> Apps Script

const SHEET_NAME = 'Registrations';

// Run this function ONCE to set up your sheet headers
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  sheet.clear();
  sheet.appendRow([
    'ID', 'Date Submitted', 'Student Name', 'Father Name', 'DOB', 
    'Age', 'Phone', 'Aadhar', 'Address', 'City', 
    'Category', 'Payment Mode', 'Screenshot Base64'
  ]);
  sheet.getRange("A1:M1").setFontWeight("bold");
  sheet.setFrozenRows(1);
}

// Handles POST requests from Vercel Server
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const body = JSON.parse(e.postData.contents);
    
    // Delete Registration Logic
    if (body.action === 'delete') {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === body.id) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Deleted' })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Not found' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Add New Registration Logic
    const newId = new Date().getTime().toString();
    const dateStr = new Date().toISOString();
    
    sheet.appendRow([
      newId,
      dateStr,
      body.studentName || '',
      body.fatherName || '',
      body.dob || '',
      body.age || '',
      body.phoneNumber || '',
      body.aadharNumber || '',
      body.address || '',
      body.city || '',
      body.category || '',
      body.paymentMode || '',
      body.paymentScreenshot || ''
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', id: newId })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Handles GET requests from Vercel Server
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: [] })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const rows = data.slice(1);
    
    // Map data nicely for the admin panel
    const formattedData = rows.map(row => {
      return {
        _id: String(row[0]),
        createdAt: row[1],
        studentName: row[2],
        fatherName: row[3],
        dob: row[4],
        age: row[5],
        phoneNumber: row[6],
        aadharNumber: row[7],
        address: row[8],
        city: row[9],
        category: row[10],
        paymentMode: row[11],
        paymentScreenshot: row[12]
      };
    });
    
    // Reverse sort to show recent first
    formattedData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: formattedData })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
