function get_table_header_map_sheet(sh, base = 0) {
  if (!sh) { throw new Error(`[get_table_header_map_sheet] Sheet not found!`); }

  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  const columns = {};
  headers.forEach((name, i) => columns[name] = i + base);
  return columns;
}

//----------------------------------------------------------------------------------------------
function get_table_row_map(sh) {
  
  if (!sh) throw new Error(`[get_table_row_map] error: "${table_name}" not found!`);

  const last_row = sh.getLastRow();
  if (last_row < 2) return {};

  const values = sh.getRange(2, 1, last_row - 1, 1).getValues();

  const rows = {};

  values.forEach((row, i) =>{
    const key = row[0];
    if (!key) return;

    rows[key] = i + 2;
  });
  return rows;
}