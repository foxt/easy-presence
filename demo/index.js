// eslint-disable-next-line @typescript-eslint/no-var-requires
const ipcClient = require("../build/index.js").ipcClient;
process.env["EZP-DEBUG"] = "true";
let client = new ipcClient("626092891667824688");
client.on("connected", () => {
    console.log("Connected as", client.environment.user.username);
});

setInterval(() => {
    client.setActivity({
        state: "dick",
        timestamps: { start: new Date() }
    }, console.error);
}, 1000);