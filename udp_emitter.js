/*jslint node: true */
"use strict";

// Imports
var dgram = require("dgram");
var crypto = require("crypto");
var assert = require("assert");

// Globals
var DESTINATION_PORT = 6789;
var DESTINATION_HOST = "127.0.0.1";
var NUM_SOURCE_SOCKETS = 16;
var MESSAGE_MAX_PAYLOAD_SIZE = (1024 * 1024);
var PACKET_MAX_SIZE = 512;
var PACKET_HEADER_SIZE = 12;
var PACKET_MAX_PAYLOAD_SIZE = (PACKET_MAX_SIZE - PACKET_HEADER_SIZE);

Array.prototype.any = function () {
    return this[Math.floor(Math.random() * this.length)];
}

// Generate random sequence of (offset, len) tuples that range input value top
// eg:
// input 10, 3
// output: [(3,1), (0,3), (7,2), (9,1), (4, 3)]
//
function generateRandomSequence(top, max) {
    // generate a list of ranges, decompose iteratively
    var ranges = [[0, top]];
    var node;
    var newNode;
    var offset;
    var newOffset;
    var maxOffset = 0;
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

        if (newNode[0] > maxOffset) {
            maxOffset = newNode[0];
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
        "sequence": outputSequence,
        "maxOffset": maxOffset
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
function sendMessageFragment(sockets, transactionId, packetPayload, offset, isLast, callback) {
    assert(packetPayload.length <= PACKET_MAX_PAYLOAD_SIZE);

    // Determine packet size
    var packetSize = PACKET_HEADER_SIZE + packetPayload.length;

    // Create packet buffer
    var packetBuffer = Buffer.alloc(packetSize);

    // Write the header
    var flags = 0;
    if (isLast) {
        flags = 0x8000;
    }

    packetBuffer.writeUInt16BE(flags, 0);
    packetBuffer.writeUInt16BE(packetPayload.length, 2);
    packetBuffer.writeUInt32BE(offset, 4);
    packetBuffer.writeUInt32BE(transactionId, 8);

    // Append the payload
    packetPayload.copy(packetBuffer, PACKET_HEADER_SIZE);

    // Put the data on the wire, random socket.
    sockets.any().send(packetBuffer, 0, packetBuffer.length, DESTINATION_PORT, DESTINATION_HOST, callback);
}

// Emit buffer payload randomly via UDP socket
//
function sendMessage(sockets, transactionId, payload, randomObject, callback) {
    var count = 0;
    var sequence = randomObject.sequence;
    var maxOffset = randomObject.maxOffset;

    function sendRemainingPackets() {
        var node = sequence[count];
        const [offset, length] = node
        var packetPayload = payload.slice(offset, length);

        var isLast = (offset === maxOffset);
        sendMessageFragment(sockets, transactionId, packetPayload, offset, isLast, function (err) {
            if (err) {
                console.log("Error emitting: " + err);
                callback(err);
            }

            count += 1;
            if (count >= sequence.length) {
                callback(null, count);
            } else {
                sendRemainingPackets();
            }
        });
    }
    sendRemainingPackets();
}

// Emit one payload from [1,MESSAGE_MAX_PAYLOAD_SIZE] randomly
//
function generateAndSendMessage(sockets, transactionId, callback) {
    // create random data payload between 1 byte and MESSAGE_MAX_PAYLOAD_SIZE inclusive
    var payloadSize = Math.floor((Math.random() * MESSAGE_MAX_PAYLOAD_SIZE) + 1);
    var payload = crypto.randomBytes(payloadSize);
    var hash = crypto.createHash("sha256").update(payload);
    var randomObject = generateRandomSequence(payload.length, PACKET_MAX_PAYLOAD_SIZE);

    sendMessage(sockets, transactionId, payload, randomObject, function (err, count) {
        console.log("Emitted message #" + transactionId + " of size:" + payloadSize + " packets:" + count + " sha256:" + hash.digest("hex"));
        callback(err);
    });
}

// Main function
//
function main() {
    var socket;
    var sockets = [];
    var transactionId = 0;
    var count = 1000;
    var i;

    // Emit randomly from NUM_SOURCE_SOCKETS ports.
    // This allows operating systems such as 'linux'
    // to distribute packets across different processes
    // listening on the same port via a hash of the tuple
    // (src_addr, src_port, dst_addr, dst_port)
    // See: https://lwn.net/Articles/542629/
    //
    for (i = 0; i < NUM_SOURCE_SOCKETS; i += 1) {
        socket = dgram.createSocket("udp4");
        socket.bind({
            address: "localhost",
            port: 0,
            exclusive: true
        });
        sockets.push(socket);
    }

    function sendRemainingMessages() {
        transactionId += 1;
        generateAndSendMessage(sockets, transactionId, function (err) {
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
                emitOne();
            }
        });
    }
    sendRemainingMessages();
}

// Entry point
main();
