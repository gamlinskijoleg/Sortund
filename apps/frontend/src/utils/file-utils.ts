import { Directory, File, Paths } from "expo-file-system";
import { log } from "./logger";

export async function saveBase64ArtworkAsync(
    base64WithPrefix: string,
    assetId?: string
): Promise<string | null> {
    try {
        const regex = /^data:image\/\w+;base64,/;
        const base64Data = base64WithPrefix.replace(regex, "");

        const cacheDir = new Directory(Paths.cache, "artwork");
        if (!cacheDir.exists) {
            cacheDir.create();
        }

        const filename = `cover_${assetId || Date.now()}.png`;
        const targetFile = new File(cacheDir, filename);

        targetFile.write(base64Data, { encoding: "base64" });
        return targetFile.uri;
    } catch (error) {
        log.warn("Failed to save base64 artwork string to file", error);
        return null;
    }
}
