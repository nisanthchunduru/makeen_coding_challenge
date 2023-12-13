const crypto = require('crypto')

const Logger = require("./logger")

const Message = require("./models/message")
const MessageFragment = require("./models/message_fragment")

const messageCompletenessDeterminations = {}
async function markMessageAsCompleteAfterAllFragmentsAreReceived(message) {
  const allMessageFragmentsReceived = await message.allFragmentsReceived()
  if (allMessageFragmentsReceived) {
    delete messageCompletenessDeterminations[message.id]
    await printMessageSummary(message)
    await message.update({ complete: true })
    return
  }

  if (messageCompletenessDeterminations[message.id] == 'retry') {
    messageCompletenessDeterminations[message.id] = 'ongoing'
    await markMessageAsCompleteAfterAllFragmentsAreReceived(message)
  }
}

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
      await MessageFragment.create(messageFragmentAttributes)
    } catch(e) {
      if (e.message == 'Validation error') {
        // Return if message fragment is a duplicate one
        return true
      } else {
        throw e
      }
    }

    if (messageCompletenessDeterminations[message.id] == 'ongoing') {
      messageCompletenessDeterminations[message.id] = 'retry'
      return
    } else if (messageCompletenessDeterminations[message.id] == 'retry') {
      return
    } else if (messageCompletenessDeterminations[message.id] == 'complete') {
      return
    } else {
      messageCompletenessDeterminations[message.id] = 'ongoing'
      await markMessageAsCompleteAfterAllFragmentsAreReceived(message)
    }
  }
}

module.exports = ReceivedMessageFragmentProcessor

async function printMessageSummary(message) {
  const messageText = await message.getText()
  const hash = crypto.createHash("sha256").update(messageText);
  Logger.log(`Message #${message.externalId} size:${messageText.length} sha256:${hash.digest("hex")}`)
}
