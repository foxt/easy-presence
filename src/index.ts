import { Activity, ResponseActivity } from "./consts";
import { SocketManager } from "./SocketManager";


export declare interface EasyPresence {
    // Fired when the socket disconnects, or fails to connect.
    on(event: "disconnected", listener: () => void): this;
    // Fired when the socket is in the process of connecting.
    on(event: "conneting", listener: () => void): this;
    // Fired when a packet is recieved
    on(event: "packet", listener: (opcode: number, data: string) => void): this;
    // Fired when the socket connects successfully
    on(event: "connected", listener: () => void): this;
    // Fired when the activity has been updated.
    on(event: "activityUpdate", listener: (activity: ResponseActivity) => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
}

export class EasyPresence extends SocketManager {
    currentPresence: Activity | undefined = undefined;
    queuedPresence = false;
    cooldown = false;

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
}