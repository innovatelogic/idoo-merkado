
//----------------------------------------------------------------------------------------------
//
//----------------------------------------------------------------------------------------------
function getAllAccounts(table_name = 'Bank Accaunts')
{
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(table_name);
  if (!sh) throw new Error('Sheet "${table_name}" not found!');

  const lastRow = sh.getLastRow();
  if (lastRow < 1) return [];

  // A → 1 column
  const data = sh.getRange(1, 1, lastRow, 1).getValues();

  const accounts = [];
  data.forEach(row => {
    accounts.push({label: `${row[0]}`});
  });
  return accounts;
}

//----------------------------------------------------------------------------------------------
//
//----------------------------------------------------------------------------------------------
function getAccountsBackets(table_name = 'Bank Accaunts')
{
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(table_name);
  if (!sh) throw new Error('Sheet "${table_name}" not found!');

  const lastRow = sh.getLastRow();
  if (lastRow < 1) return new Map();

  const backets = new Map();
  const data = sh.getRange(1, 1, lastRow, 2).getValues();

  data.forEach(row => {
     const account = row[0];
     const backet_id = row[1];

     if (!backets.has(backet_id)) backets.set(backet_id, []);
     backets.get(backet_id).push(account);
  });

  return backets;
}