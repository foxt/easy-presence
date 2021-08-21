
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function debug(...args: any[]) {
    if (!process.env["EZP-DEBUG"]) return;
    console.debug("[EZP]", ...args);
}