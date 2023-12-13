const Message = require("./models/message")
const MessageFragment = require("./models/message_fragment")

Message.hasMany(MessageFragment);
MessageFragment.belongsTo(Message);
