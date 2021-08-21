/* eslint-disable no-invalid-this */
import { Socket, createConnection as netCreateConnection } from "net";
import { IPCOpcode } from "./consts";
import { debug } from "./util";


export interface DiscordSocket extends Socket {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, listener: (...args: any[]) => void): this;
    on(event: "close", listener: (hadError: boolean) => void): this;
    on(event: "connect", listener: () => void): this;
    on(event: "data", listener: (data: Buffer) => void): this;
    on(event: "drain", listener: () => void): this;
    on(event: "end", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "lookup", listener: (err: Error, address: string, family: string | number, host: string) => void): this;
    on(event: "ready", listener: () => void): this;
    on(event: "timeout", listener: () => void): this;
    on(event: "decodedPacket", listener: (opcode:number, data:string) => void): this;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
writePacket(opcode: IPCOpcode, data: any): boolean
}

export function createConnection(path: string, connectionListener?: () => void): DiscordSocket {
    const socket = netCreateConnection(path, connectionListener) as DiscordSocket;
    // eslint-disable-next-line @typescript-eslint/ban-types
    socket.writePacket = (opcode: IPCOpcode, data: string | object) => {
        data = JSON.stringify(data);
        const dlen = Buffer.byteLength(data);
        const buffer = Buffer.alloc(dlen + 8);
        buffer.writeUInt32LE(opcode, 0);
        buffer.writeUInt32LE(dlen, 4);
        buffer.write(data, 8);
        return socket.write(buffer);
    };

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
            socket.emit("decodedPacket", opcode, data);
            opcode = -1;
            data = "";
        }
    });
    return socket;
}