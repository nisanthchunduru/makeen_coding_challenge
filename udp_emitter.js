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
var PACKET_MAX_SIZE = 512;
var PACKET_HEADER_SIZE = 12;
var PACKET_MAX_DATA_SIZE = (PACKET_MAX_SIZE - PACKET_HEADER_SIZE);
var MAX_PAYLOAD_SIZE = (1024 * 1024);

Array.prototype.getRandomElement = function () {
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
function emitPacket(sockets, transactionId, data, offset, isLast, callback) {
    assert(data.length <= PACKET_MAX_DATA_SIZE);

    // Determine packet size
    var packetSize = PACKET_HEADER_SIZE + data.length;

    // Create packet buffer
    var packetBuffer = Buffer.alloc(packetSize);

    // Write the header
    var flags = 0;
    if (isLast) {
        flags = 0x8000;
    }

    packetBuffer.writeUInt16BE(flags, 0);
    packetBuffer.writeUInt16BE(data.length, 2);
    packetBuffer.writeUInt32BE(offset, 4);
    packetBuffer.writeUInt32BE(transactionId, 8);

    // Append the payload
    data.copy(packetBuffer, PACKET_HEADER_SIZE);

    // Put the data on the wire, random socket.
    sockets.getRandomElement().send(packetBuffer, 0, packetBuffer.length, DESTINATION_PORT, DESTINATION_HOST, callback);
}

// Emit buffer payload randomly via UDP socket
//
function emitRandom(sockets, transactionId, payload, randomObject, callback) {
    var count = 0;
    var sequence = randomObject.sequence;
    var maxOffset = randomObject.maxOffset;

    function sendOne() {
        var node = sequence[count];
        var data = payload.slice(node[0], node[1] + node[0]);

        var isLast = (node[0] === maxOffset);
        emitPacket(sockets, transactionId, data, node[0], isLast, function (err) {
            if (err) {
                console.log("Error emitting: " + err);
                callback(err);
            }

            count += 1;
            if (count >= sequence.length) {
                callback(null, count);
            } else {
                sendOne();
            }
        });
    }

    sendOne();
}

// Emit one payload from [1,MAX_PAYLOAD_SIZE] randomly
//
function emitPayload(sockets, transactionId, callback) {
    // create random data payload between 1 byte and MAX_PAYLOAD_SIZE inclusive
    var dataSize = Math.floor((Math.random() * MAX_PAYLOAD_SIZE) + 1);
    var payload = crypto.randomBytes(dataSize);
    var hash = crypto.createHash("sha256").update(payload);
    var randomObject = generateRandomSequence(payload.length, PACKET_MAX_DATA_SIZE);

    emitRandom(sockets, transactionId, payload, randomObject, function (err, count) {
        console.log("Emitted message #" + transactionId + " of size:" + dataSize + " packets:" + count + " sha256:" + hash.digest("hex"));
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

    function emitOne() {
        transactionId += 1;
        emitPayload(sockets, transactionId, function (err) {
            if (err) {
                console.log("Fail: " + err);
                throw err;
            }

            count -= 1;
            if (count === 0) {
                sockets.forEach(function (s) {
                    s.close();
                });
            } else {
                emitOne();
            }
        });
    }

    emitOne();
}

// Entry point
main();
