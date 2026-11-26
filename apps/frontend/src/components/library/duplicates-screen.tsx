import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { SectionList, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../app-screen";
import { TrackListItem } from "../shared/track-list-item";
import { EmptyState, TopBar } from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { openTrack, playQueue } from "../music/music-home-screen";
import { useT } from "../../i18n";
import { folderOf } from "../../library/duplicates";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";

/**
 * Identical files found in different folders. Only the first copy of each group is shown in the
 * library; the files themselves are never deleted.
 */
export default function DuplicatesScreen() {
    const t = useT();
    const theme = useAppTheme();
    const groups = usePlayerStore((s) => s.duplicateGroups);

    const sections = groups.map((g) => ({
        key: g.primary.contentHash ?? g.primary.assetId,
        title: g.primary.title,
        artist: g.primary.artist,
        data: g.copies,
    }));

    return (
        <AppScreen>
            <View style={{ paddingHorizontal: 8 }}>
                <TopBar />
            </View>
            <SectionList
                showsVerticalScrollIndicator={false}
                sections={sections}
                keyExtractor={(x) => x.assetId}
                stickySectionHeadersEnabled={false}
                ListHeaderComponent={
                    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                        <Text accessibilityRole="header" style={[styles.h1, { color: theme.text }]}>
                            {t("duplicates.title")}
                        </Text>
                        <Text
                            style={{
                                color: theme.textMuted,
                                fontSize: 14,
                                lineHeight: 20,
                                marginTop: 6,
                            }}
                        >
                            {t("duplicates.hint")}
                        </Text>
                    </View>
                }
                renderSectionHeader={({ section }) => (
                    <View style={styles.groupHead}>
                        <Text
                            style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}
                            numberOfLines={1}
                        >
                            {section.title}
                        </Text>
                        <Text style={{ color: theme.textSubtle, fontSize: 13 }} numberOfLines={1}>
                            {t("duplicates.copies", { n: section.data.length })}
                        </Text>
                    </View>
                )}
                renderItem={({ item, index }) => (
                    <TrackListItem
                        track={item}
                        subtitle={folderOf(item.sourceUri)}
                        onPress={() => playQueue([item], 0)}
                        onLongPress={() => openTrack(item.assetId)}
                        onMore={() => openTrack(item.assetId)}
                        showDuration={false}
                        trailingActionSlot={
                            index === 0 ? (
                                <View
                                    accessibilityLabel={t("duplicates.shown")}
                                    style={[styles.badge, { backgroundColor: theme.surfaceStrong }]}
                                >
                                    <MaterialCommunityIcons
                                        name="eye-outline"
                                        size={13}
                                        color={theme.text}
                                    />
                                    <Text
                                        style={{
                                            color: theme.text,
                                            fontSize: 12,
                                            fontWeight: "500",
                                        }}
                                    >
                                        {t("duplicates.shown")}
                                    </Text>
                                </View>
                            ) : undefined
                        }
                    />
                )}
                SectionSeparatorComponent={() => <View style={{ height: 6 }} />}
                ListEmptyComponent={
                    <EmptyState icon="content-duplicate" text={t("duplicates.empty")} />
                }
                contentContainerStyle={{ paddingBottom: MINI_PLAYER_SPACE }}
            />
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    h1: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
    groupHead: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4, gap: 2 },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        height: 26,
        paddingHorizontal: 9,
        borderRadius: 13,
    },
});
