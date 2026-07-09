function get_table_header_map_sheet(sh, base = 0) {
  if (!sh) { throw new Error(`[get_table_header_map_sheet] Sheet not found!`); }

  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  const columns = {};
  headers.forEach((name, i) => columns[name] = i + base);
  return columns;
}