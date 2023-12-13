const dgram = require('dgram');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const sequelize = require("./src/sequelize")

const ReceivedMessageFragmentProcessor = require("./src/received_udp_message_processor")

const PORT = 6789;
const ADDRESS = '127.0.0.1';
const CONCURRENCY = 4

const Message = require("./models/message")
const MessageFragment = require("./models/message_fragment")

Message.hasMany(MessageFragment);
MessageFragment.belongsTo(Message);

sequelize.sync();

if (isMainThread) {
  const socket = dgram.createSocket('udp4');

  workers = []
  for(i = 0; i < CONCURRENCY; i++) {
    workers.push(new Worker(__filename))
  }

  socket.on('message', (udpMessage, metadata) => {
    const messageFragment = udpMessage
    const messageId = messageFragment.readUInt32BE(8);
    workerNumber = messageId % 4
    worker = workers[workerNumber]
    worker.postMessage({ messageFragment });
  });

  socket.bind({
    address: "localhost",
    port: 6789,
    exclusive: true
  });
} else {
  parentPort.on('message', ({ messageFragment }) => {
    ReceivedMessageFragmentProcessor.receiver(Buffer.from(messageFragment))
  });
}
