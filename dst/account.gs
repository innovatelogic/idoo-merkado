class Account {
  constructor(context){
    this._name = context.name;
    this._bucket = context.bucket;
    this._card = context.card;
    this._tax_rule = context.tax_rule;
  }

  static fromRow(row, headers) {
    return new Account({
      name: row[headers['Name']],
      bucket: row[headers['Bucket']],
      card: row[headers['Card']],
      tax_rule: row[headers['Tax Rule']]
    });
  }
}

//----------------------------------------------------------------------------------------------
class AccountService {
  constructor(gateway) {
    this.gateway = gateway;
  }
  getAccounts() {
    return this.gateway.load('Accounts_v2');
  }
}

//----------------------------------------------------------------------------------------------
globalThis.AccountSheetGateway =
class AccountSheetGateway extends globalThis.SheetGateway {
  constructor(spreadsheet) {
    super(spreadsheet);
  }
  loadTable(tableName) {
    const sheet = this.getSheet(tableName);
    const rows = this.getData(sheet);
    const headers = getColumnIndexes(tableName);

    return { headers, rows };
  }
};

//----------------------------------------------------------------------------------------------
function deserialize_accounts_test(tableName = 'Accounts_v2') {
  const gateway = new AccountSheetGateway();
  const { headers, rows } = gateway.loadTable(tableName);
  return rows.map(row => Account.fromRow(row, headers));
}

//----------------------------------------------------------------------------------------------
function test_run_accounts() {
  const accounts = deserialize_accounts_test();
  Logger.log(accounts);
  return accounts;
}

//----------------------------------------------------------------------------------------------
function _deserialize_accounts(ss) { // table_name = 'Accounts_v2'

  if (!ss) {
    throw new Error(`[_deserialize_accounts] invalid input param ss`);
  }

  const table_name = 'Accounts_v2';
  const sh = ss.getSheetByName(table_name);
  if (!sh) {
    throw new Error(`[_deserialize_accounts] sheet "${table_name}" not found in spreadsheet`)
  }   

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];

  const headers = get_table_header_map_sheet(sh);
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
//
//----------------------------------------------------------------------------------------------
function _get_account_buckets(ss) // table_name = "Accounts_v2"
{
  if (!ss) {
    throw new Error(`[_get_account_buckets] invalid input param ss`);
  }

  const accounts = _deserialize_accounts(ss);

  const buckets = new Map();

  accounts.forEach(a => {
    if (!buckets.has(a._bucket)) { buckets.set(a._bucket, []); }
    buckets.get(a._bucket).push(a);
  });
  return buckets;
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
  const tax_rule_str = IdM.IdM_eval_formula(tax_rule, context);

  const rule_obj = JSON.parse(tax_rule_str);

  const tax = Function(`"use strict"; return (${rule_obj.tax});`)();

  if (expected_tax !== tax){
    throw new Error(`Test failed. Expected ${expected}, got >>>> ${tax}`);
  }
  console.log(`✅ ${getCallerFunctionName()} Test passed`);
}

class MockAccountSheetGateway {
  loadTable(tableName) {
    return {
      headers: {
        Name: 0,
        Bucket: 1,
        Card: 2,
        'Tax Rule': 3
      },
      rows: [
        ['John', 'Main', 'Visa', 'Rule1'],
        ['Jane', 'Savings', 'MC', 'Rule2']
      ]
    };
  }
}

function deserialize_accounts_test_mock(tableName = 'Accounts_v2') {
  const gateway = new MockAccountSheetGateway();
  const { headers, rows } = gateway.loadTable(tableName);
  const accounts = rows.map(row => Account.fromRow(row, headers));
  return accounts;
}

function test_mock_accounts() {
  const accounts = deserialize_accounts_test_mock();
  Logger.log(accounts);
  return accounts;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { deserialize_accounts,
                       _get_account_buckets,
                       _deserialize_accounts
                    };
}