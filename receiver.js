const dgram = require('dgram');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

require("./src/app")
const sequelize = require("./src/sequelize")
// await sequelize.sync()
sequelize.sync()
const ReceivedMessageFragmentProcessor = require("./src/received_message_fragment_processor");

const PORT = 6789;
const ADDRESS = '127.0.0.1';
const CONCURRENCY = 4

if (isMainThread) {
  const socket = dgram.createSocket('udp4');

  messageFragmentProcessorThreads = []
  for(i = 0; i < CONCURRENCY; i++) {
    messageFragmentProcessorThreads.push(new Worker(__filename))
  }

  socket.on('message', (udpMessage, metadata) => {
    const messageFragment = udpMessage
    const messageId = messageFragment.readUInt32BE(8);
    messageFragmentProcessNumber = messageId % 4
    messageFragmentProcessor = messageFragmentProcessorThreads[messageFragmentProcessNumber]
    messageFragmentProcessor.postMessage({ messageFragment });
  });

  socket.bind({
    address: "localhost",
    port: 6789,
    exclusive: true
  });
} else {
  parentPort.on('message', ({ messageFragment }) => {
    ReceivedMessageFragmentProcessor.process(Buffer.from(messageFragment))
  });
}
