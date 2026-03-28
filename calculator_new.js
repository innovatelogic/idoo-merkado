
function show_calculation_form_new()
{
  // Pass JSON to HTML
  const html = HtmlService.createTemplateFromFile("order_processor");

  const output = html.evaluate().setWidth(1200).setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(output, "Order Calculation");
}

function get_order_tables() { return ["Orders_v2", "Orders New"]; }

//----------------------------------------------------------------------------------------------
// Prepare calculation info
//----------------------------------------------------------------------------------------------
function prepare_calculation_info(table_name = "Orders_v2") {

  const all_orders = deserialize_orders(table_name);
  const closed_orders = get_processed_orders();

  //console.log(all_orders);
  //console.log(closed_orders);

  const canseled_buckets = new Map();

  // --- Remove matching orders from backets ---
  for (const [key, obj] of all_orders.entries()) {
    if (!obj || !obj.orders) continue;

    // orders is OBJECT { orderId: [rows] }
    if (typeof obj.orders === "object" && !Array.isArray(obj.orders)) {
      for (const orderId of Object.keys(obj.orders)) {

        const orderArray = obj.orders[orderId]; // this is an array of elements
        const hasCanceled = orderArray.some(el => (el.status || "").trim() === "Відмінено");

        if (hasCanceled){
          if (!canseled_buckets.has(key)){
            canseled_buckets.set(key, {orders: {}});
          }

          const bucket = canseled_buckets.get(key);
          bucket.orders[orderId] = orderArray;
          
          delete obj.orders[orderId];
          continue;
        }

        if (closed_orders.has(orderId)) {
          delete obj.orders[orderId];
          continue;
        }
      }
    }
  }

  return {
          open: Object.fromEntries(all_orders),
          cancelled: Object.fromEntries(canseled_buckets),
          closed: Array.from(closed_orders)
        };
}

//----------------------------------------------------------------------------------------------
function deserialize_orders(table_name = "Orders_v2")
{
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(table_name);
  if (!sh) throw new Error(`[deserialize_orders] Sheet "${table_name}" not found!`);

  let buckets = get_account_buckets();

  if (!buckets || buckets.size === 0) {
    SpreadsheetApp.getUi().alert("[deserialize_orders] No account backets found: exit");
    return;
  }

  // Convert backets map values into structured objects
  for (const [key, old_val] of buckets.entries()) {
    buckets.set(key, {
      accounts: old_val,  // assumed array
      orders: {},          // object: order_id -> array of rows
    });
  }

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];

  const headers = getColumnIndexes(table_name);
  const data = sh.getRange(2, 1, lastRow - 1, lastCol)
                  .getValues()
                  .filter(row => row.some(cell => cell !== '' && cell !== null));

  let order_is_valid = true;

  let order_batch_id = null;
  let order_batch_account = null;

  data.forEach(row => {

    const order_id = row[headers['ID']];
    if (!order_id) {
      return;
    }

    const account_id = row[headers['Оплата']];
    if (!account_id) {
      SpreadsheetApp.getUi().alert("[deserialize_orders] No account information in order: " + order_id + ". exit");
      order_is_valid = false;
      return;
    }

    let key_bucket = null;

    // find matching bucket
    for (const [key, val] of buckets.entries()) {
      if (val.accounts.some(acc => acc._name === account_id)) {
        key_bucket = key;
        break;
      }
    }

    if (key_bucket === null) {
      SpreadsheetApp.getUi().alert("[deserialize_orders] No valid account found for: " + account_id + ". exit");
      order_is_valid = false;
      return;
    }

    const bucket_obj = buckets.get(key_bucket);

    const row_values = {
      order_id: row[headers['ID']],
      articul: row[headers['Артикул']],
      account: row[headers['Оплата']],
      status: row[headers['Статус']],
      total: row[headers['Ціна позиції']],
      base: row[headers['База']],
      profit: row[headers['Прибуток']],
    };

    if (order_id !== row_values.order_id) {
      
      order_is_valid = false;
      return;
    }

    if (!bucket_obj.orders[order_id]) {
      bucket_obj.orders[order_id] = [];
      order_batch_id = order_id;
      order_batch_account = account_id;
    }

    if (order_batch_id != order_id){
      SpreadsheetApp.getUi().alert("[deserialize_orders] order_id mismatch: " + order_id + "!=" + order_batch_id + ". exit");
      order_is_valid = false;
      return;
    }

    if (order_batch_account != account_id) {
      SpreadsheetApp.getUi().alert("[deserialize_orders] account mismatch: " + account_id + "!=" + order_batch_account + ". exit");
      order_is_valid = false;
      return;
    }

    bucket_obj.orders[order_id].push(row_values);
  });

  return buckets;
}

//----------------------------------------------------------------------------------------------
// function get_processed_orders returns a set of processed order ID's
function get_processed_orders(table_name = "Processing") {
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(table_name);
  if (!sh) {
    throw new Error("Sheet 'Processing' not found");
  }

  const processed = new Set();

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return processed;

  const height = lastRow - 1;
  const data = sh.getRange(2, 2, height, 1).getValues();

  // --- Parse IDs from column B ---
  data.forEach(row => {
    const cell = row[0];
    if (!cell) return;

    const lines = cell.toString().split(/\r?\n/);
    lines.forEach(line => {
      line.split(',').forEach(part => {
        let id = (part || "").trim();
        if (id.endsWith(",")) id = id.slice(0, -1).trim();
        if (id !== "") processed.add(id);
      });
    });
  });

  return processed;
}
