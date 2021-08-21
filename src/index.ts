import { Activity, IPCOpcode, DiscordEnvironment, ResponseActivity } from "./consts";
import { debug } from "./util";
import EventEmitter from "events";
import { createConnection, Socket } from "net";
import { join } from "path";

function decodeData(socket: Socket, onPacket: (opcode: number, data: string) => void) {
    let opcode = -1;
    let remaining = 0;
    let data = "";
    socket.on("readable", () => {
        if (!socket.readableLength) return;
        debug(socket.readableLength, "bytes available");
        if (opcode < 0) {
            const header = socket.read(8) as Buffer;
            opcode = header.readInt32LE(0);
            remaining = header.readInt32LE(4);
            debug("Got header", { opcode, remaining });
            const body = socket.read(remaining) as Buffer;
            remaining -= body.length;
            debug("Remaining bytes", remaining);
            data += body.toString();
        } else {
            const body = socket.read(remaining) as Buffer;
            remaining -= body.length;
            debug("Remaining bytes", remaining);
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

export declare interface ipcClient {
    // Fired when the socket disconnects, or fails to connect.
    on(event: "disconnected", listener: () => void): this;
    // Fired when the socket is in the process of connecting.
    on(event: "conneting", listener: () => void): this;
    // Fired when a packet is recieved
    on(event: "packet", listener: (opcode: number, data: string) => void): this;
    // Fired when the socket connects successfully
    on(event: "connected", listener: () => void): this;
    // Fired when the socket connects successfully
    on(event: "SET_ACTIVITY", listener: (activity: ResponseActivity) => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
}

export class ipcClient extends EventEmitter {
    client: ipcClient;
    socket: Socket;
    status: "connected" | "disconnected" | "errored" | "connecting" = "disconnected";
    path = join(
        (process.platform == "win32" ?
            "\\\\?\\pipe\\" :
            (process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp")
        ),
        "discord-ipc-"
    ) ;
    clientId: string;
    currentPresence: Activity | undefined = undefined;
    queuedPresence = false;
    cooldown = false;
    scheduledReconnect = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    waiting: Map<string, (data:any) => void> = new Map();

    environment?: DiscordEnvironment;
    constructor(clientId: string) {
        super();
        debug("Instantiated with ", clientId);
        this.clientId = clientId;
        this.on("disconnect", () => {
            if (this.currentPresence && !this.scheduledReconnect && (this.status == "errored" || this.status == "disconnected")) {
                this.scheduledReconnect = true;
                setTimeout((() => this.connect()).bind(this), 5000);
            }
        });
        this.connect().catch(() => {});
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit(eventName: string | symbol, ...args: any[]): boolean {
        debug(eventName, ...args);
        return super.emit(eventName, ...args);
    }
    async connect(): Promise<Socket> {
        debug("Starting connect");
        this.scheduledReconnect = false;
        if (this.status == "connected") return this.socket;
        this.status = "connecting";
        try { this.emit("connecting"); } catch (e) {}
        for (let attempt = 0; attempt < 10; attempt++) {
            debug("Connection attempt #" + attempt);
            try {
                this.socket = await this.establishConnection(this.path + attempt);
                debug("Connection success!");
                this.status = "connected";
                try { this.emit("connected"); } catch (e) {
                    console.error(e);
                }
                return this.socket;
            } catch (e) {
                debug("Connection failed", e);
            }
        }
        this.status = "errored";
        try { this.emit("disconnected"); } catch (e) {
            console.error(e);
        }
        throw new Error("Could not connect to IPC");
    }

    createSocket(path:string): Promise<Socket> {
        return new Promise((resolve, reject) => {
            try {
                debug("Attempting to connect to ", path);
                const socket = createConnection(path, () => {
                    debug("Connected to ", path);
                    this.removeListener("error", reject);
                    resolve(socket);
                });
                socket.on("error", reject);
            } catch (e) {
                debug("Failed to connect to", path, e);
                reject(e);
            }
        });
    }

    establishConnection(path:string): Promise<Socket> {
        return new Promise(async(resolve, reject) => {
            try {
                this.socket = await this.createSocket(path);
                debug("Writing handshake");
                this.writePacket(IPCOpcode.HANDSHAKE, { v: 1, client_id: this.clientId }, this.socket);
                let first = true;
                decodeData(this.socket, (opcode, data) => {
                    try { this.emit("packet", opcode, data); } catch (e) {
                        console.error(e);
                    }
                    if (first) {
                        debug("First packet", opcode);
                        first = false;
                        if (opcode == IPCOpcode.FRAME) {
                            this.environment = JSON.parse(data).data;
                            resolve(this.socket);
                        } else {
                            reject(new Error(data));
                        }
                    } else if (opcode == IPCOpcode.FRAME) {
                        const j = JSON.parse(data);
                        debug("Got frame", j);
                        try { this.emit(j.cmd, j); } catch (e) {
                            console.error(e);
                        }
                        if (j.nonce && this.waiting.has(j.nonce)) {
                            this.waiting.get(j.nonce)(data);
                            this.waiting.delete(j.nonce);
                        }
                    }
                });

                this.socket.on("close", () => {
                    if (first) reject(new Error("Connection closed."));
                    this.disconnect();
                });
            } catch (e) {
                debug("Error establishing connection to ", path, e);
                reject(e);
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    writePacket(opcode: IPCOpcode, data: any, socket: Socket = this.socket): boolean {
        data = JSON.stringify(data);
        const dlen = Buffer.byteLength(data);
        const buffer = Buffer.alloc(dlen + 8);
        buffer.writeUInt32LE(opcode, 0);
        buffer.writeUInt32LE(dlen, 4);
        buffer.write(data, 8);
        console.log(buffer);
        return socket.write(buffer);
    }

    disconnect():void {
        if (this.socket) this.socket.destroy();
        try { this.emit("disconnected"); } catch (e) {
            console.error(e);
        }
        this.socket = null;
        this.status = "disconnected";
    }


    async setActivity(presence: Activity | undefined): Promise<void> {
        if (this.cooldown) {
            this.currentPresence = presence;
            this.queuedPresence = true;
            return;
        }
        this.cooldown = true;
        try {
            if (presence && this.status != "connected") await this.connect();
            if (presence && this.status != "connected") throw new Error("Status did not become connected.");
            if (this.status == "connected") {
                // eslint-disable-next-line @typescript-eslint/ban-types
                const payload: {pid: number, activity?: object} = { pid: process.pid };
                if (presence) {
                    if (presence.timestamps) {
                        if (presence.timestamps.end instanceof Date) presence.timestamps.end = (presence.timestamps.end as Date).getTime();
                        if (presence.timestamps.start instanceof Date) presence.timestamps.start = (presence.timestamps.start as Date).getTime();
                    }
                    payload.activity = presence;
                }
                this.request("SET_ACTIVITY", payload);
            }
        } catch (e) {
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
    request(cmd: string, args?: any, evt?: string): Promise<any> {
        let uuid = "";
        for (let i = 0; i < 32; i += 1) {
            if (i === 8 || i === 12 || i === 16 || i === 20) {
                uuid += "-";
            }
            let n;
            if (i === 12) {
                n = 4;
            } else {
                const random = Math.random() * 16 | 0;
                if (i === 16) {
                    n = (random & 3) | 0;
                } else {
                    n = random;
                }
            }
            uuid += n.toString(16);
        }
        return new Promise((a, r) => {
            if (!this.writePacket(IPCOpcode.FRAME, { cmd, args, evt, nonce: uuid })) return r(new Error("Couldn't write."));
            this.waiting.set(uuid, (data) => a(data.data));
        });
    }
}