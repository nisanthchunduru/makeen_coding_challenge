const Logger = require("./logger")

class MessageHolesPrinter {
  static async print(message) {
    const messageHoles = await message.holes()
    messageHoles.forEach(function (hole) {
      const log = `Message #${message.externalId} Hole at: ${hole}`
      Logger.log(log)
    })
  }
}

module.exports = MessageHolesPrinter
