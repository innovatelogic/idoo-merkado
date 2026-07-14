//----------------------------------------------------------------------------------------------
function get_secrets() {
  const props = PropertiesService.getScriptProperties();
  
  return {
    AWS_ACCESS_KEY: props.getProperty('AWS_ACCESS_KEY'),
    AWS_SECRET_KEY: props.getProperty('AWS_SECRET_KEY'),
    AWS_REGION: props.getProperty('AWS_REGION'),
    AWS_SERVICE: props.getProperty('AWS_SERVICE'),
    AWS_BUCKET : props.getProperty('AWS_BUCKET'),
    SCRIPT_ID : props.getProperty('SCRIPT_ID')
  };
}

//----------------------------------------------------------------------------------------------
if (typeof module !== "undefined" && module.exports) {
    module.exports = { get_secrets };
}