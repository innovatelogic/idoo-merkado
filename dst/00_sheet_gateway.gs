
//----------------------------------------------------------------------------------------------
class Runtime {
  getSpreadsheet() {
    throw new Error('Not implemented');
  }
}

//----------------------------------------------------------------------------------------------
class GASRuntime extends Runtime {
  getSpreadsheet() {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

//----------------------------------------------------------------------------------------------
globalThis.SheetGateway = class SheetGateway {
  constructor(runtime) {
    this._runtime = runtime || new GASRuntime();
  }

  getSheet(tableName) {
    const ss = this._runtime.getSpreadsheet();
    const sheet = ss.getSheetByName(tableName);

    if (!sheet) {
      throw new Error(`Sheet "${tableName}" not found!`);
    }

    return sheet;
  }

  getData(sheet) {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 2) return [];

    return sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  }
};
