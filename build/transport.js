"use strict";
let __importDefault = (this && this.__importDefault) || function(mod) {
    return (mod && mod.__esModule) ? mod : { default: mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPCTransport = void 0;
const events_1 = __importDefault(require("events"));
const net_1 = require("net");
const path_1 = require("path");
const util_1 = require("./util");
const consts_1 = require("./consts");
function decodeData(socket, cb) {
    let opcode = -1;
    let remaining = 0;
    let data = "";
    socket.on("readable", () => {
        if (!socket.readableLength) { return; }
        util_1.debug(socket.readableLength, "bytes available");
        if (opcode < 0) {
            let header = socket.read(8);
            opcode = header.readInt32LE(0);
            remaining = header.readInt32LE(4);
            util_1.debug("Got header", { opcode, remaining });
            var body = socket.read(remaining);
            remaining -= body.length;
            util_1.debug("Remaining bytes", remaining);
            data += body.toString();
        } else {
            var body = socket.read(remaining);
            remaining -= body.length;
            util_1.debug("Remaining bytes", remaining);
            data += body.toString();
        }
        if (remaining <= 0) {
            util_1.debug("Data complete!", opcode, data);
            cb(opcode, data);
            opcode = -1;
        }
    });
}
class IPCTransport extends events_1.default {
    constructor(instantiatingClient) {
        super();
        this.status = "disconnected";
        this.path = path_1.join((process.platform == "win32" ?
            "\\\\?\\pipe\\" :
            (process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp")), "discord-ipc-");
        this.client = instantiatingClient;
    }
    async connect() {
        util_1.debug("Starting connect");
        if (this.status == "connected") { this.disconnect(); }
        this.status = "connecting";
        for (let attempt = 0; attempt < 10; attempt++) {
            util_1.debug("Connection attempt #" + attempt);
            try {
                return this.socket = await this.establishConnection(this.path + attempt);
            } catch (e) {
                util_1.debug("Connection failed", e);
            }
        }
        this.status = "errored";
        throw new Error("Could not connect to IPC");
    }
    createSocket(path) {
        return new Promise((resolve, reject) => {
            let socket = net_1.createConnection(path, () => {
                this.removeListener("error", reject);
                resolve(socket);
            });
            socket.on("error", reject);
        });
    }
    establishConnection(path) {
        return new Promise(async(resolve, reject) => {
            this.socket = await this.createSocket(path);
            this.writePacket(consts_1.IPCOpcode.FRAME, { v: 1, client_id: this.client.clientId }, this.socket);
            let first = true;
            decodeData(this.socket, (opcode, data) => {
                this.emit("packet", opcode, data);
                if (first) {
                    first = false;
                    if (opcode == consts_1.IPCOpcode.FRAME) {
                        this.writePacket(consts_1.IPCOpcode.FRAME, { v: 1, client_id: this.client.clientId }, this.socket);
                    } else {
                        reject(new Error(data));
                    }
                }
            });
            resolve(this.socket);
            this.socket.on("close", (d) => {
                if (this.status == "connecting") { reject(d); }
                this.disconnect();
            });
        });
    }
    writePacket(opcode, data, socket = this.socket) {
        data = JSON.stringify(data);
        let dlen = Buffer.byteLength(data);
        let buffer = Buffer.alloc(dlen + 8);
        buffer.writeUInt32LE(opcode, 0);
        buffer.writeUInt32LE(dlen, 0);
        buffer.write(data, 4);
        socket.write(buffer);
    }
    disconnect() {
        if (this.socket) { this.socket.destroy(); }
        this.socket = null;
        this.status = "disconnected";
    }
}
exports.IPCTransport = IPCTransport;
// # sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNwb3J0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3RyYW5zcG9ydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxvREFBa0M7QUFDbEMsNkJBQStDO0FBQy9DLCtCQUE0QjtBQUU1QixpQ0FBK0I7QUFDL0IscUNBQXFDO0FBRXJDLFNBQVMsVUFBVSxDQUFDLE1BQWMsRUFBQyxFQUF3QztJQUN2RSxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNoQixJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUM7SUFDbEIsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ2QsTUFBTSxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFO1FBQ3ZCLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYztZQUFFLE9BQU87UUFDbkMsWUFBSyxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUMsaUJBQWlCLENBQUMsQ0FBQTtRQUM5QyxJQUFJLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDWixJQUFJLE1BQU0sR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBVyxDQUFDO1lBQ3RDLE1BQU0sR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQy9CLFNBQVMsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xDLFlBQUssQ0FBQyxZQUFZLEVBQUMsRUFBQyxNQUFNLEVBQUMsU0FBUyxFQUFDLENBQUMsQ0FBQztZQUN2QyxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBVyxDQUFDO1lBQzVDLFNBQVMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQ3pCLFlBQUssQ0FBQyxpQkFBaUIsRUFBQyxTQUFTLENBQUMsQ0FBQztZQUNuQyxJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1NBQzNCO2FBQU07WUFDSCxJQUFJLElB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