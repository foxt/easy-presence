// eslint-disable-next-line @typescript-eslint/no-var-requires
const EasyPresence = require("..").EasyPresence;
// process.env["EZP-DEBUG"] = "true";
let client = new EasyPresence("626092891667824688");
client.on("connected", () => {
    console.log("Connected as", client.environment.user.username);
});

client.on("activityUpdate", console.log);

setInterval(() => {
    client.setActivity({
        details: "Using EasyPresence",
        state: "neato!",
        assets: {
            large_image: "rblxrp",
            large_text: "EasyPresence",
            small_image: "octocat",
            small_text: "https://github.com/rblxrp/easypresence"
        },
        buttons: [
            {
                label: "Visit on GitHub",
                url: "https://github.com/rblxrp/easypresence"
            }
        ],
        party: {
            id: "1234567890",
            size: [1, 10]
        },
        timestamps: { start: new Date() }
    });
}, 1000);