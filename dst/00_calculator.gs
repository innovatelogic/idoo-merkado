//----------------------------------------------------------------------------------------------
function _deserialize_orders(sh) //table_name = "Orders_v2"
{
  if (!sh) { 
    throw new Error(`[deserialize_orders] input param sh is null`);
  }

  let buckets = _get_account_buckets(sh.getParent());

  if (!buckets || buckets.size === 0) {
    SpreadsheetApp.getUi().alert("[deserialize_orders] No account backets found: exit");
    return;
  }

  // Convert backets map values into structured objects
  for (const [key, old_val] of buckets.entries()) {
    buckets.set(key, {
      accounts: old_val,  // assumed array
      orders: {},         // object: order_id -> array of rows
    });
  }

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];

  //const headers = getColumnIndexes(table_name);
  const headers = get_table_header_map_sheet(sh);

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
function _get_processed_orders(sh) { // table_name = "Processing"
  
  if (!sh) {
    throw new Error("[get_processed_orders] Input param not found");
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

//----------------------------------------------------------------------------------------------
function _prepare_calculation_info(table_name = "Orders_v2") {

  const curr_user = get_current_user();
  if (!curr_user || !curr_user.has_role(UserRole.ACCOUNTANT | UserRole.OWNER)) {
    return null;
  }

  const orders_table_name = "Orders_v2";
  const sh_ord = curr_user.sheet(orders_table_name);
  if (sh_ord === null) { 
    throw new Error(`[prepare_calculation_info]: User db "${orders_table_name}" not found`); 
  }
  
  const process_table_name = "Processing";
  const sh_proc = curr_user.sheet(process_table_name);
  if (sh_proc === null) { 
    throw new Error(`[prepare_calculation_info]: User db "${process_table_name}" not found`);
  }

  const all_orders = _deserialize_orders(sh_ord);
  const closed_orders = _get_processed_orders(sh_proc);

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
function on_complete_calculate_operation(backets) {

  const curr_user = get_current_user();
  if (!curr_user || !curr_user.has_role(UserRole.ACCOUNTANT | UserRole.OWNER)) {
    return "User policy restricted";
  }

  if (!backets || typeof backets !== "object") {
    throw new Error("[onCompleteCalculateOperation] invalid input data");
  }

  const table_name = "Orders_v2";
  const sh = curr_user.sheet(table_name);
  if (!sh) { 
    throw new Error(`Sheet "${table_name}" not found!`);
  }

  const headers = get_table_header_map_sheet(sh);

  const filter = sh.getFilter();
  if (filter) filter.remove();

  const lastRow = sh.getLastRow();

  if (lastRow < 2) { return "No orders to update"; }

  if (!headers['ID']) { return "Failed to get ID in headers"; }

  // Read order IDs
  const orderIds = sh.getRange(2, headers['ID'] + 1, lastRow - 1, 1).getValues(); 

  // Collect orders to process
  const ordersToProcess = new Set();
  for (const backetKey in backets) {
    const backet = backets[backetKey];
    if (!Object.hasOwn(backet, 'orders')) return "no bucket";

    for (const orderId in backet.orders) {
      ordersToProcess.add(String(orderId));
    }
  }

  let updatedCount = 0;

  for (let i = 0; i < orderIds.length; i++) {
    const orderId = String(orderIds[i][0]).trim(); // normalize

    if (!orderId || !ordersToProcess.has(orderId)) continue; // skip spacer / empty rows

    const row_index = i + 2;
    sh.getRange(row_index, headers['Статус'] + 1).setValue("Розраховано");
    sh.getRange(row_index, 1, 1, sh.getLastColumn()).setBackground("#73716b");
    
    updatedCount++;
  }

  return `Processed ${updatedCount} order rows in ` + table_name;
}

//----------------------------------------------------------------------------------------------
function on_сalculation_сonfirmed(backets) {

  const curr_user = get_current_user();
  if (!curr_user || !curr_user.has_role(UserRole.ACCOUNTANT | UserRole.OWNER)) {
    return "[on_сalculation_сonfirmed] User policy restricted";
  }

  if (backets === null){
    throw new Error("[on_сalculation_сonfirmed] Invalid input data");
  }

  const table_name = "Processing";
  //const ss = SpreadsheetApp.getActiveSpreadsheet();
  //const sh = ss.getSheetByName("Processing");
  const sh = curr_user.sheet(table_name);
  if (!sh) { 
    throw new Error("[on_сalculation_сonfirmed] Sheet not found");
  }

  // Remove filter if it exists
  const filter = sh.getFilter();
  if (filter) filter.remove();

  const timestamp = new Date();

  for (const backetKey in backets) {
    const backet = backets[backetKey];

    let orders_list = "";
    for (const orderId in backet.orders) {
      orders_list += orderId + ",\n";
    }

    const row_values = [
      timestamp,
      orders_list,
      backet.accounts.join(",\n"),
      backet.total,
      backet.base,
      backet.profit,
      backet.profit/2,
      'Створено'
    ];

    sh.appendRow(row_values);
  }

  return "Calculation added successfully!";
}

//----------------------------------------------------------------------------------------------
if (typeof module !== "undefined" && module.exports) {
    module.exports = { _deserialize_orders,
                       _get_processed_orders,
                       _prepare_calculation_info,
                       on_complete_calculate_operation,
                       on_сalculation_сonfirmed
                      };
}
