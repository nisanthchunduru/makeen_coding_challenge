/*jslint node: true */
"use strict";

// Imports
var dgram = require("dgram");
var crypto = require("crypto");
var getlorem = require("getlorem")
var assert = require("assert");

// Globals
var DESTINATION_PORT = 6789;
var DESTINATION_HOST = "127.0.0.1";
var SOCKET_POOL_SIZE = 16;
// var MESSAGE_MAX_SIZE = (1024 * 1024);
var MESSAGE_MAX_SIZE = 2048;
var MESSAGE_FRAGMENT_PACKET_MAX_SIZE = 512;
var MESSAGE_FRAGMENT_PACKET_HEADER_SIZE = 12;
var MESSAGE_FRAGMENT_MAX_SIZE = (MESSAGE_FRAGMENT_PACKET_MAX_SIZE - MESSAGE_FRAGMENT_PACKET_HEADER_SIZE);

Array.prototype.any = function () {
    return this[Math.floor(Math.random() * this.length)];
}

// Generate random sequence of (offset, len) tuples that range input value top
// eg:
// input 10, 3
// output: [(3,1), (0,3), (7,2), (9,1), (4, 3)]
//
function fragmentMessage(top, max) {
    // generate a list of ranges, decompose iteratively
    var ranges = [[0, top]];
    var node;
    var newNode;
    var offset;
    var newOffset;
    var lastMessageFragmentOffset = 0;
    var outputSequence = [];

    while (ranges.length > 0) {
        // split on random range offset
        offset = Math.floor(Math.random() * ranges.length);

        // grab the target node
        node = ranges[offset];

        // split a random node
        newOffset = Math.floor(Math.random() * node[1]);
        newNode = [node[0] + newOffset, node[1] - newOffset];

        // limit size to max
        if (newNode[1] > max) {
            // insert new node
            ranges.splice(offset + 1, 0, [newNode[0] + max, newNode[1] - max]);
            // fix up size of new node
            newNode[1] = max;
        }

        // emit the node
        outputSequence.push(newNode);

        if (newNode[0] > lastMessageFragmentOffset) {
            lastMessageFragmentOffset = newNode[0];
        }

        // split or remove old node
        if (newOffset === 0) {
            // remove original node
            ranges.splice(offset, 1);

        } else {
            // must trim node
            node[1] = newOffset;
        }
    }

    return {
        "list": outputSequence,
        "lastMessageFragmentOffset": lastMessageFragmentOffset
    };
}

// Emit UDP packet to DESTINATION_HOST:DESTINATION_PORT
// Packet Structure
// Flags   uint16_t  BE  (high bit indicates EOF)
// DataSize  uint16_t  BE
// Offset  uint32_t  BE
// TransactionID uint32_t  BE
// Data    N DataSize Bytes
//
function sendMessageFragment(sockets, messageId, packetPayload, offset, isLast, callback) {
    assert(packetPayload.length <= MESSAGE_FRAGMENT_MAX_SIZE);

    // Determine packet size
    var packetSize = MESSAGE_FRAGMENT_PACKET_HEADER_SIZE + packetPayload.length;

    // Create packet buffer
    var buffer = Buffer.alloc(packetSize);

    // Write the header
    var flags = 0;
    if (isLast) {
        flags = 0x8000;
    }

    buffer.writeUInt16BE(flags, 0);
    buffer.writeUInt16BE(packetPayload.length, 2);
    buffer.writeUInt32BE(offset, 4);
    buffer.writeUInt32BE(messageId, 8);

    // Append the payload
    // packetPayload.copy(buffer, MESSAGE_FRAGMENT_PACKET_HEADER_SIZE);
    buffer.write(packetPayload, 12)

    // Put the data on the wire, random socket.
    sockets.any().send(buffer, 0, buffer.length, DESTINATION_PORT, DESTINATION_HOST, callback);
}

// Emit buffer payload randomly via UDP socket
//
function sendMessage(sockets, messageId, message, messageFragments, callback) {
    var count = 0;
    var messageFragmentsList = messageFragments.list;
    var lastMessageFragmentOffset = messageFragments.lastMessageFragmentOffset;

    function sendRemainingPackets() {
        var messageFragment = messageFragmentsList[count];
        const [offset, size] = messageFragment
        var messageFragment = message.slice(offset, offset + size);

        var isLast = (offset === lastMessageFragmentOffset);
        sendMessageFragment(sockets, messageId, messageFragment, offset, isLast, function (err) {
            if (err) {
                console.log("Error emitting: " + err);
                callback(err);
            }

            count += 1;
            if (count >= messageFragmentsList.length) {
                callback(null, count);
            } else {
                sendRemainingPackets();
            }
        });
    }
    sendRemainingPackets();
}

// Emit one payload from [1,MESSAGE_MAX_SIZE] randomly
//
function generateAndSendMessage(sockets, messageId, callback) {
    // create random data payload between 1 byte and MESSAGE_MAX_SIZE inclusive
    // var messageSize = Math.floor((Math.random() * MESSAGE_MAX_SIZE) + 1);
    var messageSize = MESSAGE_MAX_SIZE
    // var payload = crypto.randomBytes(payloadSize);
    var message = getlorem.bytes(messageSize);
    var hash = crypto.createHash("sha256").update(message);
    var messageFragments = fragmentMessage(message.length, MESSAGE_FRAGMENT_MAX_SIZE);

    sendMessage(sockets, messageId, message, messageFragments, function (err, count) {
        console.log("Emitted message #" + messageId + " of size:" + message.length + " packets:" + count + " sha256:" + hash.digest("hex"));
        callback(err);
    });
}

function generateRandomUInt32() {
    const buffer = crypto.randomBytes(4);
    return buffer.readUInt32LE();
}

// Main function
//
function main() {
    var socket;
    var sockets = [];
    var messageId = 0;
    // var count = 1000;
    var count = 1
    var i;

    // Emit randomly from SOCKET_POOL_SIZE ports.
    // This allows operating systems such as 'linux'
    // to distribute packets across different processes
    // listening on the same port via a hash of the tuple
    // (src_addr, src_port, dst_addr, dst_port)
    // See: https://lwn.net/Articles/542629/
    //
    for (i = 0; i < SOCKET_POOL_SIZE; i += 1) {
        socket = dgram.createSocket("udp4");
        socket.bind({
            address: "localhost",
            port: 0,
            exclusive: true
        });
        sockets.push(socket);
    }

    function sendRemainingMessages() {
        messageId = generateRandomUInt32()
        generateAndSendMessage(sockets, messageId, function (err) {
            if (err) {
                console.log("Fail: " + err);
                throw err;
            }

            count -= 1;
            if (count === 0) {
                sockets.forEach(function (socket) {
                    socket.close();
                });
            } else {
                sendRemainingMessages();
            }
        });
    }
    sendRemainingMessages();
}

// Entry point
main();
