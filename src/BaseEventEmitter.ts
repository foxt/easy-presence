import EventEmitter from "events";
import { debug } from "./util";

export class BaseEventEmitter extends EventEmitter {
    clientId: string;
    constructor(clientId: string) {
        super();
        debug("Instantiated with ", clientId);
        this.clientId = clientId;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit(eventName: string | symbol, ...args: any[]): boolean {
        debug(eventName, ...args);
        return super.emit(eventName, ...args);
    }
}