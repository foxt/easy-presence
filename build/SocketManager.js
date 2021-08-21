"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketManager = void 0;
const path_1 = require("path");
const BaseEventEmitter_1 = require("./BaseEventEmitter");
const consts_1 = require("./consts");
const DiscordSocket_1 = require("./DiscordSocket");
const util_1 = require("./util");
class SocketManager extends BaseEventEmitter_1.BaseEventEmitter {
    constructor(clientId) {
        super(clientId);
        this.status = "disconnected";
        this.path = path_1.join((process.platform == "win32" ?
            "\\\\?\\pipe\\" :
            (process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp")), "discord-ipc-");
        this.currentPresence = undefined;
        this.scheduledReconnect = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.waiting = new Map();
        this.on("disconnect", () => {
            if (this.currentPresence && !this.scheduledReconnect && (this.status == "errored" || this.status == "disconnected")) {
                this.scheduledReconnect = true;
                setTimeout((() => this.connect()).bind(this), 5000);
            }
        });
        this.connect().catch(() => { });
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
                const socket = DiscordSocket_1.createConnection(path, () => {
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
                this.socket.writePacket(consts_1.IPCOpcode.HANDSHAKE, { v: 1, client_id: this.clientId });
                let first = true;
                this.socket.once("decodedPacket", (opcode, data) => {
                    util_1.debug("First packet", opcode);
                    first = false;
                    if (opcode == consts_1.IPCOpcode.FRAME) {
                        this.environment = JSON.parse(data).data;
                        resolve(this.socket);
                    }
                    else {
                        reject(new Error(data));
                    }
                });
                this.socket.on("decodedPacket", (opcode, data) => {
                    this.emit("packet", opcode, data);
                    const j = JSON.parse(data);
                    util_1.debug("Got frame", j);
                    if (j.cmd == "SET_ACTIVITY") {
                        try {
                            this.emit("activityUpdate", j.data);
                        }
                        catch (e) {
                            console.error(e);
                        }
                    }
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
            if (!this.socket.writePacket(consts_1.IPCOpcode.FRAME, { cmd, args, evt, nonce: uuid }))
                return r(new Error("Couldn't write."));
            this.waiting.set(uuid, (data) => a(data.data));
        });
    }
}
exports.SocketManager = SocketManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU29ja2V0TWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9Tb2NrZXRNYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLCtCQUE0QjtBQUM1Qix5REFBc0Q7QUFDdEQscUNBQW1FO0FBQ25FLG1EQUFrRTtBQUNsRSxpQ0FBK0I7QUFHL0IsTUFBYSxhQUFjLFNBQVEsbUNBQWdCO0lBaUIvQyxZQUFZLFFBQWdCO1FBQ3hCLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQWhCcEIsV0FBTSxHQUE0RCxjQUFjLENBQUM7UUFDakYsU0FBSSxHQUFHLFdBQUksQ0FDUCxDQUFDLE9BQU8sQ0FBQyxRQUFRLElBQUksT0FBTyxDQUFDLENBQUM7WUFDMUIsZUFBZSxDQUFDLENBQUM7WUFDakIsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxNQUFNLENBQUMsQ0FDdkcsRUFDRCxjQUFjLENBQ2pCLENBQUU7UUFDSCxvQkFBZSxHQUF5QixTQUFTLENBQUM7UUFDbEQsdUJBQWtCLEdBQUcsS0FBSyxDQUFDO1FBQzNCLDhEQUE4RDtRQUM5RCxZQUFPLEdBQW9DLElBQUksR0FBRyxFQUFFLENBQUM7UUFNakQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFO1lBQ3ZCLElBQUksSUFBSSxDQUFDLGVBQWUsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksU0FBUyxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksY0FBYyxDQUFDLEVBQUU7Z0JBQ2pILElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7Z0JBQy9CLFVBQVUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLElB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