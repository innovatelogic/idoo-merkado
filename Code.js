//----------------------------------------------------------------------------------------------
// Add "Order" menu on spreadsheet open
//----------------------------------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔋 XBat Shop')
    .addItem('Створити', 'show_order_form')
    .addItem('Розрахувати', 'showCalculationForm')
    .addItem('Розрахувати (new)', 'show_calculation_form_new')
    .addItem('Export all', 'export_all')
    .addToUi();
}

//----------------------------------------------------------------------------------------------
function show_order_form() {
  const template = HtmlService.createTemplateFromFile('add_order');
  const html = template.evaluate()
    .setTitle('Додати замовлення')
    .setWidth(1000);

  SpreadsheetApp.getUi().showSidebar(html);
}
//----------------------------------------------------------------------------------------------
// Show the order form as SIDEBAR
function show_order_form_old() {
  const html = HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Додати замовлення (Old version)')
      .setWidth(800);  // Sidebar title
  SpreadsheetApp.getUi().showSidebar(html);
}

//----------------------------------------------------------------------------------------------
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('add_order');

  return template.evaluate()
    .setTitle("Add order")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

//----------------------------------------------------------------------------------------------
// log to file to google drive
//----------------------------------------------------------------------------------------------
function logToTxt(message) {
  const FILE_NAME = 'app-log.txt';

  const files = DriveApp.getFilesByName(FILE_NAME);
  const file = files.hasNext()
    ? files.next()
    : DriveApp.createFile(FILE_NAME, '', MimeType.PLAIN_TEXT);

  const timestamp = new Date().toISOString();
  const oldContent = file.getBlob().getDataAsString();

  const newLine = `[${timestamp}] ${message}\n`;
  file.setContent(oldContent + newLine);
}
