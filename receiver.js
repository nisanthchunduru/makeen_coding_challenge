const dgram = require('dgram');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const PORT = 6789;
const ADDRESS = '127.0.0.1';

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

function processUdpMessage(udpMessage) {
  const flags = udpMessage.readUInt16BE(0)
  const messageFragmentTextSize = udpMessage.readUInt16BE(2)
  const messageFragmentOffset = udpMessage.readUInt32BE(4)
  const messageId = udpMessage.readUInt32BE(8)
  const messageFragmentText = udpMessage.toString('utf8', 12, 12 + messageFragmentTextSize);
  messageFragment = {
    flags: flags,
    offset: messageFragmentOffset,
    messageId: messageId,
    size: messageFragmentTextSize,
    text: messageFragmentText.toString()
  }

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

  worker = new Worker(__filename);

  socket.on('message', (udpMessage, metadata) => {
    // worker.postMessage({ udpMessage });
    processUdpMessage(udpMessage)
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
