const crypto = require('crypto')

const Logger = require("./logger")

const Message = require("./models/message")
const MessageFragment = require("./models/message_fragment")

class ReceivedMessageFragmentProcessor {
  static async process(rawMessageFragment) {
    const flags = rawMessageFragment.readUInt16BE(0)
    const messageFragmentTextSize = rawMessageFragment.readUInt16BE(2)
    const messageFragmentOffset = rawMessageFragment.readUInt32BE(4)
    const messageId = rawMessageFragment.readUInt32BE(8)
    const messageFragmentText = rawMessageFragment.toString('utf8', 12, 12 + messageFragmentTextSize);
    const messageFragment = {
      flags: flags,
      offset: messageFragmentOffset,
      messageId: messageId,
      size: messageFragmentTextSize,
      text: messageFragmentText.toString()
    }

    const messageAttributes = {
      externalId: messageId
    }
    const [message, created] = await Message.findOrCreate({ where: messageAttributes })

    const messageFragmentAttributes = {
      offset: messageFragmentOffset,
      textSize: messageFragmentTextSize,
      text: messageFragmentText,
      isLast: (flags == 0x8000),
      MessageId: message.id
    }
    try {
      const _messageFragment = await MessageFragment.create(messageFragmentAttributes)
    } catch(e) {
      if (e.message == 'Validation error') {
        return true
      } else {
        throw e
      }
    }

    const allMessageFragmentsReceived = await message.allFragmentsReceived()
    if (allMessageFragmentsReceived) {
      await message.update({ complete: true })
      await printMessageSummary(message)
    }

    return true
  }
}

module.exports = ReceivedMessageFragmentProcessor

async function printMessageSummary(message) {
  const messageText = await message.text()
  const hash = crypto.createHash("sha256").update(messageText);
  Logger.log(`Message #${message.externalId} size:${messageText.length} sha256:${hash.digest("hex")}`)
}
