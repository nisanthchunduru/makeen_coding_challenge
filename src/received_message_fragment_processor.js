const crypto = require('crypto')

const Logger = require("./logger")

const Message = require("./models/message")
const MessageFragment = require("./models/message_fragment")

messagesFragments = {}

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
      senderDesignatedId: messageId
    }
    const [message, created] = await Message.findOrCreate({ where: messageAttributes })

    const messageFragmentAttributes = {
      offset: messageFragmentOffset,
      textSize: messageFragmentTextSize,
      text: messageFragmentText,
      isLast: (flags == 0x8000),
      MessageId: message.id
    }
    const _messageFragment = await MessageFragment.create(messageFragmentAttributes)

    if (!messagesFragments[messageId]) {
      messagesFragments[messageId] = []
    }
    messagesFragments[messageId].push(messageFragment)
    if (allMessageFragmentsReceived(messageId)) {
      printMessageSummary(messageId)
    }

    return true
  }
}

module.exports = ReceivedMessageFragmentProcessor

function allMessageFragmentsReceived(messageId) {
  messageFragments = messagesFragments[messageId]
  messageFragments = sortMessageFragments(messageFragments)

  messageFragmentPositions = messageFragments.map(function (messageFragment) {
    return [messageFragment.offset, messageFragment.size, messageFragment.flags]
  })

  // If this first message fragment is yet to be received, return false
  if (messageFragments[0].offset != 0) {
    return false
  }
  // If this last message fragment is yet to be received, return false
  if (messageFragments[messageFragments.length - 1].flags != 0x8000) {
    return false
  }
  // If only one message fragment and its not the last fragment, return false
  if (messageFragments.length == 1) {
    return false
  }

  // Determine if all message fragments have been received
  for (i = 1; i < messageFragments.length; i++) {
    const previousMessageFragment = messageFragments[i - 1]
    const messageFragment = messageFragments[i]

    if (messageFragment.offset != (previousMessageFragment.offset + previousMessageFragment.size)) {
      return false
    }
  }
  return true
}

function printMessageSummary(messageId) {
  messageFragments = messagesFragments[messageId]
  messageFragments = sortMessageFragments(messageFragments)
  message = ""
  messageFragments.forEach(function (messageFragment) {
    message = message + messageFragment.text
  })
  var hash = crypto.createHash("sha256").update(message);
  // console.log(`Message #${messageId} size:${message.length} sha256:${hash.digest("hex")}`)
  Logger.log(`Message #${messageId} size:${message.length} sha256:${hash.digest("hex")}`)
}

function sortMessageFragments(messageFragments) {
  return messageFragments.sort((messageFragment1, messageFragment2) => messageFragment1.offset - messageFragment2.offset)
}
