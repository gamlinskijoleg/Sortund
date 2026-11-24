import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { authApi } from "../api/endpoints";
import { startPolling } from "../analysis/manager";
import { log } from "@/utils/logger";

Notifications.setNotificationHandler({
    handleNotification: () =>
        Promise.resolve({
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
});

/** Registers the device for "analysis finished" pushes (REQ 17). Failures are non-fatal. */
export async function registerForPushNotifications(): Promise<void> {
    try {
        if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync("analysis", {
                name: "Analysis",
                importance: Notifications.AndroidImportance.DEFAULT,
            });
        }
        let { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
        if (status !== "granted") return;

        const projectId =
            (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
                ?.projectId ?? Constants.easConfig?.projectId;
        const token = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
        );
        await authApi.setPushToken(token.data);
        log.debug("Push token registered");
    } catch (error) {
        log.warn("Push registration failed", error);
    }
}

/** When a push arrives the job statuses are refreshed immediately. */
export function listenForAnalysisPushes() {
    const sub = Notifications.addNotificationReceivedListener((n) => {
        const data = n.request.content.data as { type?: string } | undefined;
        if (data?.type === "analysis_finished") startPolling();
    });
    return () => sub.remove();
}
