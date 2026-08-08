//----------------------------------------------------------------------------------------------
function impl_get_config_value_def(json_data, json_path, val_if_not_exist)
{
  if (json_data == null || !json_path) {
        return val_if_not_exist;
    }

    const keys = json_path.split(".");
    let value = json_data;

    for (const key of keys) {
        if (value == null ||
            typeof value !== "object" ||
            !(key in value)) {
            return val_if_not_exist;
        }

        value = value[key];
    }

    return value === undefined ? val_if_not_exist : value;
}

//----------------------------------------------------------------------------------------------
function impl_get_config_value_throw_if_no_exist(json_data, json_path)
{
  if (json_data == null || !json_path) {
        throw new Error(`[impl_get_config_value_throw_if_no_exist] error: invalid param`);;
  }

  const keys = json_path.split(".");
  let value = json_data;

  for (const key of keys) {
      if (value == null ||
          typeof value !== "object" ||
          !(key in value)) {
            throw new Error(`[impl_get_config_value_throw_if_no_exist] error: invalid path ${json_path}`);;
      }

      value = value[key];
  }

  return value;
}

//----------------------------------------------------------------------------------------------
function get_config_value_def(sh, json_path, val_if_not_exist) {
  
  if (!sh) throw new Error(`[get_config_value_def] error: invalid input param`);
  const key = ".config";
  const rows = get_table_row_map(sh);

  if (!(key in rows)){
    throw new Error(`[get_config_value_def] error: no "${key}" found!`);
  }

  const jdata = JSON.parse(sh.getRange(rows[key], 2).getValue());

  return impl_get_config_value_def(jdata, json_path, val_if_not_exist);
}

//----------------------------------------------------------------------------------------------
function get_config_value_throw_if_not_exist(sh, json_path) {
  
  if (!sh) throw new Error(`[get_config_value_throw_if_not_exist] error: invalid input param`);
  const key = ".config";
  const rows = get_table_row_map(sh);

  if (!(key in rows)){
    throw new Error(`[get_config_value_throw_if_not_exist] error: no "${key}" found!`);
  }

  const jdata = JSON.parse(sh.getRange(rows[key], 2).getValue());

  return impl_get_config_value_throw_if_no_exist(jdata, json_path);
}

//----------------------------------------------------------------------------------------------
function get_currency_rate(sh, curr1, curr2){
  const raw = get_config_value(sh, ".Currency");

  if (curr1 == '' || curr2 == ''){
    throw new Error(`[get_currency_rate] error: empty currency value!`);
  }
  if (curr1 == curr2){
    return 1.0;
  }

  const rates = typeof raw === "string" ? JSON.parse(raw) : raw;
  return rates["Currency"][curr1][curr2];
}

//----------------------------------------------------------------------------------------------
function get_currency_rate_v2(sh, curr1, curr2){

  if (curr1 == '' || curr2 == ''){
    throw new Error(`[get_currency_rate_v2] error: empty currency value!`);
  }

  if (curr1 == curr2){
    return 1.0;
  }

  const key = ".config";
  const rows = get_table_row_map(sh);

  if (!(key in rows)){
    throw new Error(`[get_currency_rate_v2] error: no "${key}" found!`);
  }

  const jdata = JSON.parse(sh.getRange(rows[key], 2).getValue());
 return impl_get_config_value_def(jdata, "Currency." + curr1 + "." + curr2);
}

//----------------------------------------------------------------------------------------------
if (typeof module !== "undefined" && module.exports) {
    module.exports = { get_config_value_def,
                       get_currency_rate,
                       get_currency_rate_v2,
                       get_config_value_throw_if_not_exist
                     };
}