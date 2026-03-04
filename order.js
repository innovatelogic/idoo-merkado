
//----------------------------------------------------------------------------------------------
// Add order with multiple positions
//----------------------------------------------------------------------------------------------
function addOrder(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let orderSheet = ss.getSheetByName('Orders New');

  if (!orderSheet) throw new Error('Sheet "Orders New" not found!');

  const { client_info, payment, notes, total_price, positions } = data;

  const timestamp = new Date();
  
  const orderId = 'ORD-' + timestamp.getTime();

  // Remove filter if it exists
  const filter = orderSheet.getFilter();
  if (filter) filter.remove();

   const last = orderSheet.getLastRow();
  
  // Add a truly blank separation row IF there is at least 1 order already

  const writeCols = 13;

  // Insert one row per item position
  positions.forEach((pos, index) => {

    const row_values = [
      timestamp,
      orderId,
      pos.item_id,
      pos.item_name,
      pos.count,
      null,
      index === 0 ? client_info : "",
      index === 0 ? notes : "",
      payment,
      'Створено',
      pos.pos_price,
      pos.pos_price - pos.profit,
      pos.profit,
      pos.bare_price
    ];

    orderSheet.appendRow(row_values);
  });

  // ---------------------------------------------------------------
  // ADD SUMMARY ROW (total only in column F) + COLOR #8192d4
  // ---------------------------------------------------------------
  const lastRowBefore = orderSheet.getLastRow();

  // Insert new row AFTER the last row with order items
  orderSheet.insertRowAfter(lastRowBefore);

  const sumRow = lastRowBefore + 1;
  const cols = orderSheet.getLastColumn();

  // ensure row is empty
  orderSheet.getRange(sumRow, 1, 1, cols).clearContent().clearFormat();

  // write total into column F
  orderSheet.getRange(sumRow, 6).setValue(total_price);

  // color whole row
  orderSheet.getRange(sumRow, 1, 1, cols)
            .setBackground("#8192d4");

  // optional: thinner row
  orderSheet.setRowHeight(sumRow, 14);
  
  updateArticulCounts(positions);

  return `Order ${orderId} added successfully! Total: ${total_price}`;
}

//----------------------------------------------------------------------------------------------
// Add order with multiple positions
//----------------------------------------------------------------------------------------------
function add_order(table_name, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let orderSheet = ss.getSheetByName(table_name);
  if (!orderSheet) {
    throw new Error('[add_order] Sheet not found!');
  }

  const headers = getColumnIndexes(table_name);
  
  const { client_info, payment, notes, total_price, positions } = data;

  const timestamp = new Date();
  
  const order_id = 'ORD-' + timestamp.getTime();

  // Remove filter if it exists
  const filter = orderSheet.getFilter();
  if (filter) filter.remove();

  const last = orderSheet.getLastRow();
  
  // Insert one row per item position
  positions.forEach((pos, index) => {

    const row_values = [
      timestamp,
      order_id,
      pos.item_id,
      pos.item_name,
      pos.count,
      pos.bare_price,
      null,
      index === 0 ? client_info : "",
      index === 0 ? notes : "",
      payment,
      'Створено',
      pos.pos_price,
      pos.pos_price - pos.profit,
      pos.profit,
      pos.tax
    ];

    orderSheet.appendRow(row_values);
  });

  // ---------------------------------------------------------------
  // ADD SUMMARY ROW (total only in column F) + COLOR #8192d4
  // ---------------------------------------------------------------
  const lastRowBefore = orderSheet.getLastRow();

  // Insert new row AFTER the last row with order items
  orderSheet.insertRowAfter(lastRowBefore);

  const sumRow = lastRowBefore + 1;
  const cols = orderSheet.getLastColumn();

  // ensure row is empty
  orderSheet.getRange(sumRow, 1, 1, cols).clearContent().clearFormat();

  // write total into column F
  orderSheet.getRange(sumRow, headers['Загальна Ціна']).setValue(total_price);

  // color whole row
  orderSheet.getRange(sumRow, 1, 1, cols)
            .setBackground("#8192d4");

  // optional: thinner row
  orderSheet.setRowHeight(sumRow, 14);
  
  //updateArticulCounts(positions);

  return `Order ${order_id} added successfully! Total: ${total_price}`;
}