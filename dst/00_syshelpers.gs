//----------------------------------------------------------------------------------------------
function get_caller_function_name() {
  const stack = new Error().stack.split("\n");
  // stack[0] = "Error"
  // stack[1] = at getCurrentFunctionName
  // stack[2] = at testPriceExport  <-- we want this
  const callerLine = stack[2] || "";
  const match = callerLine.match(/at (\w+)/);
  return match ? match[1] : "unknown";
}

//----------------------------------------------------------------------------------------------
function get_timestamp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return Utilities.formatDate(
    new Date(),
    ss.getSpreadsheetTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );
}

//----------------------------------------------------------------------------------------------
function get_config_value(sh, key) {
  const rows = get_table_row_map(sh);

  if (!(key in rows)){
    throw new Error(`[get_config_value] error: no "${key}" found!`);
  }

  if (!sh) throw new Error(`[get_config_value] error: "${table_name}" not found!`);

  return sh.getRange(rows[key], 2).getValue();
}

//----------------------------------------------------------------------------------------------
function get_currency_rate(sh, curr1, curr2){
  const raw = get_config_value(sh, ".Currency");

  if (curr1 == '' || curr2 == ''){
    throw new Error(`[get_currency_rate] error: empty currency value!`);
  }

  if (curr1 == curr2){
    return 1.0;
  }

  const rates = typeof raw === "string" ? JSON.parse(raw) : raw;

  return rates["Currency"][curr1][curr2];
}