function get_transfer_price(name = 'Transfer') {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  
  if (!sheet) {
    throw new Error("Sheet not found: " + name);
  }
  const value = sheet.getRange("A2").getValue();
  return value;
}
