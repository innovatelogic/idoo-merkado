//----------------------------------------------------------------------------------------------
//
//----------------------------------------------------------------------------------------------
function TEST_PrepareCalculationInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Orders New");
  if (!sheet) {
    throw new Error("Sheet 'Orders New' not found");
  }

  const range = sheet.getRange("B2:B3");
  sheet.setActiveRange(range);
  const {new_backets, removed_orders} = PrepareCalculationInfo();

  // Convert Map to plain object
  const backetsObj = Object.fromEntries(new_backets);
  const removedOrdersArray = Array.from(removed_orders);

  // Convert to JSON
  const backets_json = JSON.stringify(backetsObj);
  const removed_orders_json = JSON.stringify(removedOrdersArray);

  // Pass JSON to HTML
  const html = HtmlService.createTemplateFromFile("calculation");
  html.data = backets_json;
  html.removed_orders = removed_orders_json;
}

//----------------------------------------------------------------------------------------------
//
//----------------------------------------------------------------------------------------------
function TEST_onCalculationConfirmed(backets_str) {
  const data = `
  {
    "0": {
      "orders": {
        "ORD-1764527899730": [
          {
            "order_id": "ORD-1764527899730",
            "row_data": {},
            "status": "Закрито",
            "total": 1120,
            "account": "Накл плат Ігор",
            "profit": 152,
            "base": 968,
            "articul": "ART-LGM58T21700-BC-BP"
          }
        ],
        "ORD-1764527983011": [
          {
            "account": "Накл плат Ігор",
            "profit": 130,
            "order_id": "ORD-1764527983011",
            "status": "Закрито",
            "base": 345,
            "row_data": {},
            "total": 475,
            "articul": "ART-18650-MolicelP26A -BC-BP"
          }
        ]
      },
      "base": 1313,
      "total": 1595,
      "accounts": [
        "Накл плат Ігор",
        "ФОП ІГОР",
        "Готівка Ігор"
      ],
      "profit": 282
    }
  }`;
  
  onCalculationConfirmed(JSON.parse(data));
}

//----------------------------------------------------------------------------------------------
//
//----------------------------------------------------------------------------------------------
function runAllTests() {
  const tests = Object.keys(this)
    .filter(name => name.startsWith('TEST_'));

  let passed = 0;

  tests.forEach(name => {
    try {
      this[name]();
      console.log(`✅ ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ ${name}: ${e.message}`);
    }
  });

  console.log(`\n${passed}/${tests.length} tests passed`);
}
