
//----------------------------------------------------------------------------------------------
//
//----------------------------------------------------------------------------------------------
function showCalculationForm() {
  const {new_backets, removed_orders} = PrepareCalculationInfo();
  if (new_backets === null || removed_orders === null) return;

  // Convert Map to plain object
  const backetsObj = Object.fromEntries(new_backets);
  const removedOrdersArray = Array.from(removed_orders);

  // Convert to JSON
  const backets_json = JSON.stringify(backetsObj);
  const removed_orders_json = JSON.stringify(removedOrdersArray);

  // Pass JSON to HTML
  const html = HtmlService.createTemplateFromFile("calculation");
  html.data = backets_json;
  html.removed_orders = removed_orders_json;

  const output = html.evaluate().setWidth(600).setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(output, "Order Calculation");
}

//----------------------------------------------------------------------------------------------
//
//----------------------------------------------------------------------------------------------
function showForm(resultText) {
  const html = HtmlService.createHtmlOutputFromFile("calculation")
        .setWidth(600)
        .setHeight(300);

  html.append(`<script>document.getElementById("result").innerText = ${JSON.stringify(resultText)};</script>`);

  SpreadsheetApp.getUi().showModalDialog(html, "Order Calculation");
}

//----------------------------------------------------------------------------------------------
//
//----------------------------------------------------------------------------------------------
function RemoveAlreadyCalculatedOrders(backets) {
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Processing");
  if (!sh) {
    throw new Error("Sheet 'Processing' not found");
  }

  const processingSet = new Set();
  const alreadyCalculatedSet = new Set();

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { new_backets: backets, removed_orders: alreadyCalculatedSet };

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
        if (id !== "") processingSet.add(id);
      });
    });
  });

  // --- Remove matching orders from backets ---
  for (const [key, obj] of backets.entries()) {
    if (!obj || !obj.orders) continue;

    // orders is OBJECT { orderId: [rows] }
    if (typeof obj.orders === "object" && !Array.isArray(obj.orders)) {
      for (const orderId of Object.keys(obj.orders)) {

        const orderArray = obj.orders[orderId]; // this is an array of elements
        const hasCanceled = orderArray.some(el => (el.status || "").trim() === "Відмінено");

        if (processingSet.has(orderId) || hasCanceled) {
          alreadyCalculatedSet.add(orderId);
          delete obj.orders[orderId];
        }
      }
    }

    backets.set(key, obj);
  }

  return { new_backets: backets, removed_orders: alreadyCalculatedSet };
}

//----------------------------------------------------------------------------------------------
// Prepare calculation info
//----------------------------------------------------------------------------------------------
function PrepareCalculationInfo() {

  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== "Orders New") {
    SpreadsheetApp.getUi().alert("Please open 'Orders New' sheet and select orders to calculate: exit");
    return;
  }

  const r = sheet.getActiveRange();
  if (!r) {
    SpreadsheetApp.getUi().alert("Please select some orders first: exit");
    return;
  }

  const start = r.getRow();
  const count = r.getNumRows();
  const allData = sheet.getDataRange().getValues();
  let backets = getAccountsBackets();  // MUST be Map

  if (!backets || backets.size === 0) {
    SpreadsheetApp.getUi().alert("No account backets found: exit");
    return;
  }

  // Convert backets map values into structured objects
  for (const [key, old_val] of backets.entries()) {
    backets.set(key, {
      accounts: old_val,  // assumed array
      orders: {},          // object: order_id -> array of rows
      total: 0,
      base : 0,
      profit : 0
    });
  }

  let order_is_valid = true;

  // Iterate selected rows
  for (let i = 0; i < count; i++) {
    const rowData = sheet.getRange(start + i, 1, 1, 13).getValues();

    rowData.forEach(row => {

      const order_id = row[1];
      if (!order_id) return;

      const account_id = row[8];
      if (!account_id) {
        SpreadsheetApp.getUi().alert("No account information in order: " + order_id + ". exit");
        order_is_valid = false;
        return;
      }

      let key_backet = null;

      // find matching backet
      for (const [key, val] of backets.entries()) {
        if (val.accounts.includes(account_id)) {
          key_backet = key;
          break;
        }
      }

      if (key_backet === null) {
        SpreadsheetApp.getUi().alert("No valid account found for: " + account_id + ". exit");
        order_is_valid = false;
        return;
      }

      const backet_obj = backets.get(key_backet);

      // skip if already added
      if (backet_obj.orders[order_id]) return;

      // get all rows belonging to this order
      const matchingRows = allData.filter(r => r[1] === order_id);

      let all_orders = [];

      matchingRows.forEach(mr => {

        const row_values = {
          order_id: mr[1],
          articul: mr[2],
          account: mr[8],
          status: mr[9],
          total: mr[10],
          base: mr[11],
          profit: mr[12],
          row_data: r
        };

        if (row_values.account !== account_id) {
          SpreadsheetApp.getUi().alert("Order account mismatch: " + order_id + ". exit");
          order_is_valid = false;
        }
        
        all_orders.push(row_values);
      });

      backet_obj.orders[order_id] = all_orders;
    });
  }

  if (!order_is_valid) {
    SpreadsheetApp.getUi().alert("Order validation failed. exit");
    return null;
  }

  const {new_backets, removed_orders} = RemoveAlreadyCalculatedOrders(backets);

  for (const [key, val] of new_backets.entries()) {
      // Remove empty backets
      if (Object.keys(val.orders).length === 0) {
        new_backets.delete(key);
        continue;
      }
  }

  for (const [key, val] of new_backets.entries()) {
    for (const orderId in val.orders) {
      const orderItems = val.orders[orderId];
      for (const item of orderItems) {
        val.total += item.total;
        val.base  += item.base;
        val.profit += item.profit;
      }
    }
  }
  return {new_backets, removed_orders};
}

