
//let IdM_eval_formula;
//let applyExportRules;
//let applyExportRulesXML;

if (typeof module !== "undefined" && module.exports) {
  //({ IdM_eval_formula } = require("./formula.gs"));
  //({ applyExportRules, applyExportRulesXML } = require("./xml_utils.gs"));
}

class Articul {
  constructor(context){
    this._offer_id = context.offer_id;
    this._brand = context.brand;
    this._name = context.name;
    this._market_name = context.market_name;
    this._condition = context.condition;
    this._available = context.available;
    this._bare_price = context.bare_price;
    this._sell_price = context.sell_price;
    this._sell_price_ua = context.sell_price_ua;
    this._sell_price_pl = context.sell_price_pl;
    this._count = context.count;
    this._type = context.type;
    this._weight = context.weight;
    this._export_rules_raw = context.export_rules_raw;
    this._price_rules_raw = context.price_rules_raw;
    this._images_raw = context.images_raw;

    this._images = context.images_raw ? context.images_raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
    this._price_rules = this.get_price_rules();
  }

  //----------------------------------------------------------------------------------------------
  get_context() {
    const context = {
        OFFER_ID: this._offer_id,
        BRAND: this._brand,
        NAME: this._name,
        MARKET_NAME: this._market_name,
        CONDITION: this._condition,
        AVAILABLE: this._available,
        SELL_PRICE: this._sell_price,
        SELL_PRICE_UA: this._sell_price_ua,
        SELL_PRICE_PL: this._sell_price_pl,
        COUNT: this._count,
        WEIGHT: this._weight,
        TYPE: this._type
    };

    this._images.forEach((img, i) => {
      context[`IMG_${i}`] = img;
    });
    return context;
  }

  //----------------------------------------------------------------------------------------------
  update_price_rules(){
    this._price_rules = get_price_rules();
  }

  //----------------------------------------------------------------------------------------------
  get_export_rules() {
    let context = this.get_context();
    const price_rules = this.get_price_rules();

    price_rules.forEach((rule, i) =>{
      context[`RULE_MIN_${i}`] = rule.min;
      context[`RULE_MAX_${i}`] = rule.max;
      context[`RULE_PRICE_${i}`] = rule.price;
    });

    let export_rules_xml = null;
    if (this._export_rules_raw && typeof this._export_rules_raw === "string") {
        export_rules_xml = applyExportRulesXML(this._export_rules_raw, context);
    }
    return export_rules_xml;
  }

  //----------------------------------------------------------------------------------------------
  get_price_rules() {
    let price_rules = null;
    if (this._price_rules_raw && typeof this._price_rules_raw === "string") {
        const json = JSON.parse(this._price_rules_raw);
        price_rules = applyExportRules(json, this.get_context());
    }
    return price_rules;
  }
}

//----------------------------------------------------------------------------------------------
function deserialize_articuls(table_name = 'Articuls_v2') {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(table_name);
  if (!sh) { 
    throw new Error(`Sheet "${table_name}" not found!`);
  }
  
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];

  const headers = getColumnIndexes(table_name);
  const data = sh.getRange(2, 1, lastRow - 1, lastCol)
                  .getValues()
                  .filter(row => row.some(cell => cell !== '' && cell !== null));

  const articuls = [];

  data.forEach(row => {

    const price_rule_ua = row[headers['Price rule(UA)']];
    const price_rule_pl = row[headers['Price rule(PL)']];

    try {
      const context = {
        offer_id: row[headers['offer_id']],
        brand: row[headers['Brand']],
        name: row[headers['Name']],
        market_name: row[headers['Market Name']],
        condition: row[headers['Condition']],
        available: row[headers['Available']],
        bare_price: row[headers['Ціна поставки (UAH)']],
        sell_price: row[headers['Sell Price (UA)']],
        sell_price_ua: row[headers['Sell Price (UA)']],
        sell_price_pl: row[headers['Sell Price (PL)']],
        count: row[headers['Count']],
        weight: row[headers['Weight (gr)']] / 1000,
        type: row[headers['Type']],
        images_raw : row[headers['Images']],
        export_rules_raw : row[headers['Export Rules']],
        price_rules_raw: row[headers['Price rule(UA)']],   // default UA price rule
        price_rules_UA_raw: row[headers['Price rule(UA)']],
        price_rules_PL_raw: row[headers['Price rule(PL)']],
      };

      articuls.push(new Articul(context));

    } catch (e) {
      Logger.log(`Row failed: ${e.message}`);
    }
  });

  return articuls;
}

if (typeof module !== "undefined" && module.exports) {
    //module.exports = { Articul, deserialize_articuls };
}