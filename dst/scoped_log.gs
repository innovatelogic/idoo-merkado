class ScopedLogger {
  constructor(scope, parent = null) {
    this.scope = scope;
    this.parent = parent;

    this.lines = parent ? parent.lines : [];
    this.start = parent ? parent.start : new Date();
  }

  child(scope) {
    return new ScopedLogger(`${this.scope}.${scope}`, this);
  }

  _format(severity, msg) {
    const ts = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd HH:mm:ss.SSS"
    );

    return `${ts} ${severity} ${msg} [${this.scope}]`;
  }

  log(msg) {
    this.lines.push(this._format("INFO", msg));
  }

  warn(msg) {
    this.lines.push(this._format("WARN", msg));
  }

  error(msg, err = null) {
    this.lines.push(this._format("ERROR", msg));

    if (err) {
      const errText = err.stack || err.toString();
      this.lines.push(this._format("ERROR", errText));
    }
  }

  flush() {
    if (this.parent) return; // only root flushes

    const duration = new Date() - this.start;

    this.lines.push(
      this._format("INFO", `Execution finished in ${duration} ms`)
    );

    const output = this.lines.join("\n");

    // 1. Apps Script log
    Logger.log(output);

    // 2. Optional: save to S3 / sheet
    // uploadToS3(output, `logs/export_${Date.now()}.log`);

    return output;
  }
}

//----------------------------------------------------------------------------------------------
function create_scoped_logger(scope) {
  return new ScopedLogger(scope);
}

//----------------------------------------------------------------------------------------------
if (typeof module !== "undefined" && module.exports) {
    module.exports = { ScopedLogger,
                       create_scoped_logger
                     };
}