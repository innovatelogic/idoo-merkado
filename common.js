function get_shop_name() { return "XBat" };
function get_company_name() { return "XBat.com.ua"; }
function get_company_url() { return "https://www.xbat.com.ua"; }

function get_currency(table_name = 'Kurs UAH')
{
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(table_name);
  if (!sh) throw new Error('[get_currency_uah] failed get sheet!');

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 2) return [];

  const headers = getColumnIndexes(table_name);

  const data = sh.getRange(2, 1, lastRow - 1, lastCol)
                  .getValues()
                  .filter(row => row.some(cell => cell !== '' && cell !== null));

  const currency = {};

  data.forEach(row => {
    try {
      currency[row[headers['Currency']]] = row[headers['Value']];
    } catch (e) {
      Logger.log(`Row failed: ${e.message}`);
    }
  });
  return currency;
}



/**
 * Fixes invalid JSON where raw control characters (newline, tab, CR)
 * were inserted inside string values without proper escaping.
 *
 * IMPORTANT:
 * - Does NOT modify already valid escape sequences (\n, \", \\)
 * - Only converts illegal characters that break JSON.parse
 * - Safe to run before JSON.parse as a recovery step
 */
function fixBrokenJsonStrings(json) {
  let inString = false;   // Are we currently inside a "string" value
  let escaped = false;    // Was previous char a backslash (escape marker)
  let result = "";

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];

    // Toggle string mode when encountering an unescaped quote
    if (ch === '"' && !escaped) {
      inString = !inString;
      result += ch;
      continue;
    }

    // If we are inside a string, we must sanitize illegal raw characters
    if (inString) {

      // Replace raw newline with JSON-safe escaped newline
      if (ch === '\n') {
        result += '\\n';
        continue;
      }

      // Remove carriage return (Windows CRLF safety)
      if (ch === '\r') {
        continue;
      }

      // Replace raw tab with escaped tab
      if (ch === '\t') {
        result += '\\t';
        continue;
      }
    }

    // Track escape sequences so we don't misinterpret \" as string end
    if (ch === '\\' && !escaped) {
      escaped = true;     // Next char is escaped
    } else {
      escaped = false;
    }

    result += ch;
  }

  return result;
}

//----------------------------------------------------------------------------------------------
// Evaluate formula
//----------------------------------------------------------------------------------------------
function evalFormula(str, context, forceStringMode = false) {

  // -----------------------------------------------------
  // FORCE STRING MODE for HTML / CDATA / multiline text
  // -----------------------------------------------------
  if (forceStringMode) {
    return str.replace(/\$\{([^}:]+)(?::(number|int|float|string))?\}/g, (_, name) => {
      if (context[name] === undefined) throw new Error(`Unknown variable ${name}`);
      return context[name];
    });
  }
  
  let expr = str;

  const hasVar = /\$\(|\$\{[^}]+\}/.test(str);
  const hasMathFunc = /\b(?:ceil|floor|round|min|max|abs|round5|ceil5)\b/.test(str);
  const hasTernary = /\?/.test(str);
  const hasCompare = /(>=|<=|==|>|<)/.test(str);
  const startsWithIf = /^\s*if\s*\(/.test(str);

  const isExpression = hasVar && (hasMathFunc || hasTernary || hasCompare || startsWithIf);

  // =====================================================
  // STRING MODE (template replacement only)
  // =====================================================
  if (!isExpression) {
   
    const fullMatch = str.match(/^\$\{([^}:]+)(?::(number|int|float|string))?\}$/);

    // Case: string is ONLY a single template → return typed value
    if (fullMatch) {
      const [, name, type] = fullMatch;

      if (context[name] === undefined) {
        throw new Error(`Unknown variable ${name}`);
      }

      let val = context[name];

      switch (type) {
        case "number":
        case "float":
          val = Number(val);
          if (Number.isNaN(val)) throw new Error(`Variable ${name} is not a number`);
          return val;

        case "int":
          val = parseInt(val, 10);
          if (Number.isNaN(val)) throw new Error(`Variable ${name} is not an int`);
          return val;

        case "string":
          return String(val);

        default:
          return val;
      }
    }

    // Otherwise, it's part of a larger string → keep string behavior
    return str.replace(/\$\{([^}:]+)(?::(number|int|float|string))?\}/g, (_, name) => {
      if (context[name] === undefined) {
        throw new Error(`Unknown variable ${name}`);
      }
      return context[name];
    });
  }

  // =====================================================
  // EXPRESSION MODE
  // =====================================================

  // $(VAR[:type]) → typed JS literal
  expr = expr.replace(/\$\(([^):]+)(?::(number|int|float|string))?\)/g, (_, name, type) => {
    if (context[name] === undefined) {
      throw new Error(`Unknown variable ${name}`);
    }

    let val = context[name];

    switch (type) {
      case "number":
      case "float":
        val = Number(val);
        if (Number.isNaN(val)) throw new Error(`Variable ${name} is not a number`);
        return val;

      case "int":
        val = parseInt(val, 10);
        if (Number.isNaN(val)) throw new Error(`Variable ${name} is not an int`);
        return val;

      case "string":
        return JSON.stringify(String(val));

      default:
        if (typeof val === "number") return val;
        if (!isNaN(val) && val !== "") return Number(val);
        return JSON.stringify(val);
    }
  });

  // ${VAR[:type]} inside expression → always JS literal
  expr = expr.replace(/\$\{([^}:]+)(?::(number|int|float|string))?\}/g, (_, name, type) => {
    if (context[name] === undefined) {
      throw new Error(`Unknown variable ${name}`);
    }

    let val = context[name];

    switch (type) {
      case "number":
      case "float":
        val = Number(val);
        if (Number.isNaN(val)) throw new Error(`Variable ${name} is not a number`);
        return val;

      case "int":
        val = parseInt(val, 10);
        if (Number.isNaN(val)) throw new Error(`Variable ${name} is not an int`);
        return val;

      case "string":
        return JSON.stringify(String(val));

      default:
        return JSON.stringify(val);
    }
  });

  // normalize "if (cond) ? a : b"
  expr = expr.replace(/^if\s*\(/, '(');

  try {
    const helpers = {
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      min: Math.min,
      max: Math.max,
      abs: Math.abs,
      round5: (v) => Math.round(v / 5) * 5,
      ceil5: (v) => Math.ceil(v / 5) * 5
    };

    const fn = new Function(...Object.keys(helpers), `return ${expr};`);
    return fn(...Object.values(helpers));

  } catch (e) {
    console.error("Formula error:", expr, e);
    return str;
  }
}

//----------------------------------------------------------------------------------------------
// Apply export rules to XML string
//----------------------------------------------------------------------------------------------
function applyExportRulesXML(xmlString, context) {
  const doc = XmlService.parse(xmlString);
  const root = doc.getRootElement();

  walkXmlNode(root, context);

  return XmlService.getPrettyFormat().format(doc);
}

//----------------------------------------------------------------------------------------------
function build_xml_tree(xml_node, context) {
  if (!xml_node) { return; }
  
  walkXmlNode(xml_node, context);
}

//----------------------------------------------------------------------------------------------
// Build context recursively
// returns new context
//----------------------------------------------------------------------------------------------
function build_node(node, context){
  let new_context = { ... context};
  if (!node){ return new_context; }

  build_xml_node(node, context);
  new_context[node.getName()] = node.getValue();
  return new_context;
}

//----------------------------------------------------------------------------------------------
// Build xml node
//----------------------------------------------------------------------------------------------
function build_xml_node(node, context) {
  // ---------- Attributes ----------
  const attrs = node.getAttributes();
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    const value = attr.getValue();

    if (typeof value === "string" && value.includes("$")) {
      const newVal = evalFormula(value, context);
      attr.setValue(String(newVal));
    }
  }

  // ---------- Text / CDATA ----------
  const text = node.getText();
  if (text && text.includes("$")) {
    // Check if node has cdata attribute
    if (node.getAttribute("cdata") && node.getAttribute("cdata").getValue() === "true") {

      const newText = evalFormula(text, context, true);

      // Remove all current children (including old CDATA)
      node.getChildren().forEach(c => node.removeContent(c));
      // Clear old text
      node.setText(""); 
      // Add new CDATA node
      const cdataNode = XmlService.createCdata(newText);
      node.addContent(cdataNode);
    } else {
      // Regular text replacement
      const newText = evalFormula(text, context);
      node.setText(newText);
    }
  }
}

//----------------------------------------------------------------------------------------------
// Walk XML DOM
//----------------------------------------------------------------------------------------------
function walkXmlNode(node, context) {

  build_xml_node(node, context);

  // ---------- Child elements ----------
  const children = node.getChildren();
  for (let i = 0; i < children.length; i++) {
    walkXmlNode(children[i], context);
  }
}

//----------------------------------------------------------------------------------------------
// Walk XML DOM
//----------------------------------------------------------------------------------------------
function equal_xml(actual, expected) {
  const a = XmlService.getCompactFormat()
    .format(XmlService.parse(actual));
  const b = XmlService.getCompactFormat()
    .format(XmlService.parse(expected));

  return a === b;
}

//----------------------------------------------------------------------------------------------
// Clone recursively
//----------------------------------------------------------------------------------------------
function cloneXmlElement(element) {
  const ns = element.getNamespace();
  const clone = XmlService.createElement(element.getName(), ns);

  // Copy attributes
  element.getAttributes().forEach(attr => {
    clone.setAttribute(attr.getName(), attr.getValue());
  });

  // Copy children recursively
  element.getChildren().forEach(child => {
    clone.addContent(cloneXmlElement(child));
  });

  // Copy text nodes
  const text = element.getText(); // get text
  if (text && text.trim() !== "") {
     const useCdata = element.getAttribute("cdata")?.getValue() === "true";
    if (useCdata) {
      clone.addContent(XmlService.createCdata(text));
    } else {
      clone.setText(text);
    }
  }

  return clone;
}

//----------------------------------------------------------------------------------------------
function writeRange(table_name, values, startRow, startCol, textColors, backgroundColors) {
  const default_black = "#000000";
  const default_white = "#ffffff";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(table_name);

  if (!sheet) {
    sheet = ss.insertSheet(table_name);
  }

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

//----------------------------------------------------------------------------------------------
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

//----------------------------------------------------------------------------------------------
function add_xml_node_text(parent, tag, text) {
  const el = XmlService.createElement(tag);
  if (text) el.setText(text);
  parent.addContent(el);
  return el;
}
