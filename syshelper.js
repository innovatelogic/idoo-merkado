function cleanOldVersions() {
  const SCRIPT_ID = '1YcQN273VFk8usOXH_uhDQSQeQEX-DYpWuBnaRZOPkWWN-sXyyhRX3Efb';
  const KEEP_LATEST = 10; // keep last N versions

  const token = ScriptApp.getOAuthToken();

  const res = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${SCRIPT_ID}/versions`,
    {
      headers: { Authorization: 'Bearer ' + token }
    }
  );

  const data = JSON.parse(res.getContentText());
  const versions = data.versions || [];

  // Sort newest first
  versions.sort((a, b) => b.versionNumber - a.versionNumber);

  const toDelete = versions.slice(KEEP_LATEST);

  toDelete.forEach(v => {
    Logger.log("Deleting version " + v.versionNumber);

    UrlFetchApp.fetch(
      `https://script.googleapis.com/v1/projects/${SCRIPT_ID}/versions/${v.versionNumber}`,
      {
        method: 'delete',
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true
      }
    );
  });

  Logger.log("Done");
}


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