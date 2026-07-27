//----------------------------------------------------------------------------------------------
function is_base(articul){
  articul = String(articul);
  return !articul.includes('-');
}

//----------------------------------------------------------------------------------------------
// Add order with multiple positions
//----------------------------------------------------------------------------------------------
function add_order(ss, data) {

  const table_name = 'Orders_v2';

  let orderSheet = ss.getSheetByName(table_name);

  if (!orderSheet) {
    throw new Error('[add_order] Sheet not found!');
  }

  const headers = get_table_header_map_sheet(orderSheet, 1);
  
  const { client_info, payment, notes, total_price, positions } = data;

  const timestamp = new Date();
  
  const order_id = 'ORD-' + timestamp.getTime();

  // Remove filter if it exists
  const filter = orderSheet.getFilter();
  if (filter) { filter.remove(); }

  const last = orderSheet.getLastRow();
  
  // Insert one row per item position
  positions.forEach((pos, index) => {

    const row_values = [
      timestamp,
      order_id,
      pos.offer_id,
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

  orderSheet.getRange(sumRow, headers['Загальна Ціна']).setValue(total_price);

  // color whole row
  orderSheet.getRange(sumRow, 1, 1, cols)
            .setBackground("#8192d4");

  // optional: thinner row
  orderSheet.setRowHeight(sumRow, 14);
  
  let sh_articuls = ss.getSheetByName('Articuls_v2');
  update_articuls_counts(sh_articuls, positions);

  return `Order ${order_id} added successfully! Total: ${total_price}`;
}
//----------------------------------------------------------------------------------------------
// Update counts
//----------------------------------------------------------------------------------------------
function update_articuls_counts(sh, positions)
{
  console.log("[update_articuls_counts] begin:");

  //const ss = SpreadsheetApp.getActiveSpreadsheet();
  //const sh = ss.getSheetByName(table_name);

  const headers = get_table_header_map_sheet(sh, 1);

  const col_offer_id = headers['offer_id'];
  const col_count = headers['Count'];

  const data = sh.getRange(2, col_offer_id, sh.getLastRow()-1, 1).getValues();

  const id_row_map = {};

  data.forEach((row, i) => {
    id_row_map[row[0]] = i + 2;
  });

  positions.forEach(p => {

    let row = null;
    let position_count = p.count;

    if (is_base(p.offer_id)) {
      row = id_row_map[p.offer_id];
    }
    else{
      let id_count = parse_articul(p.offer_id);
      if (id_count === null){
        console.log("[update_articuls_counts] Parse articul failed:" + p.offer_id);
        return;
      }
      row = id_row_map[id_count.base_id];
      position_count = position_count * id_count.count; 
    }

    //const row = id_row_map[p.offer_id];

    if (row) {
      const cell = sh.getRange(row, col_count);
      const current = cell.getValue();

      cell.setValue(current - position_count);
    }
  });
}

//----------------------------------------------------------------------------------------------
if (typeof module !== "undefined" && module.exports) {
    module.exports = { add_order,
                       UserRole,
                       get_current_user,
                       request_root_spreadsheet };
}