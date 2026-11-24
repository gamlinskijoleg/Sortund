import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** Sends push notifications through the Expo push service. */
@Injectable()
export class PushService {
    private readonly logger = new Logger(PushService.name);

    constructor(private readonly config: ConfigService) {}

    async send(
        token: string,
        title: string,
        body: string,
        data: Record<string, unknown> = {}
    ): Promise<boolean> {
        if (!/^Expo(nent)?PushToken\[.+\]$/.test(token)) {
            this.logger.warn("Skipping push: not an Expo push token");
            return false;
        }
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "application/json",
        };
        const accessToken = this.config.get<string>("EXPO_ACCESS_TOKEN");
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

        try {
            const response = await fetch(
                this.config.get<string>("EXPO_PUSH_URL", "https://exp.host/--/api/v2/push/send"),
                {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ to: token, title, body, data, sound: "default" }),
                    signal: AbortSignal.timeout(10_000),
                }
            );
            if (!response.ok) {
                this.logger.warn(`Expo push failed with status ${response.status}`);
                return false;
            }
            return true;
        } catch (error) {
            this.logger.warn(`Expo push failed: ${String(error)}`);
            return false;
        }
    }
}
