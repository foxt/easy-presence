
interface ActivityTimestamps {
    // unix timestamp - send this to have an "elapsed" timer
    start?: Date | number;
    // unix timestamp - send this to have an "remaining" timer
    end?: Date | number;
}
interface ActivityAssets {
    // keyname of the large image.
    large_image?: string;
    // hover text for the large image
    large_text?: string;
    // keyname of the small image
    small_image?: string;
    // hover text for the small image
    small_text?: string;
}
interface ActivityParty {
    // a unique identifier for this party
    id?: string;
    // info about the size of the party. First number is the amount of people in the party, the second is the maximum amount of people in a party.
    size: [number, number];
}

interface button {
    // the text of the button
    label: string;
    // the url thet the button will open
    url: string;
}

/**
 * @see https://discord.com/developers/docs/game-sdk/activities
 */
export interface Activity {
    // The top line of the presence.
    // Intended to be used to describe what the user is doing.
    details: string;
    // The bottom line of the presence.
    // Intended tp be used to describe the status of the party of the user.
    state: string,
    // The timestamp of the presence.
    timestamps?: ActivityTimestamps,
    // The images attached to the presence.
    assets?: ActivityAssets;
    // The size of the party the user is in.
    party?: ActivityParty,
    // The buttons attached to the presence. note to developers: you won't be able to view this on your own client, you'll need another account to see this.
    buttons?: [button] | [button, button];
    // I have no clue what this means. ¯\_(ツ)_/¯
    // docs say: whether this activity is an instanced context, like a match, and wether the matchSecret as a game session with a specific beginning and end
    instance?: boolean;
}

export interface ResponseActivity extends Activity {
    name: string;
    application_id: string;
    type: number;
}


export interface DiscordEnvironment {
    config: {
        // usually cdn.discordapp.com
        cdn_host: string;
        // usually //discord.com/api, //ptb.discord.com/api or //canary.discord.com/api
        api_endpoint: string;
        // usually production
        environment: string;
    },
    /**
     * The user logged into the connected Discord client.
     * @see https://discord.com/developers/docs/resources/user
    */
    user: {
        id: string,
        username: string,
        discriminator: string,
        // not a url! this is the hash. can be turned into a url with `https://${environment.config.cdn_host}/${environment.user.id}/${environment.user.avatar}.png`
        avatar: string,
        bot: false,
        flags: number,
        premium_type: number,
    }
}

// eslint-disable-next-line no-shadow
export enum IPCOpcode {
    HANDSHAKE = 0,
    FRAME = 1,
    CLOSE = 2,
    PING = 3,
    PONG = 4
}