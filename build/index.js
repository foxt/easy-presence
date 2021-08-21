"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipcClient = void 0;
const consts_1 = require("./consts");
const util_1 = require("./util");
const events_1 = __importDefault(require("events"));
const net_1 = require("net");
const path_1 = require("path");
function decodeData(socket, onPacket) {
    let opcode = -1;
    let remaining = 0;
    let data = "";
    socket.on("readable", () => {
        if (!socket.readableLength)
            return;
        util_1.debug(socket.readableLength, "bytes available");
        if (opcode < 0) {
            const header = socket.read(8);
            opcode = header.readInt32LE(0);
            remaining = header.readInt32LE(4);
            util_1.debug("Got header", { opcode, remaining });
            const body = socket.read(remaining);
            remaining -= body.length;
            util_1.debug("Remaining bytes", remaining);
            data += body.toString();
        }
        else {
            const body = socket.read(remaining);
            remaining -= body.length;
            util_1.debug("Remaining bytes", remaining);
            data += body.toString();
        }
        if (remaining <= 0) {
            // debug("Data complete!", opcode, data);
            onPacket(opcode, data);
            opcode = -1;
            data = "";
        }
    });
}
class ipcClient extends events_1.default {
    constructor(clientId) {
        super();
        this.status = "disconnected";
        this.path = path_1.join((process.platform == "win32" ?
            "\\\\?\\pipe\\" :
            (process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp")), "discord-ipc-");
        this.currentPresence = undefined;
        this.queuedPresence = false;
        this.cooldown = false;
        this.scheduledReconnect = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.waiting = new Map();
        util_1.debug("Instantiated with ", clientId);
        this.clientId = clientId;
        this.on("disconnect", () => {
            if (this.currentPresence && !this.scheduledReconnect && (this.status == "errored" || this.status == "disconnected")) {
                this.scheduledReconnect = true;
                setTimeout((() => this.connect()).bind(this), 5000);
            }
        });
        this.connect().catch(() => { });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit(eventName, ...args) {
        util_1.debug(eventName, ...args);
        return super.emit(eventName, ...args);
    }
    async connect() {
        util_1.debug("Starting connect");
        this.scheduledReconnect = false;
        if (this.status == "connected")
            return this.socket;
        this.status = "connecting";
        try {
            this.emit("connecting");
        }
        catch (e) { }
        for (let attempt = 0; attempt < 10; attempt++) {
            util_1.debug("Connection attempt #" + attempt);
            try {
                this.socket = await this.establishConnection(this.path + attempt);
                util_1.debug("Connection success!");
                this.status = "connected";
                try {
                    this.emit("connected");
                }
                catch (e) {
                    console.error(e);
                }
                return this.socket;
            }
            catch (e) {
                util_1.debug("Connection failed", e);
            }
        }
        this.status = "errored";
        try {
            this.emit("disconnected");
        }
        catch (e) {
            console.error(e);
        }
        throw new Error("Could not connect to IPC");
    }
    createSocket(path) {
        return new Promise((resolve, reject) => {
            try {
                util_1.debug("Attempting to connect to ", path);
                const socket = net_1.createConnection(path, () => {
                    util_1.debug("Connected to ", path);
                    this.removeListener("error", reject);
                    resolve(socket);
                });
                socket.on("error", reject);
            }
            catch (e) {
                util_1.debug("Failed to connect to", path, e);
                reject(e);
            }
        });
    }
    establishConnection(path) {
        return new Promise(async (resolve, reject) => {
            try {
                this.socket = await this.createSocket(path);
                util_1.debug("Writing handshake");
                this.writePacket(consts_1.IPCOpcode.HANDSHAKE, { v: 1, client_id: this.clientId }, this.socket);
                let first = true;
                decodeData(this.socket, (opcode, data) => {
                    try {
                        this.emit("packet", opcode, data);
                    }
                    catch (e) {
                        console.error(e);
                    }
                    if (first) {
                        util_1.debug("First packet", opcode);
                        first = false;
                        if (opcode == consts_1.IPCOpcode.FRAME) {
                            this.environment = JSON.parse(data).data;
                            resolve(this.socket);
                        }
                        else {
                            reject(new Error(data));
                        }
                    }
                    else if (opcode == consts_1.IPCOpcode.FRAME) {
                        const j = JSON.parse(data);
                        util_1.debug("Got frame", j);
                        try {
                            this.emit(j.cmd, j);
                        }
                        catch (e) {
                            console.error(e);
                        }
                        if (j.nonce && this.waiting.has(j.nonce)) {
                            this.waiting.get(j.nonce)(data);
                            this.waiting.delete(j.nonce);
                        }
                    }
                });
                this.socket.on("close", () => {
                    if (first)
                        reject(new Error("Connection closed."));
                    this.disconnect();
                });
            }
            catch (e) {
                util_1.debug("Error establishing connection to ", path, e);
                reject(e);
            }
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    writePacket(opcode, data, socket = this.socket) {
        data = JSON.stringify(data);
        const dlen = Buffer.byteLength(data);
        const buffer = Buffer.alloc(dlen + 8);
        buffer.writeUInt32LE(opcode, 0);
        buffer.writeUInt32LE(dlen, 4);
        buffer.write(data, 8);
        console.log(buffer);
        return socket.write(buffer);
    }
    disconnect() {
        if (this.socket)
            this.socket.destroy();
        try {
            this.emit("disconnected");
        }
        catch (e) {
            console.error(e);
        }
        this.socket = null;
        this.status = "disconnected";
    }
    async setActivity(presence) {
        if (this.cooldown) {
            this.currentPresence = presence;
            this.queuedPresence = true;
            return;
        }
        this.cooldown = true;
        try {
            if (presence && this.status != "connected")
                await this.connect();
            if (presence && this.status != "connected")
                throw new Error("Status did not become connected.");
            if (this.status == "connected") {
                // eslint-disable-next-line @typescript-eslint/ban-types
                const payload = { pid: process.pid };
                if (presence) {
                    if (presence.timestamps) {
                        if (presence.timestamps.end instanceof Date)
                            presence.timestamps.end = presence.timestamps.end.getTime();
                        if (presence.timestamps.start instanceof Date)
                            presence.timestamps.start = presence.timestamps.start.getTime();
                    }
                    payload.activity = presence;
                }
                this.request("SET_ACTIVITY", payload);
            }
        }
        catch (e) {
            // console operations in a library are not great, however i don't really want to cause an exception.
            console.warn("EasyPresence couldn't set activity. Trying again in a few.", e);
            setTimeout(() => {
                this.cooldown = false;
                this.scheduledReconnect = true;
                this.setActivity(presence);
            }, 5000);
        }
        setTimeout((() => {
            this.cooldown = false;
            if (this.queuedPresence) {
                this.queuedPresence = false;
                this.setActivity(this.currentPresence);
            }
        }).bind(this), 15000);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    request(cmd, args, evt) {
        let uuid = "";
        for (let i = 0; i < 32; i += 1) {
            if (i === 8 || i === 12 || i === 16 || i === 20) {
                uuid += "-";
            }
            let n;
            if (i === 12) {
                n = 4;
            }
            else {
                const random = Math.random() * 16 | 0;
                if (i === 16) {
                    n = (random & 3) | 0;
                }
                else {
                    n = random;
                }
            }
            uuid += n.toString(16);
        }
        return new Promise((a, r) => {
            if (!this.writePacket(consts_1.IPCOpcode.FRAME, { cmd, args, evt, nonce: uuid }))
                return r(new Error("Couldn't write."));
            this.waiting.set(uuid, (data) => a(data.data));
        });
    }
}
exports.ipcClient = ipcClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEscUNBQXFGO0FBQ3JGLGlDQUErQjtBQUMvQixvREFBa0M7QUFDbEMsNkJBQStDO0FBQy9DLCtCQUE0QjtBQUU1QixTQUFTLFVBQVUsQ0FBQyxNQUFjLEVBQUUsUUFBZ0Q7SUFDaEYsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDaEIsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0lBQ2xCLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNkLE1BQU0sQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRTtRQUN2QixJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWM7WUFBRSxPQUFPO1FBQ25DLFlBQUssQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDaEQsSUFBSSxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ1osTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQVcsQ0FBQztZQUN4QyxNQUFNLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMvQixTQUFTLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNsQyxZQUFLLENBQUMsWUFBWSxFQUFFLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFDM0MsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQVcsQ0FBQztZQUM5QyxTQUFTLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUN6QixZQUFLLENBQUMsaUJBQWlCLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDcEMsSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUMzQjthQUFNO1lBQ0gsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQVcsQ0FBQztZQUM5QyxTQUFTLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUN6QixZQUFLLENBQUMsaUJBQWlCLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDcEMsSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUMzQjtRQUVELElBQUksU0FBUyxJQUFJLENBQUMsRUFBRTtZQUNoQix5Q0FBeUM7WUFDekMsUUFBUSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN2QixNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDWixJQUFJLEdBQUcsRUFBRSxDQUFDO1NBQ2I7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUM7QUFpQkQsTUFBYSxTQUFVLFNBQVEsZ0JBQVk7SUFvQnZDLFlBQVksUUFBZ0I7UUFDeEIsS0FBSyxFQUFFLENBQUM7UUFsQlosV0FBTSxHQUE0RCxjQUFjLENBQUM7UUFDakYsU0FBSSxHQUFHLFdBQUksQ0FDUCxDQUFDLE9BQU8sQ0FBQyxRQUFRLElBQUksT0FBTyxDQUFDLENBQUM7WUFDMUIsZUFBZSxDQUFDLENBQUM7WUFDakIsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxNQUFNLENBQUMsQ0FDdkcsRUFDRCxjQUFjLENBQ2pCLENBQUU7UUFFSCxvQkFBZSxHQUF5QixTQUFTLENBQUM7UUFDbEQsbUJBQWMsR0FBRyxLQUFLLENBQUM7UUFDdkIsYUFBUSxHQUFHLEtBQUssQ0FBQztRQUNqQix1QkFBa0IsR0FBRyxLQUFLLENBQUM7UUFDM0IsOERBQThEO1FBQzlELFlBQU8sR0FBb0MsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUtqRCxZQUFLLENBQUMsb0JBQW9CLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDdEMsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFO1lBQ3ZCLElBQUksSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksU0FBUyxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksY0FBYyxDQUFDLEVBQUU7Z0JBQ2pILElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7Z0JBQy9CLFVBQVUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQzthQUN2RDtRQUNMLENBQUMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRSxDQUFDLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBQ0QsOERBQThEO0lBQzlELElBQUksQ0FBQyxTQUEwQixFQUFFLEdBQUcsSUFBVztRQUMzQyxZQUFLLENBQUMsU0FBUyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDMUIsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFDRCxLQUFLLENBQUMsT0FBTztRQUNULFlBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQzFCLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxLQUFLLENBQUM7UUFDaEMsSUFBSSxJQUFJLENBQUMsTUFBTSxJQUFJLFdBQVc7WUFBRSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDbkQsSUFBSSxDQUFDLE1BQU0sR0FBRyxZQUFZLENBQUM7UUFDM0IsSUFBSTtZQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7U0FBRTtRQUFDLE9BQU8sQ0FBQyxFQUFFLEdBQUU7UUFDN0MsS0FBSyxJQUFJLE9BQU8sR0FBRyxDQUFDLEVBQUUsT0FBTyxHQUFHLEVBQUUsRUFBRSxPQUFPLEVBQUUsRUFBRTtZQUMzQyxZQUFLLENBQUMsc0JBQXNCLEdBQUcsT0FBTyxDQUFDLENBQUM7WUFDeEMsSUFBSTtnQkFDQSxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLENBQUM7Z0JBQ2xFLFlBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO2dCQUM3QixJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQztnQkFDMUIsSUFBSTtvQkFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2lCQUFFO2dCQUFDLE9BQU8sQ0FBQyxFQUFFO29CQUN0QyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUNwQjtnQkFDRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7YUFDdEI7WUFBQyxPQUFPLENBQUMsRUFBRTtnQkFDUixZQUFLLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDLENBQUM7YUFDakM7U0FDSjtRQUNELElBQUksQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDO1FBQ3hCLElBQUk7WUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1NBQUU7UUFBQyxPQUFPLENBQUMsRUFBRTtZQUN6QyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3BCO1FBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFFRCxZQUFZLENBQUMsSUFBVztRQUNwQixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ25DLElBQUk7Z0JBQ0EsWUFBSyxDQUFDLDJCQUEyQixFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUN6QyxNQUFNLE1BQU0sR0FBRyxzQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO29CQUN2QyxZQUFLLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFDO29CQUM3QixJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztvQkFDckMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNwQixDQUFDLENBQUMsQ0FBQztnQkFDSCxNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQzthQUM5QjtZQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUNSLFlBQUssQ0FBQyxzQkFBc0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNiO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRUQsbUJBQW1CLENBQUMsSUFBVztRQUMzQixPQUFPLElBQUksT0FBTyxDQUFDLEtBQUssRUFBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDeEMsSUFBSTtnQkFDQSxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDNUMsWUFBSyxDQUFDLG1CQUFtQixDQUFDLENBQUM7Z0JBQzNCLElBQUksQ0FBQyxXQUFXLENBQUMsa0JBQVMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUN2RixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUM7Z0JBQ2pCLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxFQUFFO29CQUNyQyxJQUFJO3dCQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztxQkFBRTtvQkFBQyxPQUFPLENBQUMsRUFBRTt3QkFDakQsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztxQkFDcEI7b0JBQ0QsSUFBSSxLQUFLLEVBQUU7d0JBQ1AsWUFBSyxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsQ0FBQzt3QkFDOUIsS0FBSyxHQUFHLEtBQUssQ0FBQzt3QkFDZCxJQUFJLE1BQU0sSUFBSSxrQkFBUyxDQUFDLEtBQUssRUFBRTs0QkFDM0IsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQzs0QkFDekMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQzt5QkFDeEI7NkJBQU07NEJBQ0gsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7eUJBQzNCO3FCQUNKO3lCQUFNLElBQUksTUFBTSxJQUFJLGtCQUFTLENBQUMsS0FBSyxFQUFFO3dCQUNsQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUMzQixZQUFLLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUN0QixJQUFJOzRCQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQzt5QkFBRTt3QkFBQyxPQUFPLENBQUMsRUFBRTs0QkFDbkMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzt5QkFDcEI7d0JBQ0QsSUFBSSxDQUFDLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTs0QkFDdEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDOzRCQUNoQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7eUJBQ2hDO3FCQUNKO2dCQUNMLENBQUMsQ0FBQyxDQUFDO2dCQUVILElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUU7b0JBQ3pCLElBQUksS0FBSzt3QkFBRSxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO29CQUNuRCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ3RCLENBQUMsQ0FBQyxDQUFDO2FBQ047WUFBQyxPQUFPLENBQUMsRUFBRTtnQkFDUixZQUFLLENBQUMsbUNBQW1DLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNwRCxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDYjtRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVELGlIQUFpSDtJQUNqSCxXQUFXLENBQUMsTUFBaUIsRUFBRSxJQUFTLEVBQUUsU0FBaUIsSUFBSSxDQUFDLE1BQU07UUFDbEUsSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDNUIsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQyxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN0QyxNQUFNLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNoQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM5QixNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN0QixPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BCLE9BQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRUQsVUFBVTtRQUNOLElBQUksSUFBSSxDQUFDLE1BQU07WUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3ZDLElBQUk7WUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1NBQUU7UUFBQyxPQUFPLENBQUMsRUFBRTtZQUN6QyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3BCO1FBQ0QsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7UUFDbkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxjQUFjLENBQUM7SUFDakMsQ0FBQztJQUdELEtBQUssQ0FBQyxXQUFXLENBQUMsUUFBOEI7UUFDNUMsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ2YsSUFBSSxDQUFDLGVBQWUsR0FBRyxRQUFRLENBQUM7WUFDaEMsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7WUFDM0IsT0FBTztTQUNWO1FBQ0QsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFDckIsSUFBSTtZQUNBLElBQUksUUFBUSxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksV0FBVztnQkFBRSxNQUFNLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNqRSxJQUFJLFFBQVEsSUFBSSxJQUFJLENBQUMsTUFBTSxJQUFJLFdBQVc7Z0JBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO1lBQ2hHLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxXQUFXLEVBQUU7Z0JBQzVCLHdEQUF3RDtnQkFDeEQsTUFBTSxPQUFPLEdBQXFDLEVBQUUsR0FBRyxFQUFFLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDdkUsSUFBSSxRQUFRLEVBQUU7b0JBQ1YsSUFBSSxRQUFRLENBQUMsVUFBVSxFQUFFO3dCQUNyQixJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsR0FBRyxZQUFZLElBQUk7NEJBQUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEdBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxHQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQ25ILElBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLFlBQVksSUFBSTs0QkFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLEtBQUssR0FBSSxRQUFRLENBQUMsVUFBVSxDQUFDLEtBQWMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztxQkFDNUg7b0JBQ0QsT0FBTyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7aUJBQy9CO2dCQUNELElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2FBQ3pDO1NBQ0o7UUFBQyxPQUFPLENBQUMsRUFBRTtZQUNSLG9HQUFvRztZQUNwRyxPQUFPLENBQUMsSUFBSSxDQUFDLDREQUE0RCxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzlFLFVBQVUsQ0FBQyxHQUFHLEVBQUU7Z0JBQ1osSUFBSSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUM7Z0JBQ3RCLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7Z0JBQy9CLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDL0IsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ1o7UUFDRCxVQUFVLENBQUMsQ0FBQyxHQUFHLEVBQUU7WUFDYixJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztZQUN0QixJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUU7Z0JBQ3JCLElBQUksQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDO2dCQUM1QixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQzthQUMxQztRQUNMLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMxQixDQUFDO0lBRUQsaUhBQWlIO0lBQ2pILE9BQU8sQ0FBQyxHQUFXLEVBQUUsSUFBVSxFQUFFLEdBQVk7UUFDekMsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ2QsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQzVCLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsRUFBRTtnQkFDN0MsSUFBSSxJQUFJLEdBQUcsQ0FBQzthQUNmO1lBQ0QsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUU7Z0JBQ1YsQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUNUO2lCQUFNO2dCQUNILE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUN0QyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUU7b0JBQ1YsQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztpQkFDeEI7cUJBQU07b0JBQ0gsQ0FBQyxHQUFHLE1BQU0sQ0FBQztpQkFDZDthQUNKO1lBQ0QsSUFBSSxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDMUI7UUFDRCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGtCQUFTLENBQUMsS0FBSyxFQUFFLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDO2dCQUFFLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztZQUNoSCxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7Q0FDSjtBQXBORCw4QkFvTkMifQ==