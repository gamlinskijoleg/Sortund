import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEvent } from "expo";
import { YStack, XStack, Text, Image, Button, View } from "tamagui";

import { AppScreen } from "../app-screen";
import { getPlayerInstance, togglePlayback } from "../../player/music-player";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppTheme } from "@/theme/app-theme";

function formatTime(milliseconds: number) {
    const safeSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(safeSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainder = safeSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    }
    return `${String(minutes % 60).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function MusicListenScreen() {
    const theme = useAppTheme();
    const player = getPlayerInstance();
    const playerEvent = useEvent(player, "playbackStatusUpdate");

    const activeTrack = usePlayerStore((state) => state.activeTrack);
    const { playNext, playPrevious } = usePlayerStore();

    if (!activeTrack) {
        return (
            <AppScreen backgroundColor={theme.background} statusBarStyle="dark">
                <YStack flex={1} justifyContent="center" alignItems="center">
                    <Text color={theme.textMuted} fontSize={16}>
                        Плеєр порожній...
                    </Text>
                </YStack>
            </AppScreen>
        );
    }

    const isStatus = playerEvent && "currentTime" in playerEvent;
    const status = isStatus ? (playerEvent as any) : null;

    const playedMs = status?.currentTime ? status.currentTime * 1000 : 0;
    const totalMs =
        activeTrack.duration || (status?.duration ? status.duration * 1000 : 0);

    const playedWidth = totalMs > 0 ? (playedMs / totalMs) * 100 : 0;
    const bufferedWidth =
        status?.bufferedPosition && status?.duration
            ? (status.bufferedPosition / status.duration) * 100
            : 0;

    const isPlaying = status ? status.playing : player.playing;

    return (
        <AppScreen backgroundColor={theme.background} statusBarStyle="dark">
            <YStack
                flex={1}
                paddingHorizontal={16}
                paddingTop={8}
                paddingBottom={16}
            >
                {/* Верхня панель */}
                <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                    marginBottom={20}
                >
                    <Button
                        onPress={() => router.back()}
                        width={42}
                        height={42}
                        borderRadius={21}
                        backgroundColor={theme.surface}
                        pressStyle={{ backgroundColor: theme.surfaceStrong }}
                        justifyContent="center"
                        alignItems="center"
                        padding={0}
                        chromeless
                    >
                        <MaterialCommunityIcons
                            name="chevron-left"
                            size={30}
                            color={theme.text}
                        />
                    </Button>

                    <YStack
                        flex={1}
                        alignItems="center"
                        justifyContent="center"
                    >
                        <Text
                            color={theme.textMuted}
                            fontSize={12}
                            fontWeight="700"
                            textTransform="uppercase"
                            letterSpacing={1.2}
                        >
                            Now playing
                        </Text>
                        <Text
                            color={theme.text}
                            fontSize={16}
                            fontWeight="700"
                            marginTop={2}
                            numberOfLines={1}
                        >
                            Listening screen
                        </Text>
                    </YStack>

                    <Button
                        width={42}
                        height={42}
                        borderRadius={21}
                        backgroundColor={theme.surface}
                        pressStyle={{ backgroundColor: theme.surfaceStrong }}
                        justifyContent="center"
                        alignItems="center"
                        padding={0}
                        chromeless
                    >
                        <MaterialCommunityIcons
                            name="playlist-music"
                            size={24}
                            color={theme.text}
                        />
                    </Button>
                </XStack>

                {/* Візуалізація обкладинки треку */}
                <YStack
                    alignItems="center"
                    justifyContent="center"
                    marginTop={8}
                    marginBottom={16}
                    minHeight={300}
                >
                    <View
                        position="absolute"
                        width={280}
                        height={280}
                        borderRadius={140}
                        backgroundColor={activeTrack.color || theme.accentSoft}
                        opacity={0.2}
                        transform={[{ scale: 1.2 }]}
                        style={{ filter: "blur(40px)" }}
                    />

                    <YStack
                        width={254}
                        height={254}
                        borderRadius={42}
                        backgroundColor={
                            activeTrack.color || theme.surfaceStrong
                        }
                        justifyContent="center"
                        alignItems="center"
                        overflow="hidden"
                        elevation={18}
                        shadowColor={theme.shadow}
                        shadowOpacity={0.2}
                        shadowRadius={24}
                        shadowOffset={{ width: 0, height: 16 }}
                    >
                        <View
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            bottom={0}
                            backgroundColor="rgba(255,255,255,0.04)"
                            zIndex={2}
                        />

                        {activeTrack.artworkUrl ? (
                            <Image
                                source={{ uri: activeTrack.artworkUrl }}
                                width="100%"
                                height="100%"
                                resizeMode="cover"
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name="music-note"
                                size={58}
                                color={theme.inverseText}
                            />
                        )}
                    </YStack>
                </YStack>

                {/* Метадані треку */}
                <YStack alignItems="center" marginBottom={16}>
                    <Text
                        color={theme.text}
                        fontSize={24}
                        lineHeight={30}
                        fontWeight="800"
                        textAlign="center"
                        numberOfLines={2}
                    >
                        {activeTrack.title}
                    </Text>
                    <Text
                        color={theme.textMuted}
                        fontSize={16}
                        fontWeight="500"
                        marginTop={8}
                        textAlign="center"
                        numberOfLines={1}
                    >
                        {activeTrack.artist}
                    </Text>
                </YStack>

                {/* Блок прогресу */}
                <YStack marginBottom={20}>
                    <XStack justifyContent="space-between" marginBottom={8}>
                        <Text
                            color={theme.textMuted}
                            fontSize={13}
                            fontWeight="600"
                        >
                            {formatTime(playedMs)}
                        </Text>
                        <Text
                            color={theme.textMuted}
                            fontSize={13}
                            fontWeight="600"
                        >
                            {formatTime(totalMs)}
                        </Text>
                    </XStack>

                    {/* Progress Rail */}
                    <View
                        height={8}
                        borderRadius={999}
                        overflow="hidden"
                        backgroundColor={theme.surfaceStrong}
                        position="relative"
                    >
                        <View
                            position="absolute"
                            left={0}
                            top={0}
                            bottom={0}
                            backgroundColor={theme.border}
                            width={`${bufferedWidth}%`}
                        />
                        <View
                            position="absolute"
                            left={0}
                            top={0}
                            bottom={0}
                            backgroundColor={theme.accent}
                            width={`${playedWidth}%`}
                        />
                    </View>
                </YStack>

                {/* Елементи керування плеєром */}
                <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    paddingHorizontal={24}
                    marginBottom={16}
                >
                    <Button
                        onPress={playPrevious}
                        width={56}
                        height={56}
                        borderRadius={28}
                        backgroundColor={theme.surface}
                        pressStyle={{ backgroundColor: theme.surfaceStrong }}
                        justifyContent="center"
                        alignItems="center"
                        padding={0}
                        chromeless
                    >
                        <MaterialCommunityIcons
                            name="skip-previous"
                            size={28}
                            color={theme.text}
                        />
                    </Button>

                    <Button
                        onPress={() => togglePlayback()}
                        width={84}
                        height={84}
                        borderRadius={42}
                        backgroundColor={theme.accent}
                        pressStyle={{ backgroundColor: theme.accentStrong }}
                        justifyContent="center"
                        alignItems="center"
                        padding={0}
                        elevation={12}
                        shadowColor={theme.shadow}
                    >
                        <MaterialCommunityIcons
                            name={isPlaying ? "pause" : "play"}
                            size={36}
                            color={theme.inverseText}
                            style={isPlaying ? undefined : { marginLeft: 4 }}
                        />
                    </Button>

                    <Button
                        onPress={playNext}
                        width={56}
                        height={56}
                        borderRadius={28}
                        backgroundColor={theme.surface}
                        pressStyle={{ backgroundColor: theme.surfaceStrong }}
                        justifyContent="center"
                        alignItems="center"
                        padding={0}
                        chromeless
                    >
                        <MaterialCommunityIcons
                            name="skip-next"
                            size={28}
                            color={theme.text}
                        />
                    </Button>
                </XStack>

                {/* Картка знизу */}
                <YStack
                    borderRadius={24}
                    padding={16}
                    backgroundColor={theme.surface}
                    borderWidth={1}
                    borderColor={theme.border}
                >
                    <View
                        width={52}
                        height={5}
                        borderRadius={999}
                        backgroundColor={theme.border}
                        marginBottom={12}
                        alignSelf="center"
                    />
                    <Text
                        color={theme.text}
                        fontSize={16}
                        fontWeight="700"
                        marginBottom={4}
                    >
                        Local library playback
                    </Text>
                    <Text
                        color={theme.textMuted}
                        fontSize={14}
                        lineHeight={20}
                        numberOfLines={2}
                    >
                        {isPlaying
                            ? "Enjoying your music tracks."
                            : "Tap play to start listening."}
                    </Text>
                </YStack>
            </YStack>
        </AppScreen>
    );
}
