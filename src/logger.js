class Logger {
  static log(line) {
    if (!this.logLines) {
      this.logLines = []
    }
    this.logLines.push(line)
    console.log(line)
  }

  static clear() {
    this.logLines = []
  }
}

module.exports = Logger
