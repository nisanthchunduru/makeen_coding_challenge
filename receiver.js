const dgram = require('dgram');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { Sequelize, DataTypes } = require('sequelize')

const PORT = 6789;
const ADDRESS = '127.0.0.1';
const CONCURRENCY = 4

const sequelize = new Sequelize({
  dialect: 'postgres',
  username: 'postgres',
  database: 'receiver_development',
  returning: true
});

const Message = sequelize.define('Message', {
  // id: {
  //   allowNull: false,
  //   autoIncrement: true,
  //   primaryKey: true,
  //   type: Sequelize.INTEGER,
  // },
  senderDesignatedId: {
    allowNull: false,
    type: Sequelize.BIGINT.UNSIGNED,
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

const MessageFragment = sequelize.define('MessageFragment', {
  // id: {
  //   allowNull: false,
  //   autoIncrement: true,
  //   primaryKey: true,
  //   type: Sequelize.INTEGER,
  // },
  offset: {
    allowNull: false,
    type: Sequelize.INTEGER,
  },
  textSize: {
    allowNull: false,
    type: Sequelize.INTEGER,
  },
  text: {
    allowNull: false,
    type: Sequelize.TEXT,
  },
  isLast: {
    allowNull: false,
    type: Sequelize.BOOLEAN,
  },
  // messageId: {
  //   allowNull: false,
  //   type: Sequelize.INTEGER,
  //   references: {
  //     model: 'Messages',
  //     key: 'id',
  //   }
  // },
  // createdAt: {
  //   allowNull: false,
  //   type: Sequelize.DATE,
  // },
  // updatedAt: {
  //   allowNull: false,
  //   type: Sequelize.DATE,
  // }
});

sequelize.sync();

Message.hasMany(MessageFragment);
MessageFragment.belongsTo(Message);

messagesFragments = {}

function sortMessageFragments(messageFragments) {
  return messageFragments.sort((messageFragment1, messageFragment2) => messageFragment1.offset - messageFragment2.offset)
}

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

function printMessage(messageId) {
  messageFragments = messagesFragments[messageId]
  messageFragments = sortMessageFragments(messageFragments)
  message = ""
  messageFragments.forEach(function (messageFragment) {
    message = message + messageFragment.text
  })
  console.log(message + "\n")
}

async function processUdpMessage(udpMessage) {
  const flags = udpMessage.readUInt16BE(0)
  const messageFragmentTextSize = udpMessage.readUInt16BE(2)
  const messageFragmentOffset = udpMessage.readUInt32BE(4)
  const messageId = udpMessage.readUInt32BE(8)
  const messageFragmentText = udpMessage.toString('utf8', 12, 12 + messageFragmentTextSize);
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

  console.log(message)
  console.log(message.id)

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
    printMessage(messageId)
  }

  return true
}

if (isMainThread) {
  const socket = dgram.createSocket('udp4');

  workers = []
  for(i = 0; i < CONCURRENCY; i++) {
    workers.push(new Worker(__filename))
  }

  socket.on('message', (udpMessage, metadata) => {
    const messageId = udpMessage.readUInt32BE(8);
    workerNumber = messageId % 4
    worker = workers[workerNumber]
    worker.postMessage({ udpMessage });
  });

  socket.bind({
    address: "localhost",
    port: 6789,
    exclusive: true
  });
} else {
  parentPort.on('message', ({ udpMessage }) => {
    const buffer = Buffer.from(udpMessage);
    processUdpMessage(buffer)
  });
}
