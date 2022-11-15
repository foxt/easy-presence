import { log } from "console";
import { join } from "path";
import { BaseEventEmitter } from "./BaseEventEmitter";
import { Activity, DiscordEnvironment, IPCOpcode } from "./consts";
import { createConnection, DiscordSocket } from "./DiscordSocket";
import { debug } from "./util";


export class SocketManager extends BaseEventEmitter {
    socket: DiscordSocket;
    status: "connected" | "disconnected" | "errored" | "connecting" = "disconnected";
    path = join(
        (process.platform == "win32" ?
            "\\\\?\\pipe\\" :
            (process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp")
        ),
        "discord-ipc-"
    ) ;
    currentPresence: Activity | undefined = undefined;
    scheduledReconnect = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    waiting: Map<string, (data:any) => void> = new Map();

    environment?: DiscordEnvironment;

    constructor(clientId: string) {
        super(clientId);
        this.on("disconnect", () => {
            if (!this.scheduledReconnect) {
                log("Scheduling connect");
                this.scheduledReconnect = true;
                setTimeout((() => {
                    log(this.currentPresence && (this.status == "errored" || this.status == "disconnected") ? "Running scheduled reconnect" : "Scheduled restart reconnect.");
                    if (this.currentPresence && (this.status == "errored" || this.status == "disconnected")) this.connect();
                }).bind(this), 5000);
            } else { log("Scheduling connect"); }
        });
        this.connect().catch(() => {});
    }
    async connect(): Promise<DiscordSocket> {
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

    createSocket(path:string): Promise<DiscordSocket> {
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

    establishConnection(path:string): Promise<DiscordSocket> {
        return new Promise(async(resolve, reject) => {
            try {
                this.socket = await this.createSocket(path);
                debug("Writing handshake");
                this.socket.writePacket(IPCOpcode.HANDSHAKE, { v: 1, client_id: this.clientId });
                let first = true;
                this.socket.once("decodedPacket", (opcode, data) => {
                    debug("First packet", opcode);
                    first = false;
                    if (opcode == IPCOpcode.FRAME) {
                        this.environment = JSON.parse(data).data;
                        resolve(this.socket);
                    } else {
                        reject(new Error(data));
                    }
                });
                this.socket.on("decodedPacket", (opcode, data) => {
                    this.emit("packet", opcode, data);
                    const j = JSON.parse(data);
                    debug("Got frame", j);
                    if (j.cmd == "SET_ACTIVITY") {
                        try { this.emit("activityUpdate", j.data); } catch (e) {
                            console.error(e);
                        }
                    }
                    try { this.emit(j.cmd, j); } catch (e) {
                        console.error(e);
                    }
                    if (j.nonce && this.waiting.has(j.nonce)) {
                        this.waiting.get(j.nonce)(data);
                        this.waiting.delete(j.nonce);
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



    disconnect():void {
        if (this.socket) this.socket.destroy();
        try { this.emit("disconnected"); } catch (e) {
            console.error(e);
        }
        this.socket = null;
        this.status = "disconnected";
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
            if (!this.socket.writePacket(IPCOpcode.FRAME, { cmd, args, evt, nonce: uuid })) return r(new Error("Couldn't write."));
            this.waiting.set(uuid, (data) => a(data.data));
        });
    }
}