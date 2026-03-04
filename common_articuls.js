
//----------------------------------------------------------------------------------------------
// iterate through nodes
//----------------------------------------------------------------------------------------------
function walk(node, context) {
  if (Array.isArray(node)) {
    return node.map(n => walk(n, context));
  }

  if (node && typeof node === "object") {
    const result = {};
    for (const key in node) {
      result[key] = walk(node[key], context);
    }
    return result;
  }

  if (typeof node === "string") {
    return evalFormula(node, context);
  }
  return node;
}
//----------------------------------------------------------------------------------------------
// 
//----------------------------------------------------------------------------------------------
function applyExportRules(obj, context) {
  return walk(obj, context);
}

//----------------------------------------------------------------------------------------------
// Update counts
//----------------------------------------------------------------------------------------------
function get_all_items_v2(table_name = 'TEST_ArticulsUA') {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(table_name);
  if (!sh) throw new Error('Sheet "${table_name}" not found!');

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  const headers = getColumnIndexes(table_name);

  if (lastRow < 2) return [];

  // A–K → 11 columns
  const data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const items = [];

  data.forEach(row => {
    const offer_id  = row[headers['offer_id']];
    const brand     = row[headers['Brand']];
    const name      = row[headers['Name']];
    const condition = row[headers['Condition']];
    const available  = row[headers['Available']];

    const bare_price = row[headers['Ціна поставки (UAH)']];
    const sell_price = row[headers['Sell Price (UAH)']];
    const price_rule_raw = row[headers['Price rule']];

    const weight = row[headers['Weight (gr)']];
    const type = row[headers['Type']];

    const count = row[headers['Count']];
    //const export_rules_raw = row[headers['Export Rules']];
    const images_raw = row[headers['Images']];

    const export_rules_raw = row[headers['Export Rules']];

    const images = images_raw.split(/\r?\n/)
                      .map(s => s.trim())
                      .filter(Boolean); // remove empty lines

    const context = {
        OFFER_ID: offer_id,
        BRAND: brand,
        NAME: name,
        CONDITION: condition,
        AVAILABLE: available,
        SELL_PRICE: sell_price,
        COUNT: count,
        WEIGHT: weight,
        TYPE: type
    };

    images.forEach((img, i) => {
      context[`IMG_${i}`] = img;
    });

    let price_rule = null;

    if (price_rule_raw && typeof price_rule_raw === "string") {
      try {
        const json = JSON.parse(price_rule_raw);
        price_rule = applyExportRules(json, context);

        price_rule.forEach((rule, i) =>{
          context[`RULE_MIN_${i}`] = rule.min;
          context[`RULE_MAX_${i}`] = rule.max;
          context[`RULE_PRICE_${i}`] = rule.price;
        });
        //console.log(price_rule);
      } catch (e) {
        price_rule = null;
      }
    }

    

    let export_rules = null;
    if (export_rules_raw && typeof export_rules_raw === "string") {

      try {
        export_rules = applyExportRulesXML(export_rules_raw, context);
      } catch (e) {
        console.log("Failed:");
        exprt_rules = null;
      }
    }

    items.push({
        offer_id,
        name,
        bare_price,
        sell_price,
        price_rule,
        export_rules,
        count,
        label: `${name} (${offer_id}) ${bare_price}`
      });
  });

  return items;
}

function xmlToNormalizedString(xml) {
  const doc = XmlService.parse(xml);
  return XmlService.getCompactFormat().format(doc);
}

//----------------------------------------------------------------------------------------------
// Walk XML DOM
//----------------------------------------------------------------------------------------------
function TEST_applyExportRulesXML(){

    let context = {
        OFFER_ID: 1001,
        BRAND: "_BRAND_",
        NAME: "_NAME_",
        CONDITION: "NEW",
        AVAILABLE: "Available",
        SELL_PRICE: 101,
        COUNT: 500,
        IMG_0: "0.jpg",
        IMG_1: "1.jpg",
        IMG_2: "2.jpg",
        IMG_3: "3.jpg",
        IMG_4: "4.jpg",
        IMG_5: "5.jpg"
    };

    const price_rule_raw = `[{"min":1, "max":300, "price":"ceil5(\${SELL_PRICE} * 1.2)"},
                              {"min":300, "max":1000, "price":"ceil5(\${SELL_PRICE} * 1.15)"},
                              {"min":1000, "max":999999999, "price":"ceil5(\${SELL_PRICE} * 1.1)"}]`;

    const price_rule_json = JSON.parse(price_rule_raw);
    const price_rule = applyExportRules(price_rule_json, context);

    price_rule.forEach((rule, i) =>{
      context[`RULE_MIN_${i}`] = rule.min;
      context[`RULE_MAX_${i}`] = rule.max;
      context[`RULE_PRICE_${i}`] = rule.price;
    });

    const xml_raw = `<g:export xmlns:g="http://example.com/google">
                      <g:Prom>
                          <g:offer id="\${OFFER_ID}" available="(\${AVAILABLE} == 'Available') ? 'true' : 'false' " in_stock="(\${COUNT} > 0) ? 'in stock' : 'false'" selling_type="u">
                                <g:name>Акумулятор \${BRAND} \${NAME} (нові-депакет)</g:name>
                                <g:categoryId>0</g:categoryId>
                                <g:portal_category_id>1507</g:portal_category_id>
                                <g:price>ceil5($(SELL_PRICE) * 1.2)</g:price>
                                <g:currencyId>UAH</g:currencyId>
                                <g:quantity_in_stock>\${COUNT}</g:quantity_in_stock>
                                <g:keywords>Акумулятор, Li-Ion</g:keywords>
                                <g:description>Акумулятор - \${BRAND} M50LT 21700

                          Один із найкращих літій-іонних акумуляторів формату 21700 від південнокорейського гіганта \${BRAND}. Модель M50LT спеціально розроблена для пристроїв, що потребують високої ємності та тривалої автономної роботи. Ідеально підходить для електровелосипедів, самокатів, потужних ліхтарів, повербанків та електротранспорту.

                          Можлива оплата на рахунок ФОП
                          Акумулятори нові, мають сліди від зварювання бо депакетовані з нових нениклованих пакетів.

                          Виробник: \${BRAND}
                          Тип: Li-ion
                          Ємність перевірена: 4950-4950mAh
                          Максимальний постійний струм розряду: 10 A
                          Максимальний імпульсний струм розряду: 15 A
                          Напруга повного заряду: 4.2 B
                          Напруга повного розряду: 2.8 B
                          Опір 14-15 mom</g:description>

                                <g:picture>\${IMG_0}</g:picture>
                                <g:picture>\${IMG_1}</g:picture>
                                <g:picture>\${IMG_2}</g:picture>
                                <g:picture>\${IMG_3}</g:picture>
                                <g:picture>\${IMG_4}</g:picture>
                                <g:picture>\${IMG_5}</g:picture>

                                <g:param name="Стан">(\${CONDITION} == 'new') ? 'Новий': 'Вживані'</g:param>
                                <g:param name="Типорозмір">18650</g:param>
                                <g:param name="Тип акумулятора">Li-Ion</g:param>
                              </g:offer>
                          </g:Prom>
                      </g:export>`;

  
  const expected = `<?xml version="1.0" encoding="UTF-8"?>
    <g:export xmlns:g="http://example.com/google">
      <g:Prom>
        <g:offer available="true" id="1001" in_stock="in stock" selling_type="u">
          <g:name>Акумулятор _BRAND_ _NAME_ (нові-депакет)</g:name>
          <g:categoryId>0</g:categoryId>
          <g:portal_category_id>1507</g:portal_category_id>
          <g:price>125</g:price>
          <g:currencyId>UAH</g:currencyId>
          <g:quantity_in_stock>500</g:quantity_in_stock>
          <g:keywords>Акумулятор, Li-Ion</g:keywords>
          <g:description>Акумулятор - _BRAND_ M50LT 21700

                              Один із найкращих літій-іонних акумуляторів формату 21700 від південнокорейського гіганта _BRAND_. Модель M50LT спеціально розроблена для пристроїв, що потребують високої ємності та тривалої автономної роботи. Ідеально підходить для електровелосипедів, самокатів, потужних ліхтарів, повербанків та електротранспорту.

                              Можлива оплата на рахунок ФОП
                              Акумулятори нові, мають сліди від зварювання бо депакетовані з нових нениклованих пакетів.

                              Виробник: _BRAND_
                              Тип: Li-ion
                              Ємність перевірена: 4950-4950mAh
                              Максимальний постійний струм розряду: 10 A
                              Максимальний імпульсний струм розряду: 15 A
                              Напруга повного заряду: 4.2 B
                              Напруга повного розряду: 2.8 B
                              Опір 14-15 mom</g:description>
          <g:picture>0.jpg</g:picture>
          <g:picture>1.jpg</g:picture>
          <g:picture>2.jpg</g:picture>
          <g:picture>3.jpg</g:picture>
          <g:picture>4.jpg</g:picture>
          <g:picture>5.jpg</g:picture>
          <g:param name="Стан">Вживані</g:param>
          <g:param name="Типорозмір">18650</g:param>
          <g:param name="Тип акумулятора">Li-Ion</g:param>
        </g:offer>
      </g:Prom>
    </g:export>`;

  const result = applyExportRulesXML(xml_raw, context);
  if (!equal_xml(result, expected)){
    throw new Error(`Test failed. Expected ${expected}, got >>>> ${result}`);
  }

  console.log(`✅ ${getCallerFunctionName()} Test passed`);
}


