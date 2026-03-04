//----------------------------------------------------------------------------------------------
// Add "Order" menu on spreadsheet open
//----------------------------------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Замовлення')
    .addItem('Створити', 'showOrderForm')
    .addItem('Розрахувати', 'showCalculationForm')
    .addItem('Export Prom (TEST)', 'export_prom_yml')
    .addItem('Створити(TEST)', 'showOrderFormNew')
    .addToUi();
}

//----------------------------------------------------------------------------------------------
// Show the order form as SIDEBAR
function showOrderForm() {
  const html = HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Додати')
      .setWidth(800);  // Sidebar title
  SpreadsheetApp.getUi().showSidebar(html);
}

//----------------------------------------------------------------------------------------------
// Show the order form as SIDEBAR
function showOrderFormNew() {
  const template = HtmlService.createTemplateFromFile('add_order');
  const html = template.evaluate()
    .setTitle('Додати New')
    .setWidth(1000);

  SpreadsheetApp.getUi().showSidebar(html);
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
