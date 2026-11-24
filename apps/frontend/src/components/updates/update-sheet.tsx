import React from "react";
import { Text, View } from "react-native";
import { useT } from "../../i18n";
import { formatMegabytes, shortNotes } from "../../updates/release";
import { installedVersion, useUpdateStore } from "../../updates/updater";
import { useAppTheme } from "../../theme/app-theme";
import { AppButton, ConfidenceBar, Notice, Sheet } from "../ui/primitives";

/** Dialog that offers a newer APK from GitHub Releases (mounted once in the root layout). */
export function UpdateSheet() {
    const t = useT();
    const theme = useAppTheme();
    const { visible, status, release, progress, error } = useUpdateStore();
    const store = useUpdateStore.getState();
    const current = installedVersion().name;

    const hasUpdate =
        !!release && (status === "available" || status === "downloading" || status === "error");
    const title = hasUpdate ? t("update.available") : t("update.title");

    return (
        <Sheet visible={visible} onClose={() => store.dismiss()} title={title}>
            <View style={{ gap: 12 }}>
                {status === "upToDate" && (
                    <Text style={{ color: theme.text }}>
                        {t("update.upToDate", { version: current })}
                    </Text>
                )}

                {hasUpdate && release && (
                    <>
                        <Text style={{ color: theme.text, fontSize: 15 }}>
                            {t("update.versions", { current, next: release.versionName })}
                        </Text>
                        {!!shortNotes(release.notes) && (
                            <Text style={{ color: theme.textMuted }}>
                                {shortNotes(release.notes)}
                            </Text>
                        )}
                        <Text style={{ color: theme.textSubtle, fontSize: 12 }}>
                            {t("update.size", { size: formatMegabytes(release.sizeBytes) })}
                        </Text>
                    </>
                )}

                {status === "downloading" && (
                    <View style={{ gap: 6 }}>
                        <ConfidenceBar value={progress} />
                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                            {t("update.downloading", { percent: Math.round(progress * 100) })}
                        </Text>
                    </View>
                )}

                {status === "error" && error && (
                    <Notice tone="error" text={t("update.failed", { error })} />
                )}

                {hasUpdate ? (
                    <View style={{ gap: 8 }}>
                        <AppButton
                            icon="download"
                            label={t("update.install")}
                            loading={status === "downloading"}
                            onPress={() => void store.install()}
                        />
                        <Text style={{ color: theme.textSubtle, fontSize: 12 }}>
                            {t("update.permissionHint")}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                            <AppButton
                                variant="secondary"
                                label={t("update.later")}
                                onPress={() => store.dismiss()}
                                style={{ flex: 1 }}
                            />
                            <AppButton
                                variant="ghost"
                                label={t("update.skip")}
                                onPress={() => store.dismiss(true)}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </View>
                ) : (
                    <AppButton
                        variant="secondary"
                        label={t("common.ok")}
                        onPress={() => store.dismiss()}
                    />
                )}
            </View>
        </Sheet>
    );
}
