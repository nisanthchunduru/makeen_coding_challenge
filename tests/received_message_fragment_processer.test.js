const { Buffer } = require('node:buffer');

const Logger = require("../src/logger")

const ReceivedMessageFragmentProcessor = require("../src/received_message_fragment_processor")
const sequelize = require("../src/sequelize")

function createRawMessageFragment(messageId, text, options = {}) {
  const headerSize = 12 * 8 // 12 bytes * 8 bytes
  const size = headerSize + text.length
  const rawMessageFragment = Buffer.alloc(size)
  let flags;
  if (options.last) {
    flags = 0x8000
  } else {
    flags = 0
  }
  let offset;
  if (options.previousFragments) {
    offset = options.previousFragments.reduce((offset, previousFragment) => {
      const previousFragmentTextSize = previousFragment.length - headerSize
      return offset + previousFragmentTextSize
    }, 0)
  } else {
    offset = 0
  }
  rawMessageFragment.writeUInt16BE(flags, 0)
  rawMessageFragment.writeUInt16BE(text.length, 2)
  rawMessageFragment.writeUInt32BE(offset, 4)
  rawMessageFragment.writeUInt32BE(messageId, 8)
  rawMessageFragment.write(text, 12)

  return rawMessageFragment
}

function process(messageFragment) {
  return ReceivedMessageFragmentProcessor.process(messageFragment)
}

describe("ReceivedMessageFragmentProcessor", () => {
  describe(".process()", () => {
    beforeAll(async function () {
      await sequelize.sync()
      await sequelize.truncate()
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

    describe("all of a message's fragments are received", () => {
      test("prints a message summary to STDOUT", async () => {
        const messageId = 1
        const messageFragment1 = createRawMessageFragment(messageId, "Hello")
        const messageFragment2 = createRawMessageFragment(messageId, " world!", { previousFragments: [messageFragment1], last: true })

        await process(messageFragment1)
        await process(messageFragment2)

        const expectedLogLine = 'Message #1 size:12 sha256:c0535e4be2b79ffd93291305436bf889314e4a3faec05ecffcbb7df31ad9e51a'
        expect(Logger.logLines[0]).toEqual(expectedLogLine)

        return true
      })
    })

    describe("all of a message's fragments have not been received", () => {
      test("prints a message summary to STDOUT", async () => {
        const messageId = 1
        const messageFragment1 = createRawMessageFragment(messageId, "Hello")
        const messageFragment2 = createRawMessageFragment(messageId, " world!", { previousFragments: [messageFragment1]})

        await process(messageFragment1)
        await process(messageFragment2)

        expect(Logger.logLines.length).toEqual(0)

        return true
      })
    })
  })
})
