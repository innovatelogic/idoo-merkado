//----------------------------------------------------------------------------------------------
function createTrigger(t)
{
  let trigger = ScriptApp.newTrigger(t.name).timeBased();

  if (t.type = "hourly"){
    trigger.everyHours(1)
           .nearMinute(t.minute || 0)
           .create();
  }
  else {
    throw new Error("Unknown trigger type: " + t.type);
  }
}

//----------------------------------------------------------------------------------------------
function delete_all_triggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
}

//----------------------------------------------------------------------------------------------
function setup_triggers() {
  const raw = get_config_value('.Triggers');

  const config = typeof raw === "string"
    ? JSON.parse(raw)
    : raw;

  delete_all_triggers();

  config.triggers.forEach(t => {
    createTrigger(t);
  })
}