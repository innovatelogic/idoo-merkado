class Account {
  constructor(context){
    this._name = context.name;
    this._bucket = context.bucket;
    this._card = context.card;
    this._tax_rule = context.tax_rule;
  }
}

//----------------------------------------------------------------------------------------------
function deserialize_accounts(table_name = 'TEST_Bank Accaunts'){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(table_name);
  if (!sh) throw new Error(`Sheet "${table_name}" not found!`);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];

  const headers = getColumnIndexes(table_name);
  const data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const accounts = [];

  data.forEach(row => {
    try {
      const context = {
        name: row[headers['Name']],
        bucket: row[headers['Bucket']],
        card: row[headers['Card']],
        tax_rule: row[headers['Tax Rule']]
      };

      const account = new Account(context);
      accounts.push(account);

    } catch (e) {
      Logger.log(`Row failed: ${e.message}`);
    }
  });

  return accounts;
}

//----------------------------------------------------------------------------------------------
function TEST_Process_Tax_Formula() {
  const tax_rule = `{"tax":"(\${WEIGHT_KG} * \${TRANSFER_PRICE_KG}) + (\${FULL_PRICE} * 0.01)"}`;

  const weight = 5;
  const transfer = 30;
  const full_price = 10000;

  const context = {
        WEIGHT_KG: weight,
        TRANSFER_PRICE_KG: transfer,
        FULL_PRICE: full_price
    };

  const expected_tax = weight * transfer + (full_price * 0.01);
  const tax_rule_str = evalFormula(tax_rule, context);

  const rule_obj = JSON.parse(tax_rule_str);

  const tax = Function(`"use strict"; return (${rule_obj.tax});`)();

  if (expected_tax !== tax){
    throw new Error(`Test failed. Expected ${expected}, got >>>> ${tax}`);
  }
  console.log(`✅ ${getCallerFunctionName()} Test passed`);
}