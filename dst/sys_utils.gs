
//----------------------------------------------------------------------------------------------
// Returns current function name
//----------------------------------------------------------------------------------------------
function getCallerFunctionName() {
  const stack = new Error().stack.split("\n");
  // stack[0] = "Error"
  // stack[1] = at getCurrentFunctionName
  // stack[2] = at testPriceExport  <-- we want this
  const callerLine = stack[2] || "";
  const match = callerLine.match(/at (\w+)/);
  return match ? match[1] : "unknown";
}

function getTimestamp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return Utilities.formatDate(
    new Date(),
    ss.getSpreadsheetTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );
}