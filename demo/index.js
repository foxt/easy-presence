// process.env["EZP-DEBUG"] = "true";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const client = new (require("..").EasyPresence)("878603502048411648"); // replace this with your Discord Client ID.
client.on("connected", () => {
    console.log("Hello,", client.environment.user.username);
});

// This will be logged when the presence was sucessfully updated on Discord.
client.on("activityUpdate", (activity) => {
    console.log("Now you're playing", activity.name);
});

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