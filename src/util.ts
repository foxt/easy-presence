import { Activity } from "./consts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function debug(...args: any[]) {
    if (!process.env["EZP-DEBUG"]) return;
    console.debug("[EZP]", ...args);
}

export function activityDiffers(a: Activity, b: Activity): boolean {
    if (typeof a !== typeof b) return true;
    if (!a || !b) return false;
    if (a.state !== b.state) return true;
    if (a.details !== b.details) return true;
    if (a.instance !== b.instance) return true;
    if (JSON.stringify([a.timestamps, a.assets, a.party, a.buttons]) != JSON.stringify([b.timestamps, b.assets, b.party, b.buttons])) return true;
    return false;
}