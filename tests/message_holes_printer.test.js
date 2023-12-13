const { Buffer } = require('node:buffer');

require("../src/app")
const sequelize = require('../src/sequelize');
const Logger = require("../src/logger")
const ReceivedMessageFragmentProcessor = require("../src/received_message_fragment_processor")
const MessageHolesPrinter = require("../src/message_holes_printer")
const Message = require("../src/models/message");
const { createRawMessageFragment } = require("./helpers")

function process(messageFragment) {
  return ReceivedMessageFragmentProcessor.process(messageFragment)
}

describe("MessageHolesPrinter", () => {
  describe(".print()", () => {
    beforeAll(async function () {
      await sequelize.sync();
    });

    beforeEach(async function () {
      await sequelize.truncate({ cascade: true })
      Logger.clear()
    });

    afterAll(async function () {
      await sequelize.close();
    });

    test("prints the message holes", async () => {
      const messageId = 1
      const messageFragment1Text = "Hello"
      const messageFragment1 = createRawMessageFragment(messageId, messageFragment1Text)
      const messageFragment2Text = " World!"
      const messageFragment2 = createRawMessageFragment(messageId, messageFragment2Text, { previous: messageFragment1 })
      const messageFragment3Text = " How are you?"
      const messageFragment3 = createRawMessageFragment(messageId, messageFragment3Text, { previous: messageFragment2 })
      await process(messageFragment1)
      await process(messageFragment3)
      const message = await Message.findOne({ where: { externalId: messageId } })
      await MessageHolesPrinter.print(message)
      expect(Logger.logLines).toEqual(["Message #1 Hole at: 5"])
    })
  })
})
