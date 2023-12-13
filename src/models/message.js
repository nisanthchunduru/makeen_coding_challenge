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
  const holes = await this.getHoles()
  return (holes.length == 0)
}

Message.prototype.getText = async function () {
  let fragments = await this.getMessageFragments();
  fragments = sortFragmentsByOffset(fragments)
  let text = ""
  fragments.forEach(function (fragment) {
    text = text + fragment.text
  })
  return text
}

Message.prototype.getHoles = async function () {
  let fragments = await this.getMessageFragments();
  fragments = sortFragmentsByOffset(fragments)
  let expectedFragmentOffset = 0
  const holes = []
  for (i = 0; i < fragments.length; i++) {
    const fragment = fragments[i]
    if (fragment.offset != expectedFragmentOffset) {
      holes.push(expectedFragmentOffset)
    }
    const nextFragmentOffset = fragment.offset + fragment.text.length
    expectedFragmentOffset = nextFragmentOffset
  }
  return holes
}

module.exports = Message

function sortFragmentsByOffset(messageFragments) {
  return messageFragments.sort((messageFragment1, messageFragment2) => messageFragment1.offset - messageFragment2.offset)
}
