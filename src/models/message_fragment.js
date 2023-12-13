const sequelize = require('../sequelize')
const { Sequelize } = require("sequelize")

const MessageFragment = sequelize.define(
  'MessageFragment',
  {
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
    createdAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE,
    }
  },
  {
    indexes: [
      {
        fields: ["offset", "MessageId"],
        unique: true,
        name: "index_on_MessageId_and_offset"
      }
    ]
  }
);

module.exports = MessageFragment
