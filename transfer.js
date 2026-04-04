function get_transfer_price(name = 'Transfer') {
  return get_config_transfer_price();
}

function get_config_transfer_price(){
  return get_config_value("Transfer price UAH/KG");
}