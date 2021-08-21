"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debug = void 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
function debug(...args) {
    if (!process.env["EZP-DEBUG"])
        return;
    console.debug("[EZP]", ...args);
}
exports.debug = debug;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGlIQUFpSDtBQUNqSCxTQUFnQixLQUFLLENBQUMsR0FBRyxJQUFXO0lBQ2hDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQztRQUFFLE9BQU87SUFDdEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztBQUNwQyxDQUFDO0FBSEQsc0JBR0MifQ==