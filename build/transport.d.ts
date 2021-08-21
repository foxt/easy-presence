/// <reference types="node" />
import EventEmitter from "events";
import { Socket } from "net";
import { ipcClient } from ".";
import { IPCOpcode } from "./consts";
export declare class IPCTransport extends EventEmitter {
    client: ipcClient;
    socket: Socket;
    status: "connected" | "disconnected" | "errored" | "connecting";
    path: string;
    constructor(instantiatingClient: ipcClient);
    connect(): Promise<Socket>;
    createSocket(path: string): Promise<Socket>;
    establishConnection(path: string): Promise<Socket>;
    writePacket(opcode: IPCOpcode, data: any, socket?: Socket): void;
    disconnect(): void;
}
