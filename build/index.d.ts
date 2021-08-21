/// <reference types="node" />
import { Activity, IPCOpcode, DiscordEnvironment, ResponseActivity } from "./consts";
import EventEmitter from "events";
import { Socket } from "net";
export declare interface ipcClient {
    on(event: "disconnected", listener: () => void): this;
    on(event: "conneting", listener: () => void): this;
    on(event: "packet", listener: (opcode: number, data: string) => void): this;
    on(event: "connected", listener: () => void): this;
    on(event: "SET_ACTIVITY", listener: (activity: ResponseActivity) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
}
export declare class ipcClient extends EventEmitter {
    client: ipcClient;
    socket: Socket;
    status: "connected" | "disconnected" | "errored" | "connecting";
    path: string;
    clientId: string;
    currentPresence: Activity | undefined;
    queuedPresence: boolean;
    cooldown: boolean;
    scheduledReconnect: boolean;
    waiting: Map<string, (data: any) => void>;
    environment?: DiscordEnvironment;
    constructor(clientId: string);
    emit(eventName: string | symbol, ...args: any[]): boolean;
    connect(): Promise<Socket>;
    createSocket(path: string): Promise<Socket>;
    establishConnection(path: string): Promise<Socket>;
    writePacket(opcode: IPCOpcode, data: any, socket?: Socket): boolean;
    disconnect(): void;
    setActivity(presence: Activity | undefined): Promise<void>;
    request(cmd: string, args?: any, evt?: string): Promise<any>;
}
