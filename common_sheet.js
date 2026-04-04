
//----------------------------------------------------------------------------------------------
// Retrive a map of colums where key is a head name and value is a actual index
//----------------------------------------------------------------------------------------------
function get_table_header_map(table_name, base = 0){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(table_name);
  if (!sh) throw new Error(`Sheet "${table_name}" not found!`);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  const columns = {};
  headers.forEach((name, i) => columns[name] = i + base);
  return columns;
}

//----------------------------------------------------------------------------------------------
function getColumnIndexes(table_name, base = 0) {
  return get_table_header_map(table_name, base);
}

//----------------------------------------------------------------------------------------------
function get_table_row_map(table_name) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(table_name);
  if (!sh) throw new Error(`[get_table_row_map] error: "${table_name}" not found!`);

  const last_row = sh.getLastRow();
  if (last_row < 2) return {};

  const values = sh.getRange(2, 1, last_row - 1, 1).getValues();

  const rows = {};

  values.forEach((row, i) =>{
    const key = row[0];
    if (!key) return;

    rows[key] = i + 2;
  });
  return rows;
}

//----------------------------------------------------------------------------------------------
function get_config_value(key)
{
  const table_name = ".config";
  const rows = get_table_row_map(table_name);

  if (!(key in rows)){
    throw new Error(`[get_config_value] error: no "${key}" found!`);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(table_name);
  if (!sh) throw new Error(`[get_config_value] error: "${table_name}" not found!`);

  return sh.getRange(rows[key], 2).getValue();
}

//----------------------------------------------------------------------------------------------
function get_currency_rate(curr1, curr2){
  const raw = get_config_value(".Currency");

  if (curr1 == '' || curr2 == ''){
    throw new Error(`[get_currency_rate] error: empty currency value!`);
  }

  if (curr1 == curr2){
    return 1.0;
  }

  const rates = typeof raw === "string"
    ? JSON.parse(raw)
    : raw;

  return rates["Currency"][curr1][curr2];
}

//----------------------------------------------------------------------------------------------
function TEST_read_config_sheet()
{
  const cols = get_table_row_map(".config");

  if (cols['.orgName'] != 2 ||
      cols['.shortName'] != 3 ||
      cols['.wwwAdress'] != 4 ||
      cols['.Locale'] != 5 ||
      cols['.Currency'] != 8){
    throw new Error(`[TEST_read_config_sheet] failed!`);
  }

  const val = get_config_value('.orgName');

  if (get_currency_rate("UAH", "UAH") != 1.0) {
    throw new Error(`[TEST_read_config_sheet] get_currency_rate error: invalid rate!`);
  }

  const uah_pln_rate = get_currency_rate("UAH", "PLN");

  console.log(`✅ ${getCallerFunctionName()} Test passed`);
}