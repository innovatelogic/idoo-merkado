
//----------------------------------------------------------------------------------------------
//
//----------------------------------------------------------------------------------------------
function getAllItems(table_name = 'Articuls') {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(table_name);
  if (!sh) throw new Error('Sheet "${table_name}" not found!');

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  // A–K → 11 columns
  const data = sh.getRange(2, 1, lastRow - 1, 11).getValues();

  const items = [];

  data.forEach(row => {
    const id = row[1];               // B
    const name = row[2];             // C
    const bare_price = row[6];       // G
    const default_price = row[8]     // I
    const priceRuleRaw = row[9];     // J
    const count_available = row[10]; // K

    let price_rule = null;

    if (priceRuleRaw && typeof priceRuleRaw === "string") {
      try {
        price_rule = JSON.parse(priceRuleRaw);
      } catch (e) {
        price_rule = null;
      }
    }

    if (id && name) {
      items.push({
        id,
        name,
        bare_price,
        default_price,
        price_rule,
        count_available,
        label: `${name} (${id}) ${bare_price}`
      });
    }
  });

  return items;
}

//----------------------------------------------------------------------------------------------
// Update counts
//----------------------------------------------------------------------------------------------
function updateArticulCounts(positions)
{
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Articuls');
  if (!sh) throw new Error('Sheet "Articuls" not found!');

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  // Read all IDs (column B) and counts (column K)
  const data = sh.getRange(2, 2, lastRow - 1, 10).getValues(); // B-K → 10 columns

  const idIndex = 0;          // B → ID
  const countIndex = 9;       // K → count_available

  // Create a map of ID → row index in sheet
  const idRowMap = {};
  data.forEach((row, i) => {
    if (row[idIndex]) idRowMap[row[idIndex]] = i;
  });

   // Update counts in memory
  positions.forEach(pos => {
    const rowIndex = idRowMap[pos.item_id];
    if (rowIndex !== undefined) {
      const currentCount = data[rowIndex][countIndex];
      if (typeof currentCount === "number" && typeof pos.count === "number") {
        data[rowIndex][countIndex] = currentCount - pos.count;
      }
    }
  });

  // Write updated counts back to sheet
  const countRange = sh.getRange(2, 11, lastRow - 1, 1); // column K
  const updatedCounts = data.map(row => [row[countIndex]]);
  countRange.setValues(updatedCounts);
}

