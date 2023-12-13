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
  if (options.previous) {
    const previousFragmentOffset = options.previous.readUInt32BE(4)
    const previousFragmentTextSize = options.previous.readUInt16BE(2)
    offset = previousFragmentOffset + previousFragmentTextSize
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

module.exports = {
  createRawMessageFragment
}
