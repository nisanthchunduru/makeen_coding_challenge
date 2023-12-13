const { Buffer } = require('node:buffer');

require("../src/app")

const sequelize = require('../src/sequelize');
const Logger = require("../src/logger")
const ReceivedMessageFragmentProcessor = require("../src/received_message_fragment_processor");
const Message = require("../src/models/message");
const { createRawMessageFragment } = require("./helpers")

function process(messageFragment) {
  return ReceivedMessageFragmentProcessor.process(messageFragment)
}

describe("ReceivedMessageFragmentProcessor", () => {
  describe(".process()", () => {
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

    test("stores the message fragment", async () => {
      const messageId = 1
      const messageFragmentText = "Hello"
      const messageFragment = createRawMessageFragment(messageId, messageFragmentText)
      await process(messageFragment)
    })

    describe("message fragment is a duplicate", () => {
      test("ignores the message fragment", async () => {
        const messageId = 1
        const messageFragmentText = "Hello"
        const messageFragment = createRawMessageFragment(messageId, messageFragmentText)
        await process(messageFragment)
        await process(messageFragment)
      })
    })

    describe("all fragments of a message are received", () => {
      test("marks the message as complete", async () => {
        const messageId = 1
        const messageFragment1 = createRawMessageFragment(messageId, "Hello")
        const messageFragment2 = createRawMessageFragment(messageId, " world!", { previous: messageFragment1, last: true })

        await process(messageFragment1)
        await process(messageFragment2)

        const message = await Message.findOne({ where: { externalId: messageId } })
        expect(message.complete).toEqual(true)

        return true
      })

      test("prints a summary of the message to STDOUT", async () => {
        const messageId = 1
        const messageFragment1 = createRawMessageFragment(messageId, "Hello")
        const messageFragment2 = createRawMessageFragment(messageId, " world!", { previous: messageFragment1, last: true })

        await process(messageFragment1)
        await process(messageFragment2)

        const expectedLogLine = 'Message #1 size:12 sha256:c0535e4be2b79ffd93291305436bf889314e4a3faec05ecffcbb7df31ad9e51a'
        expect(Logger.logLines[0]).toEqual(expectedLogLine)

        return true
      })
    })

    describe("all fragments of a message are not received", () => {
      test("doesn't print a summary of the message to STDOUT", async () => {
        const messageId = 1
        const messageFragment1 = createRawMessageFragment(messageId, "Hello")
        const messageFragment2 = createRawMessageFragment(messageId, " world!", { previous: messageFragment1 })

        await process(messageFragment1)
        await process(messageFragment2)

        expect(Logger.logLines.length).toEqual(0)

        return true
      })
    })
  })
})
