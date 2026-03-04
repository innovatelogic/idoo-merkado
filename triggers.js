function installDailyTriggers() {
  // Clean old triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "export_prom_yml") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 00:00 GMT
  ScriptApp.newTrigger("export_prom_yml")
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .create();

  // 12:00 GMT
  ScriptApp.newTrigger("export_prom_yml")
    .timeBased()
    .everyDays(1)
    .atHour(12)
    .create();
}
