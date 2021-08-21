# Discord IPC Documentation.

This is an unofficial documentation on the Discord IPC format. It was made byadding numerous console.log statements to the NPM module discord-rpc.

## Data types

### Packets

Packets are sent in a simple format, an 8-byte header, consisting of 2 32-bit unsigned ints (little-endian), first one being the opcode, second being the length of the JSON string, then the JSON string.

An example HANDSHAKE packet is:

```
00000000  28000000 7B2276223A312C22 (trimmed)
^^^^^^^^  ^^^^^^^^ ^^^^^^^^^^^^^^^^
OPCODE 0   Length     JSON Data
HANDSHAKE 40bytes  { " v " : 1 , " 
```



### Opcodes

 Valid opcodes are

| Value    | **Name**    | Description                                                  |
| -------- | ----------- | ------------------------------------------------------------ |
| `0x0000` | `HANDSHAKE` | This should be sent immediately after connecting. See the **Connecting to IPC** section for more information. |
| `0x0001` | `FRAME`     | This is the main payload for indicating most types of data you will send back and forth. The JSON data will be a command. |
| `0x0002` | `CLOSE`     | This is sent when the Discord client is asking you to leave, or you want to gracefully disconnect. |
| `0x0003` | `PING`      | This acts as an echo command. If you send this, you will recieve the data supplied with it back from the Discord client.<br />If the Discord client sends this to you, you should reply with a `PONG` of the same data |
| `0x0004` | `PONG`      | See `PING`                                                   |

### Commands

Commands are mostly request/response based, however some events (such as READY) do not have an originating request, sent with a `FRAME` packet. They are a JSON string in the following format:

```typescript
// This defines a message sent from your app to Discord.
interface DiscordIPCCommandOutgoing {
    // The command ID of this request.
    cmd: string;
    // The unique ID of this request, a response will be sent with the matching ID.
    nonce: string;
    // The arguments of this request.
    args: object;
    // Events with 'cmd' 'SUBSCRIBE' will have an 'event' parameter defining the name of the event (e.g. MESSAGE_CREATE)
    evt?: string;
}

// This defines a message coming from Discord into your app.
interface DiscordIPCCommandIncoming {
    // The command ID of this response.
    cmd: string;
    // The unique ID of the request that triggered this response.
    nonce: string | null;
    // The arguments of the request that triggered this response.
    args?: object;
    // The payload of this response
    data: object;
    // The type of event this is.
    evt?: string;
}
```

Valid `cmd`s are: `DISPATCH`,  `AUTHORIZE`,  `AUTHENTICATE`,  `GET_GUILD`,  `GET_GUILDS`,  `GET_CHANNEL`,  `GET_CHANNELS`,  `CREATE_CHANNEL_INVITE`,  `GET_RELATIONSHIPS`,  `GET_USER`,  `SUBSCRIBE`,  `UNSUBSCRIBE`,  `SET_USER_VOICE_SETTINGS`,  `SET_USER_VOICE_SETTINGS_2`,  `SELECT_VOICE_CHANNEL`,  `GET_SELECTED_VOICE_CHANNEL`,  `SELECT_TEXT_CHANNEL`,  `GET_VOICE_SETTINGS`,  `SET_VOICE_SETTINGS_2`,  `SET_VOICE_SETTINGS`,  `CAPTURE_SHORTCUT`,  `SET_ACTIVITY`,  `SEND_ACTIVITY_JOIN_INVITE`,  `CLOSE_ACTIVITY_JOIN_REQUEST`,  `ACTIVITY_INVITE_USER`,  `ACCEPT_ACTIVITY_INVITE`,  `INVITE_BROWSER`,  `DEEP_LINK`,  `CONNECTIONS_CALLBACK`,  `BRAINTREE_POPUP_BRIDGE_CALLBACK`,  `GIFT_CODE_BROWSER`,  `GUILD_TEMPLATE_BROWSER`,  `OVERLAY`,  `BROWSER_HANDOFF`,  `SET_CERTIFIED_DEVICES`,  `GET_IMAGE`,  `CREATE_LOBBY`,  `UPDATE_LOBBY`,  `DELETE_LOBBY`,  `UPDATE_LOBBY_MEMBER`,  `CONNECT_TO_LOBBY`,  `DISCONNECT_FROM_LOBBY`,  `SEND_TO_LOBBY`,  `SEARCH_LOBBIES`,  `CONNECT_TO_LOBBY_VOICE`,  `DISCONNECT_FROM_LOBBY_VOICE`,  `SET_OVERLAY_LOCKED`,  `OPEN_OVERLAY_ACTIVITY_INVITE`,  `OPEN_OVERLAY_GUILD_INVITE`,  `OPEN_OVERLAY_VOICE_SETTINGS`,  `VALIDATE_APPLICATION`,  `GET_ENTITLEMENT_TICKET`,  `GET_APPLICATION_TICKET`,  `START_PURCHASE`,  `GET_SKUS`,  `GET_ENTITLEMENTS`,  `GET_NETWORKING_CONFIG`,  `NETWORKING_SYSTEM_METRICS`,  `NETWORKING_PEER_METRICS`,  `NETWORKING_CREATE_TOKEN`,  `SET_USER_ACHIEVEMENT`,  `GET_USER_ACHIEVEMENTS`.

Valid  `evt`s are: `CURRENT_USER_UPDATE`,  `GUILD_STATUS`,  `GUILD_CREATE`,  `CHANNEL_CREATE`,  `RELATIONSHIP_UPDATE`,  `VOICE_CHANNEL_SELECT`,  `VOICE_STATE_CREATE`,  `VOICE_STATE_DELETE`,  `VOICE_STATE_UPDATE`,  `VOICE_SETTINGS_UPDATE`,  `VOICE_SETTINGS_UPDATE_2`,  `VOICE_CONNECTION_STATUS`,  `SPEAKING_START`,  `SPEAKING_STOP`,  `GAME_JOIN`,  `GAME_SPECTATE`,  `ACTIVITY_JOIN`,  `ACTIVITY_JOIN_REQUEST`,  `ACTIVITY_SPECTATE`,  `ACTIVITY_INVITE`,  `NOTIFICATION_CREATE`,  `MESSAGE_CREATE`,  `MESSAGE_UPDATE`,  `MESSAGE_DELETE`,  `LOBBY_DELETE`,  `LOBBY_UPDATE`,  `LOBBY_MEMBER_CONNECT`,  `LOBBY_MEMBER_DISCONNECT`,  `LOBBY_MEMBER_UPDATE`,  `LOBBY_MESSAGE`,  `CAPTURE_SHORTCUT_CHANGE`,  `OVERLAY`,  `OVERLAY_UPDATE`,  `ENTITLEMENT_CREATE`,  `ENTITLEMENT_DELETE`,  `USER_ACHIEVEMENT_UPDATE`,  `READY`,  `ERROR`.






## Connecting to IPC

### But where do I connect?

First of all, you need to find the place where Discord is listening.

If you're on Windows, named pipes are used, so it is always kept in: `\\?\pipe\`

On macOS & Linux, it'll be kept in the folder indicated by the `XDG_RUNTIME_DIR`, `TMPDIR`, `TMP` or `TEMP` envvars. If none of those exist, use `/tmp/`

Then, you'll need to find the socket, each Discord client running on the local machine creates it's own socket, with the name 'discord-rpc-' followed by a number, X, from 0-9. You should start with `0` and increment until you find a working socket, or you exceed 9.

For example, on my machine the IPC socket is kept at `/var/folders/0k/0hsf3q_d7yg94xs01lp9jkbr0000gn/T/discord-ipc-0`

### Connecting

Connect to the socket and send a packet with opcode `0x0001`, and data `{"v":1,"client_id":"XXXXXXXXXXXXXXXXXX"}` . The `client_id` is the numeric Application ID you obtained from https://discord.com/developers/applications. This will authenticate you to the Discord client. You will then recieve a command with `{evt: "READY",  command: "DISPATCH"}`. with information about the current User.



# Error handling

Critical errors (such as protocol or handshake) will be sent as a `CLOSE` packet, with a JSON object with a numeric code, and human friendly message.`{"code":4000,"message":"Invalid Client ID"}`.

Critical error codes are:

```
  CLOSE_NORMAL: 1000,
  CLOSE_UNSUPPORTED: 1003,
  CLOSE_ABNORMAL: 1006,
  INVALID_CLIENTID: 4000,
  INVALID_ORIGIN: 4001,
  RATELIMITED: 4002,
  TOKEN_REVOKED: 4003,
  INVALID_VERSION: 4004,
  INVALID_ENCODING: 4005,
```



Non-critical errors will be sent as a regular response, but with an evt of `ERROR` and the data being an object with a numeric code, and human friendly message, such as `{"code":4000,"message":"Invalid Client ID"}`.

Non critical error codes are:

```
  CAPTURE_SHORTCUT_ALREADY_LISTENING: 5004,
  GET_GUILD_TIMED_OUT: 5002,
  INVALID_ACTIVITY_JOIN_REQUEST: 4012,
  INVALID_ACTIVITY_SECRET: 5005,
  INVALID_CHANNEL: 4005,
  INVALID_CLIENTID: 4007,
  INVALID_COMMAND: 4002,
  INVALID_ENTITLEMENT: 4015,
  INVALID_EVENT: 4004,
  INVALID_GIFT_CODE: 4016,
  INVALID_GUILD: 4003,
  INVALID_INVITE: 4011,
  INVALID_LOBBY: 4013,
  INVALID_LOBBY_SECRET: 4014,
  INVALID_ORIGIN: 4008,
  INVALID_PAYLOAD: 4000,
  INVALID_PERMISSIONS: 4006,
  INVALID_TOKEN: 4009,
  INVALID_USER: 4010,
  LOBBY_FULL: 5007,
  NO_ELIGIBLE_ACTIVITY: 5006,
  OAUTH2_ERROR: 5000,
  PURCHASE_CANCELED: 5008,
  PURCHASE_ERROR: 5009,
  RATE_LIMITED: 5011,
  SELECT_CHANNEL_TIMED_OUT: 5001,
  SELECT_VOICE_FORCE_REQUIRED: 5003,
  SERVICE_UNAVAILABLE: 1001,
  TRANSACTION_ABORTED: 1002,
  UNAUTHORIZED_FOR_ACHIEVEMENT: 5010,
  UNKNOWN_ERROR: 1000,
```

