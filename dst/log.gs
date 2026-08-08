//----------------------------------------------------------------------------------------------
function write_range(sheet, values, startRow, startCol, textColors, backgroundColors) {
  const default_black = "#000000";
  const default_white = "#ffffff";

  const numRows = values.length;
  const numCols = values[0].length;

  const range = sheet.getRange(startRow, startCol, numRows, numCols);

  range.setValues(values);

  // ---------- TEXT COLOR ----------
  if (textColors) {
    if (Array.isArray(textColors)) {
      // 2D array
      range.setFontColors(textColors);
    } else {
      // Single color → expand to matrix
      const matrix = Array.from({ length: numRows }, () =>
        Array(numCols).fill(textColors)
      );
      range.setFontColors(matrix);
    }
  } else {
    const matrix = Array.from({ length: numRows }, () =>
      Array(numCols).fill(default_black)
    );
    range.setFontColors(matrix);
  }

  // ---------- BACKGROUND ----------
  if (backgroundColors) {
    if (Array.isArray(backgroundColors)) {
      range.setBackgrounds(backgroundColors);
    } else {
      const matrix = Array.from({ length: numRows }, () =>
        Array(numCols).fill(backgroundColors)
      );
      range.setBackgrounds(matrix);
    }
  } else {
    const matrix = Array.from({ length: numRows }, () =>
      Array(numCols).fill(default_white)
    );
    range.setBackgrounds(matrix);
  }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { write_range };
}