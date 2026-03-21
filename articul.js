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

//----------------------------------------------------------------------------------------------
//
//----------------------------------------------------------------------------------------------
function TEST_ArticulObject(){
  let ctx = {
    offer_id : 60001,
    brand : "articul brand",
    name : "articul name",
    condition : "new",
    available : "yes",
    bare_price : 100,
    sell_price: 110,
    count : 500,
    type : "type",
    export_rules_raw: `<g:export xmlns:g="http://example.com/google">

                      <user_vars>
                        <VAR_USED>(\${CONDITION} == 'new') ? 'Новий': 'Вживані'</VAR_USED>
                      </user_vars>

                      <g:Prom>
                          <g:offer id="\${OFFER_ID}" available="(\${AVAILABLE} == 'Available') ? 'true' : 'false' " in_stock="(\${COUNT} > 0) ? 'in stock' : 'false'" selling_type="u">
                                <g:name>Акумулятор \${BRAND} \${NAME} \${CONDITION} == 'new') ? 'Новий': 'Вживані'</g:name>
                                <g:categoryId>0</g:categoryId>
                                <g:portal_category_id>1507</g:portal_category_id>
                                <g:price>ceil5(\$(SELL_PRICE) * 1.2)</g:price>
                                <g:currencyId>UAH</g:currencyId>
                                <g:quantity_in_stock>\${COUNT}</g:quantity_in_stock>
                                <g:keywords>Акумулятор, Li-Ion</g:keywords>
                                <g:description cdata="true"><![CDATA[Акумулятор - \${BRAND} \${NAME} (\${CONDITION})<br/>

                          Виробник: \${BRAND}<br/>
                          Тип: Li-ion<br/>
                          Опір 14-15 mom]]>
                          </g:description>

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
                          <Rozetka>
                            <offer id="\${OFFER_ID}" available="(\${COUNT} > 0 &amp;&amp; \${AVAILABLE} == 'Available') ? 'in stock' : 'false' ">
                            <price>ceil5(\$(SELL_PRICE) * 1.2)</price>
                            <currencyId>UAH</currencyId>
                            <categoryId>0</categoryId>
                            <vendor>\${BRAND}</vendor>
                            <article>\${OFFER_ID}</article>
                            <name>Акумулятор \${BRAND} \${NAME} (нові-депакет)</name>

                            <description cdata="true"><![CDATA[Акумулятор - \${BRAND} \${NAME} (\${CONDITION})<br/>

                          Виробник: \${BRAND}<br/>
                          Тип: Li-ion<br/>
                          Опір 14-15 mom]]>
                          </description>

                            <picture>\${IMG_0}</picture>
                            <picture>\${IMG_1}</picture>
                            <picture>\${IMG_2}</picture>
                            <picture>\${IMG_3}</picture>
                            <picture>\${IMG_4}</picture>
                            <picture>\${IMG_5}</picture>

                            <param name="Стан">(\${CONDITION} == 'new') ? 'Новий': 'Вживані'</param>
                            <param name="Типорозмір">18650</param>
                            <param name="Тип акумулятора">Li-Ion</param>

                            </offer>
                          </Rozetka>
                      </g:export>`,

    price_rules_raw: `[{"min":1, "max":300, "price":"\${SELL_PRICE:int}"},
                      {"min":300, "max":1000, "price":"ceil5(\${SELL_PRICE:int} * 0.9)"},
                      {"min":1000, "max":999999999, "price":"ceil5(\${SELL_PRICE:int} * 0.85)"}]`,
    images_raw:`https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img1.webp
                https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img2.webp
                https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img3.webp
                https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img4.webp
                https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img5.webp
                https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img6.webp`
  };

  const articul = new Articul(ctx);

  const expected_price_rule = [ { min: 1, max: 300, price: 110 },
                                { min: 300, max: 1000, price: 100 },
                                { min: 1000, max: 999999999, price: 95 } ];

  let price_rules = articul.get_price_rules();
  if (JSON.stringify(expected_price_rule) !== JSON.stringify(price_rules)) {
    throw new Error(`Test failed.\nExpected: ${JSON.stringify(expected_price_rule)}\nGot: ${JSON.stringify(price_rules)}`);
  }

  const expected = `<?xml version="1.0" encoding="UTF-8"?>
<g:export xmlns:g="http://example.com/google">
  <g:Prom>
    <g:offer available="false" id="60001" in_stock="in stock" selling_type="u">
      <g:name>Акумулятор articul brand articul name (нові-депакет)</g:name>
      <g:categoryId>0</g:categoryId>
      <g:portal_category_id>1507</g:portal_category_id>
      <g:price>135</g:price>
      <g:currencyId>UAH</g:currencyId>
      <g:quantity_in_stock>500</g:quantity_in_stock>
      <g:keywords>Акумулятор, Li-Ion</g:keywords>
      <g:description cdata="true"><![CDATA[Акумулятор - articul brand articul name (new)<br/>

                          Виробник: articul brand<br/>
                          Тип: Li-ion<br/>
                          Опір 14-15 mom]]></g:description>
      <g:picture>https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img1.webp</g:picture>
      <g:picture>https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img2.webp</g:picture>
      <g:picture>https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img3.webp</g:picture>
      <g:picture>https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img4.webp</g:picture>
      <g:picture>https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img5.webp</g:picture>
      <g:picture>https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img6.webp</g:picture>
      <g:param name="Стан">Новий</g:param>
      <g:param name="Типорозмір">18650</g:param>
      <g:param name="Тип акумулятора">Li-Ion</g:param>
    </g:offer>
  </g:Prom>
  <Rozetka>
    <offer available="false" id="60001">
      <price>135</price>
      <currencyId>UAH</currencyId>
      <categoryId>0</categoryId>
      <vendor>articul brand</vendor>
      <article>60001</article>
      <name>Акумулятор articul brand articul name (нові-депакет)</name>
      <description cdata="true"><![CDATA[Акумулятор - articul brand articul name (new)<br/>

                          Виробник: articul brand<br/>
                          Тип: Li-ion<br/>
                          Опір 14-15 mom]]></description>
      <picture>https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img1.webp</picture>
      <picture>https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img2.webp</picture>
      <picture>https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img3.webp</picture>
      <picture>https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img4.webp</picture>
      <picture>https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img5.webp</picture>
      <picture>https://idoo-public.s3.eu-central-1.amazonaws.com/articuls/61000/img6.webp</picture>
      <param name="Стан">Новий</param>
      <param name="Типорозмір">18650</param>
      <param name="Тип акумулятора">Li-Ion</param>
    </offer>
  </Rozetka>
</g:export>`;

  let export_rules_xml = articul.get_export_rules();

  console.log(export_rules_xml);

  const expected_frmt_xml = XmlService.getCompactFormat().format(XmlService.parse(expected));
  const export_rules_frmt_xml = XmlService.getCompactFormat().format(XmlService.parse(export_rules_xml));

  console.log(export_rules_xml);
  console.log(expected);

  if (expected_frmt_xml !== export_rules_frmt_xml){
    throw new Error(`Test failed. Expected ${expected}, got >>>> ${export_rules_xml}`);
  }
  console.log(`✅ ${getCallerFunctionName()} Test passed`);
}
