const sequelize = require('../sequelize')
const { Sequelize } = require("sequelize")

const Message = sequelize.define('Message', {
  // id: {
  //   allowNull: false,
  //   autoIncrement: true,
  //   primaryKey: true,
  //   type: Sequelize.INTEGER,
  // },
  externalId: {
    allowNull: false,
    type: Sequelize.BIGINT,
    unique: true
  },
  complete: {
    allowNull: false,
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  createdAt: {
    allowNull: false,
    type: Sequelize.DATE,
  },
  updatedAt: {
    allowNull: false,
    type: Sequelize.DATE,
  },
});

Message.prototype.allFragmentsReceived = async function () {
  let fragments = await this.getMessageFragments();
  fragments = sortFragmentsByOffset(fragments)

  // If this first fragment is not yet received, return false
  if (fragments[0].offset != 0) {
    return false
  }
  // If this last fragment not yet received, return false
  if (!fragments[fragments.length - 1].isLast) {
    return false
  }
  // If only one fragment has been received and its not the last fragment, return false
  if (fragments.length == 1) {
    return false
  }

  // Determine if all fragments have been received
  for (i = 1; i < fragments.length; i++) {
    const previousFragment = fragments[i - 1]
    const fragment = fragments[i]

    if (fragment.offset != (previousFragment.offset + previousFragment.textSize)) {
      return false
    }
  }
  return true
}

Message.prototype.text = async function () {
  let fragments = await this.getMessageFragments();
  fragments = sortFragmentsByOffset(fragments)
  let text = ""
  fragments.forEach(function (fragment) {
    text = text + fragment.text
  })
  return text
}

module.exports = Message

function sortFragmentsByOffset(messageFragments) {
  return messageFragments.sort((messageFragment1, messageFragment2) => messageFragment1.offset - messageFragment2.offset)
}
