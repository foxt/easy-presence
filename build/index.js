"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EasyPresence = void 0;
const SocketManager_1 = require("./SocketManager");
class EasyPresence extends SocketManager_1.SocketManager {
    constructor() {
        super(...arguments);
        this.currentPresence = undefined;
        this.queuedPresence = false;
        this.cooldown = false;
    }
    async setActivity(presence) {
        if (this.cooldown) {
            this.currentPresence = presence;
            this.queuedPresence = true;
            return;
        }
        this.cooldown = true;
        try {
            if (presence && this.status != "connected")
                await this.connect();
            if (presence && this.status != "connected")
                throw new Error("Status did not become connected.");
            if (this.status == "connected") {
                // eslint-disable-next-line @typescript-eslint/ban-types
                const payload = { pid: process.pid };
                if (presence) {
                    if (presence.timestamps) {
                        if (presence.timestamps.end instanceof Date)
                            presence.timestamps.end = presence.timestamps.end.getTime();
                        if (presence.timestamps.start instanceof Date)
                            presence.timestamps.start = presence.timestamps.start.getTime();
                    }
                    payload.activity = presence;
                }
                this.request("SET_ACTIVITY", payload);
            }
        }
        catch (e) {
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
exports.EasyPresence = EasyPresence;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsbURBQWdEO0FBa0JoRCxNQUFhLFlBQWEsU0FBUSw2QkFBYTtJQUEvQzs7UUFDSSxvQkFBZSxHQUF5QixTQUFTLENBQUM7UUFDbEQsbUJBQWMsR0FBRyxLQUFLLENBQUM7UUFDdkIsYUFBUSxHQUFHLEtBQUssQ0FBQztJQXlDckIsQ0FBQztJQXZDRyxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQThCO1FBQzVDLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtZQUNmLElBQUksQ0FBQyxlQUFlLEdBQUcsUUFBUSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDO1lBQzNCLE9BQU87U0FDVjtRQUNELElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLElBQUk7WUFDQSxJQUFJLFFBQVEsSUFBSSxJQUFJLENBQUMsTUFBTSxJQUFJLFdBQVc7Z0JBQUUsTUFBTSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDakUsSUFBSSxRQUFRLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxXQUFXO2dCQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsa0NBQWtDLENBQUMsQ0FBQztZQUNoRyxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksV0FBVyxFQUFFO2dCQUM1Qix3REFBd0Q7Z0JBQ3hELE1BQU0sT0FBTyxHQUFxQyxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ3ZFLElBQUksUUFBUSxFQUFFO29CQUNWLElBQUksUUFBUSxDQUFDLFVBQVUsRUFBRTt3QkFDckIsSUFBSSxRQUFRLENBQUMsVUFBVSxDQUFDLEdBQUcsWUFBWSxJQUFJOzRCQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsR0FBRyxHQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsR0FBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUNuSCxJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsS0FBSyxZQUFZLElBQUk7NEJBQUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFjLENBQUMsT0FBTyxFQUFFLENBQUM7cUJBQzVIO29CQUNELE9BQU8sQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO2lCQUMvQjtnQkFDRCxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQzthQUN6QztTQUNKO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDUixvR0FBb0c7WUFDcEcsT0FBTyxDQUFDLElBQUksQ0FBQyw0REFBNEQsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUM5RSxVQUFVLENBQUMsR0FBRyxFQUFFO2dCQUNaLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO2dCQUN0QixJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO2dCQUMvQixJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQy9CLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztTQUNaO1FBQ0QsVUFBVSxDQUFDLENBQUMsR0FBRyxFQUFFO1lBQ2IsSUFBSSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUM7WUFDdEIsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFO2dCQUNyQixJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztnQkFDNUIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7YUFDMUM7UUFDTCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDMUIsQ0FBQztDQUNKO0FBNUNELG9DQTRDQyJ9