const sequelize = require('../sequelize')
const { Sequelize } = require("sequelize")

const Message = sequelize.define('Message', {
  // id: {
  //   allowNull: false,
  //   autoIncrement: true,
  //   primaryKey: true,
  //   type: Sequelize.INTEGER,
  // },
  senderDesignatedId: {
    allowNull: false,
    type: Sequelize.BIGINT,
    unique: true
  },
  // createdAt: {
  //   allowNull: false,
  //   type: Sequelize.DATE,
  // },
  // updatedAt: {
  //   allowNull: false,
  //   type: Sequelize.DATE,
  // },
});

Message.prototype.allFragmentsReceived = function () {
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

module.exports = Message

function sortMessageFragments(messageFragments) {
  return messageFragments.sort((messageFragment1, messageFragment2) => messageFragment1.offset - messageFragment2.offset)
}
