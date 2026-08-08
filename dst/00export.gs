
function xml_walk(node, context) {
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
    return IdM_eval_formula(node, context);
  }
  return node;
}

//----------------------------------------------------------------------------------------------
function apply_export_rules(obj, context) {
  return xml_walk(obj, context);
}

//----------------------------------------------------------------------------------------------
function update_context_with(headers, row_data, context) {

  const offer_id  = row_data[headers['offer_id']];
  const available  = row_data[headers['Available']];
  const sell_price = row_data[headers['Sell Price (UA)']];
  const delivery_count = row_data[headers['Delivering']];

  context.OFFER_ID = offer_id;

  if (available){
    context.AVAILABLE = available;
  }

  if (sell_price){
    context.SELL_PRICE = sell_price;
  }

  if (delivery_count){
    context.DELIVERY_COUNT = delivery_count;
  }

  const images_raw = row_data[headers['Images']];

  if (images_raw){
    // remove inherited IMG_* entries
    for (const key of Object.keys(context)) {
      if (key.startsWith('IMG_')) {
        delete context[key];
      }
    }

    const images = String(images_raw)
                    .split(/\r?\n/)
                    .map(s => s.trim())
                    .filter(Boolean); // remove empty lines

    images.forEach((img, i) => {
      context[`IMG_${i}`] = img;
    });
  }
  return context;
}
//----------------------------------------------------------------------------------------------
function _parse_articul(articul) {
  const match = articul.match(/^(\d+)(?:-c(\d+))?$/);

  if (!match) {
    return null; // or throw error if invalid input should not pass
  }

  const base_id = match[1];
  const count = match[2] ? parseInt(match[2], 10) : 1;

  return { base_id, count };
}

//----------------------------------------------------------------------------------------------
function _is_base(articul){
  articul = String(articul);
  return !articul.includes('-');
}

function _build_xml_node(node, context) {

  //console.log(` -> start build_xml_node`);

  // ---------- Attributes ----------
  const attrs = node.getAttributes();
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    const value = attr.getValue();

    if (typeof value === "string" && value.includes("$")) {
      const newVal = IdM_eval_formula(value, context);
      attr.setValue(String(newVal));
    }
  }

  // ---------- Text / CDATA ----------
  const text = node.getText();
  if (text && text.includes("$")) {
    // Check if node has cdata attribute
    if (node.getAttribute("cdata") && node.getAttribute("cdata").getValue() === "true") {

      const newText = IdM_eval_formula(text, context, true);

      // Remove all current children (including old CDATA)
      node.getChildren().forEach(c => node.removeContent(c));
      // Clear old text
      node.setText(""); 
      // Add new CDATA node
      const cdataNode = XmlService.createCdata(newText);
      node.addContent(cdataNode);
      
      //node.removeAttribute("cdata");
    } else {
      // Regular text replacement
      const newText = IdM_eval_formula(text, context);
      node.setText(newText);
    }
  }

  //console.log(` -> end build_xml_node`);
}

//----------------------------------------------------------------------------------------------
function _build_node(node, context){

  //console.log(`offer_id: -> enter _build_node`);

  let new_context = { ... context};

  if (!node){ return new_context; }

  //console.log(`offer_id: -> start _build_node`);
  //console.log(`node name: ${node.getName()} `);

  _build_xml_node(node, context);

  //console.log(`offer_id: -> end _build_node`);

  new_context[node.getName()] = node.getValue();

  //console.log(`add to new_context ${node.getName()} = ${node.getValue()}`);

  return new_context;
}

//----------------------------------------------------------------------------------------------
// Walk XML DOM
//----------------------------------------------------------------------------------------------
function _walkXmlNode(node, context) {

  _build_xml_node(node, context);

  // ---------- Child elements ----------
  const children = node.getChildren();
  for (let i = 0; i < children.length; i++) {
    _walkXmlNode(children[i], context);
  }
}

//----------------------------------------------------------------------------------------------
function _build_xml_tree(xml_node, context) {
  if (!xml_node) { return; }
  
   //console.log(`offer_id: ${offer_id} -> start walk xml node`);

   _walkXmlNode(xml_node, context);

   //console.log(`offer_id: ${offer_id} -> end walk xml node`);
}

//----------------------------------------------------------------------------------------------
function get_all_articuls(sh) {

  if (!sh) throw new Error('[get_all_articuls] invalid param');

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  //const headers = getColumnIndexes(table_name);
  const headers = get_table_header_map_sheet(sh);

  if (lastRow < 2) return [];

  // A–K → 11 columns
  const data = sh.getRange(2, 1, lastRow - 1, lastCol)
                 .getValues()
                 .filter(row => row.some(cell => cell !== '' && cell !== null));

  const base_articlule_map = new Map();

  data.forEach(row => {
    const offer_id  = row[headers['offer_id']];

    if (_is_base(offer_id)) {
      base_articlule_map.set(offer_id, row);
    }
  });

  const items = [];

  data.forEach(row => {
   
    const offer_id  = row[headers['offer_id']];

    let context = null;

    if (!_is_base(offer_id))
    {
      let offer_count = _parse_articul(offer_id);
      if (offer_count === null){
        console.log("[get_all_items_v2] Parse articul failed:" + offer_id);
        return;
      }

      let underlying_row = base_articlule_map.get(Number(offer_count.base_id));

      if (!underlying_row){
        console.log("[get_all_items_v2] Underlying not found:" + offer_count.base_id);
        return;
      }

      context = fill_item_context(headers, underlying_row);

      if (row != underlying_row){
        update_context_with(headers, row, context)
      }
    }
    else
    {
      context = fill_item_context(headers, row);
    }

    let price_rule = null;

    const price_rule_raw = row[headers['Price rule(UA)']];
    if (price_rule_raw && typeof price_rule_raw === "string") {
      try {
        const json = JSON.parse(price_rule_raw);
        price_rule = apply_export_rules(json, context);
      } catch (e) {
        price_rule = null;
      }
    }

    //console.log(`offer_id: ${offer_id} -> price rule done`);

    const export_rules_raw = row[headers['Export Rules']];
    let export_rules = null;
    if (export_rules_raw && typeof export_rules_raw === "string") {

      try {

        //console.log(`offer_id: ${offer_id} -> start parse export rules`);

        const doc = XmlService.parse(export_rules_raw);

        //console.log(`offer_id: ${offer_id} -> end parse export rules`);

        const xml_root = doc.getRootElement();

        //console.log(`offer_id: ${offer_id} -> get root element`);

        const xml_user_vars = xml_root.getChild("user_vars");
        if (xml_user_vars !== null){
          const children = xml_user_vars.getChildren();

          //console.log(`offer_id: ${offer_id} -> start building`);

          for (const child of children){
            //console.log(`offer_id: ${offer_id} -> start build child`);
            context = _build_node(child, context);
            //console.log(`offer_id: ${offer_id} -> end build child`);
          }
        }

        //console.log(`offer_id: ${offer_id} -> start building xml tree`);

        _build_xml_tree(xml_root, context);

        //console.log(`offer_id: ${offer_id} -> end building xml tree`);

        export_rules = XmlService.getPrettyFormat().format(doc);

        //console.log(`offer_id: ${offer_id} -> export rules ${export_rules}`);

      } catch (e) {
        console.log(
          `Failed to export ${context?.OFFER_ID}: ${e.message}\n${e.stack}`
        );
        exprt_rules = null;
      }
    }

    items.push({
        offer_id : context.OFFER_ID,
        name : context.NAME,
        bare_price : context.BARE_PRICE,
        sell_price : context.SELL_PRICE,
        price_rule,
        export_rules,
        count : context.COUNT,
        delivery_count : context.DELIVERY_COUNT,
        label: `${context.NAME} (${context.OFFER_ID}) ${context.BARE_PICE}`
      });
  });

  return items;
}

//----------------------------------------------------------------------------------------------
function fill_item_context(headers, row_data){
  const offer_id  = row_data[headers['offer_id']];
  const brand     = row_data[headers['Brand']];
  const market_name = row_data[headers['Market Name']];
  const name      = row_data[headers['Name']];
  const condition = row_data[headers['Condition']];
  const available  = row_data[headers['Available']];

  const bare_price = row_data[headers['Ціна поставки (UAH)']];
  const sell_price = row_data[headers['Sell Price (UA)']];
  const sell_price_pl = row_data[headers['Sell Price (PL)']];
  const price_rule_raw = row_data[headers['Price rule(UA)']];
  const delivery_count = row_data[headers['Delivering']];

  const weight = row_data[headers['Weight (gr)']];
  const type = row_data[headers['Type']];

  const count = row_data[headers['Count']];
  //const export_rules_raw = row[headers['Export Rules']];
  const images_raw = row_data[headers['Images']];

  const export_rules_raw = row_data[headers['Export Rules']];

  const images = (images_raw || "")
                    .split(/\r?\n/)
                    .map(s => s.trim())
                    .filter(Boolean); // remove empty lines

  let context = {
      OFFER_ID: offer_id,
      BRAND: brand,
      NAME: name,
      MARKET_NAME: market_name,
      CONDITION: condition,
      AVAILABLE: available,
      BARE_PRICE: bare_price,
      SELL_PRICE: sell_price,
      SELL_PRICE_UA: sell_price,
      SELL_PRICE_PL: sell_price_pl,
      COUNT: count,
      DELIVERY_COUNT: delivery_count ? delivery_count : 0,
      WEIGHT: weight,
      TYPE: type
  };

  images.forEach((img, i) => {
    context[`IMG_${i}`] = img;
  });

  if (price_rule_raw && typeof price_rule_raw === "string") {
    try {
      const json = JSON.parse(price_rule_raw);
      let price_rule = apply_export_rules(json, context);

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

  //console.log(`offer_id: ${offer_id} -> ${JSON.stringify(context, null, 2)}`);

  return context;
}

//----------------------------------------------------------------------------------------------
if (typeof module !== "undefined" && module.exports) {
    module.exports = { apply_export_rules,
                       get_all_articuls
                      };
}

//----------------------------------------------------------------------------------------------
// Walk XML DOM
//----------------------------------------------------------------------------------------------
function TEST_applyExportRulesXML(){

    let context = {
      OFFER_ID: 1,
      BRAND: "brand",
      NAME: "name",
      MARKET_NAME: "market_name",
      CONDITION: "used",
      AVAILABLE: "Available",
      BARE_PRICE: 3,
      SELL_PRICE: 5,
      SELL_PRICE_UA: 5,
      SELL_PRICE_PL: 4,
      COUNT: 3,
      DELIVERY_COUNT: 1,
      WEIGHT: 2,
      TYPE: "type",
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
    const price_rule = apply_export_rules(price_rule_json, context);

    price_rule.forEach((rule, i) =>{
      context[`RULE_MIN_${i}`] = rule.min;
      context[`RULE_MAX_${i}`] = rule.max;
      context[`RULE_PRICE_${i}`] = rule.price;
    });

    const xml_raw = `<g:export xmlns:g="http://example.com/google">

                      <user_vars>
                        <VAR_USED>(\${CONDITION} == 'new') ? '': 'Б/В'</VAR_USED>
                        <CHECK>(\${VAR_USED} == 'Б/В') ? 'OK': 'FAILED'</CHECK>
                      </user_vars>

                      <g:Prom>
                          <g:offer id="\${OFFER_ID}" available="(\${AVAILABLE} == 'Available') ? 'true' : 'false' " in_stock="(\${COUNT} > 0 &amp;&amp; \${AVAILABLE} == 'Available') ? 'in stock' : 'false' " selling_type="u">
                                <g:name>Акумулятор \${BRAND} \${NAME} (нові-депакет) \${VAR_USED}</g:name>
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

      <user_vars>
        <VAR_USED>Б/В</VAR_USED>
        <CHECK>OK</CHECK>
      </user_vars>

      <g:Prom>
        <g:offer available="true" id="1001" in_stock="in stock" selling_type="u">
          <g:name>Акумулятор _BRAND_ _NAME_ (нові-депакет) Б/В</g:name>
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

  const doc = XmlService.parse(xml_raw);
  const xml_root = doc.getRootElement();

  const xml_user_vars = xml_root.getChild("user_vars");
  if (xml_user_vars !== null){
    const children = xml_user_vars.getChildren();

    for (const child of children){
      context = _build_node(child, context);
    }
  }

  _build_xml_tree(xml_root, context);

  let result = XmlService.getPrettyFormat().format(doc);

  if (!equal_xml(result, expected)){
    throw new Error(`Test failed. Expected \n ${expected} \n got >>>> \n ${result}`);
  }

  console.log(`✅ ${getCallerFunctionName()} Test passed`);
}

function TEST_BuildXMLTree()
{
    let context = {
      OFFER_ID: 1,
      BRAND: "brand",
      NAME: "name",
      MARKET_NAME: "market_name",
      CONDITION: "used",
      AVAILABLE: "Available",
      BARE_PRICE: 3,
      SELL_PRICE: 5,
      SELL_PRICE_UA: 5,
      SELL_PRICE_PL: 4,
      COUNT: 3,
      DELIVERY_COUNT: 1,
      WEIGHT: 2,
      TYPE: "type",
      IMG_0: "0.jpg",
      IMG_1: "1.jpg",
      IMG_2: "2.jpg",
      IMG_3: "3.jpg",
      IMG_4: "4.jpg",
      IMG_5: "5.jpg",
      IMG_6: "6.jpg"
  };

    const price_rule_raw = `[{"min":1, "max":300, "price":"ceil5(\${SELL_PRICE} * 1.2)"},
                              {"min":300, "max":1000, "price":"ceil5(\${SELL_PRICE} * 1.15)"},
                              {"min":1000, "max":999999999, "price":"ceil5(\${SELL_PRICE} * 1.1)"}]`;

    const price_rule_json = JSON.parse(price_rule_raw);
    const price_rule = apply_export_rules(price_rule_json, context);

    price_rule.forEach((rule, i) =>{
      context[`RULE_MIN_${i}`] = rule.min;
      context[`RULE_MAX_${i}`] = rule.max;
      context[`RULE_PRICE_${i}`] = rule.price;
    });

    const xml_raw = `<g:export xmlns:g="http://example.com/google">

     <user_vars>
          <VAR_ARTICUL>INR21700M50LT</VAR_ARTICUL>
          <VAR_USED>(\${CONDITION} == 'нові') ? '': 'Б/В'</VAR_USED>
          <VAR_CONDITION_PROM>(\${CONDITION} == 'нові') ? '': 'депакет'</VAR_CONDITION_PROM>
          <VAR_FORMFACTOR>21700</VAR_FORMFACTOR>
          <VAR_CAPACITY>5000</VAR_CAPACITY>
          <VAR_BRAND_COUNTRY_UA>Республіка Корея (Південна Корея)</VAR_BRAND_COUNTRY_UA>
          <VAR_IS_AVAILABLE>(\${COUNT} > 0 &amp;&amp; \${AVAILABLE} == 'Available') ? 'true' : 'false' </VAR_IS_AVAILABLE>
          <VAR_COUNT_AVAILABLE>(\${COUNT} > 0 &amp;&amp; \${AVAILABLE} == 'Available') ? \${COUNT} : 0</VAR_COUNT_AVAILABLE>
          <VAR_ROZETKA_CATEGORY_ID>654239</VAR_ROZETKA_CATEGORY_ID>
      </user_vars>

                      <g:Prom>
                          <g:offer id="\${OFFER_ID}" available="\${VAR_IS_AVAILABLE}" in_stock="\${VAR_IS_AVAILABLE}" selling_type="u">
                                <g:name>Акумулятор \${BRAND} \${NAME} \${VAR_CAPACITY}mAh (\${VAR_ARTICUL}) \${VAR_CONDITION_PROM}</g:name>
                                <g:categoryId>136075826</g:categoryId>
                                <g:currencyId>UAH</g:currencyId>
                                <g:portal_category_id>1507</g:portal_category_id>
                                <g:price>ceil5($(SELL_PRICE) * 1.25)</g:price>
                                <g:currencyId>UAH</g:currencyId>
                                <g:quantity_in_stock>\${VAR_COUNT_AVAILABLE}</g:quantity_in_stock>
                                <g:keywords>Акумулятор, \${TYPE}</g:keywords>
                                <g:vendor>\${BRAND}</g:vendor>
                                <g:description cdata="true"><![CDATA[ Акумулятор - \${BRAND} \${MARKET_NAME} (\${CONDITION})<br/>

                          Один із найкращих літій-іонних акумуляторів формату 21700 від південнокорейського гіганта \${BRAND}. Модель M50LT спеціально розроблена для пристроїв, що потребують високої ємності та тривалої автономної роботи. Ідеально підходить для електровелосипедів, самокатів, потужних ліхтарів, повербанків та електротранспорту.<br/>

                          Можлива оплата на рахунок ФОП<br/>
                          Акумулятори нові, мають сліди від зварювання бо депакетовані з нових нениклованих пакетів.<br/>

                          Виробник: \${BRAND}<br/>
                          Тип: Li-ion<br/>
                          Ємність перевірена: 4950-4950mAh<br/>
                          Максимальний постійний струм розряду: 10 A<br/>
                          Максимальний імпульсний струм розряду: 15 A<br/>
                          Напруга повного заряду: 4.2 B<br/>
                          Напруга повного розряду: 2.8 B<br/>
                          Опір 14-15 mom ]]>
                          </g:description>

                                <g:picture>\${IMG_0}</g:picture>
                                <g:picture>\${IMG_1}</g:picture>
                                <g:picture>\${IMG_2}</g:picture>
                                <g:picture>\${IMG_3}</g:picture>
                                <g:picture>\${IMG_4}</g:picture>
                                <g:picture>\${IMG_5}</g:picture>

                                <g:param name="Стан">(\${CONDITION} == 'нові') ? 'Новий': 'Вживані'</g:param>
                                <g:param name="Типорозмір">\${VAR_FORMFACTOR}</g:param>
                                <g:param name="Тип акумулятора">\${TYPE}</g:param>
                              </g:offer>
                          </g:Prom>

    <Rozetka>
       <offer id="\${OFFER_ID}" available="\${VAR_IS_AVAILABLE}">
       <name>Акумулятор \${BRAND} \${NAME} \${VAR_CAPACITY}mAh (\${VAR_ARTICUL}) \${VAR_USED}</name>
       <name_ua>Акумулятор \${BRAND} \${NAME} \${VAR_CAPACITY}mAh (\${VAR_ARTICUL}) \${VAR_USED}</name_ua>
        <categoryId>\${VAR_ROZETKA_CATEGORY_ID}</categoryId>
        <currencyId>UAH</currencyId>
        <price>ceil5($(SELL_PRICE) * 1.2)</price>
        <vendor>\${BRAND}</vendor>
        <picture>\${IMG_6}</picture>

       <stock_quantity>\${VAR_COUNT_AVAILABLE}</stock_quantity>
       <min_cart_quantity>1</min_cart_quantity>

        <state>(\${CONDITION} == 'нові') ? 'new': 'used'</state>

        <param name="Стан">(\${CONDITION} == 'нові') ? 'Новий': 'Вживані'</param>
        <param name="Типорозмір">\${VAR_FORMFACTOR}</param>
        <param name="Тип">Акумулятори</param>
        <param name="Ємність">\${VAR_CAPACITY}</param>
        <param name="Вид">Літій-іонні</param> 
        <param name="Тип акумулятора">\${TYPE}</param>
        <param name="Вага">abs(\${WEIGHT}  * 0.001)</param>
        <param name="Країна реєстрації бренду">\${VAR_BRAND_COUNTRY_UA}</param>
        <param name="Країна-виробник товару">\${VAR_BRAND_COUNTRY_UA}</param>

       <description cdata="true"><![CDATA[ Акумулятор - \${BRAND} \${MARKET_NAME} (\${CONDITION})<br/>
                          Один із найкращих літій-іонних акумуляторів формату 21700 від південнокорейського гіганта \${BRAND}. Модель M50LT спеціально розроблена для пристроїв, що потребують високої ємності та тривалої автономної роботи. Ідеально підходить для електровелосипедів, самокатів, потужних ліхтарів, повербанків та електротранспорту.<br/>

                          Акумулятори нові, мають сліди від зварювання бо депакетовані з нових нениклованих пакетів.<br/>

                          Виробник: \${BRAND}<br/>
                          Тип: Li-ion<br/>
                          Ємність перевірена: 4950-4950mAh<br/>
                          Максимальний постійний струм розряду: 10 A<br/>
                          Максимальний імпульсний струм розряду: 15 A<br/>
                          Напруга повного заряду: 4.2 B<br/>
                          Напруга повного розряду: 2.8 B<br/>
                          Опір 14-15 mom ]]>
                          </description>

<description_ua cdata="true"><![CDATA[ Акумулятор - \${BRAND} \${MARKET_NAME} (\${CONDITION})<br/>
                          Один із найкращих літій-іонних акумуляторів формату 21700 від південнокорейського гіганта \${BRAND}. Модель M50LT спеціально розроблена для пристроїв, що потребують високої ємності та тривалої автономної роботи. Ідеально підходить для електровелосипедів, самокатів, потужних ліхтарів, повербанків та електротранспорту.<br/>

                          Акумулятори нові, мають сліди від зварювання бо депакетовані з нових нениклованих пакетів.<br/>

                          Виробник: \${BRAND}<br/>
                          Тип: Li-ion<br/>
                          Ємність перевірена: 4950-4950mAh<br/>
                          Максимальний постійний струм розряду: 10 A<br/>
                          Максимальний імпульсний струм розряду: 15 A<br/>
                          Напруга повного заряду: 4.2 B<br/>
                          Напруга повного розряду: 2.8 B<br/>
                          Опір 14-15 mom ]]>
                          </description_ua>
      </offer>
    </Rozetka>

    <xbat-com-ua>
       <offer id="\${OFFER_ID}" available="(\${AVAILABLE} == 'Available') ? 'true' : 'false' ">
       <name>Акумулятор \${BRAND} \${NAME} \${VAR_CAPACITY}mAh (\${VAR_ARTICUL}) \${VAR_CONDITION_PROM}</name>
        <categoryId>20</categoryId>
        <currencyId>UAH</currencyId>
        <price>ceil5($(SELL_PRICE))</price>
        <price_rule max="\${RULE_MAX_0}">\${RULE_PRICE_0}</price_rule>
        <price_rule min="\${RULE_MIN_1}">\${RULE_PRICE_1}</price_rule>
        <vendor>\${BRAND}</vendor>
        <picture>\${IMG_0}</picture>
        <picture>\${IMG_1}</picture>
        <picture>\${IMG_2}</picture>
        <picture>\${IMG_3}</picture>
        <picture>\${IMG_4}</picture>
        <picture>\${IMG_5}</picture>

        <stock_quantity>\${VAR_COUNT_AVAILABLE}</stock_quantity>
       
        <param name="Стан">(\${CONDITION} == 'нові') ? 'Новий': 'Вживані'</param>
        <param name="Типорозмір">\${VAR_FORMFACTOR}</param>
        <param name="Тип акумулятора">\${TYPE}</param>
       <description cdata="true"><![CDATA[ Акумулятор - \${BRAND} \${NAME} (\${CONDITION})<br/>

                          Один із найкращих літій-іонних акумуляторів формату 21700 від південнокорейського гіганта \${BRAND}. Модель M50LT спеціально розроблена для пристроїв, що потребують високої ємності та тривалої автономної роботи. Ідеально підходить для електровелосипедів, самокатів, потужних ліхтарів, повербанків та електротранспорту.<br/>

                          Можлива оплата на рахунок ФОП<br/>
                          Акумулятори нові, мають сліди від зварювання бо депакетовані з нових нениклованих пакетів.<br/>

                          Виробник: \${BRAND}<br/>
                          Тип: Li-ion<br/>
                          Ємність перевірена: 4950-4950mAh<br/>
                          Максимальний постійний струм розряду: 10 A<br/>
                          Максимальний імпульсний струм розряду: 15 A<br/>
                          Напруга повного заряду: 4.2 B<br/>
                          Напруга повного розряду: 2.8 B<br/>
                          Опір 14-15 mom ]]>
                          </description>
      </offer>
    </xbat-com-ua>
</g:export>`;

  const doc = XmlService.parse(xml_raw);
  const xml_root = doc.getRootElement();

  const xml_user_vars = xml_root.getChild("user_vars");
  if (xml_user_vars !== null){
    const children = xml_user_vars.getChildren();

    for (const child of children){
      context = _build_node(child, context);
    }
  }

  build_xml_tree(xml_root, context);

  let result = XmlService.getPrettyFormat().format(doc);
}
