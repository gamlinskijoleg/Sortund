import { log } from "./logger";
import {
    cacheDirectory,
    deleteAsync,
    downloadAsync,
    FileSystemUploadType,
    makeDirectoryAsync,
    readAsStringAsync,
    uploadAsync,
    writeAsStringAsync,
} from "expo-file-system/legacy";

export type AnalyzeResult = {
    title: string;
    artist: string;
    album: string | null;
    year: number | null;
    analysis_source: string;
    tags: string[];
    genre: string | null;
    date: string | null;
    rating: number | null;
    artwork: string | null;
};

export async function analyzeTrackAPI(sourceUri: string): Promise<AnalyzeResult> {
    const aiServiceUrl = process.env.EXPO_PUBLIC_AI_SERVICE_URL;
    if (!aiServiceUrl) {
        throw new Error("EXPO_PUBLIC_AI_SERVICE_URL is not set");
    }

    const endpoint = `${aiServiceUrl.replace(/\/$/, "")}/v1/analyze-track`;

    let finalUri = sourceUri;
    let isTrimmed = false;

    // Only attempt byte-slicing for MP3 files to avoid corrupting other containers
    if (sourceUri.toLowerCase().endsWith(".mp3")) {
        try {
            log.debug(`Attempting fast byte-slicing for MP3...`);
            const originalFilename = sourceUri.split("/").pop() || `sliced_${Date.now()}.mp3`;
            const tempDir = `${cacheDirectory}sliced_${Date.now()}/`;
            await makeDirectoryAsync(tempDir, { intermediates: true }).catch(() => {});
            const targetUri = `${tempDir}${originalFilename}`;
            const chunk = await readAsStringAsync(sourceUri, {
                encoding: "base64",
                position: 0,
                length: 0.5 * 1024 * 1024, // Read the first 0.5 MB of the file
            });
            await writeAsStringAsync(targetUri, chunk, {
                encoding: "base64",
            });
            finalUri = targetUri;
            isTrimmed = true;
            log.debug(`Byte-slicing successful: ${finalUri}`);
        } catch (e) {
            log.warn(`Byte-slicing failed (falling back to original): ${String(e)}`);
        }
    }

    log.debug(`Uploading ${finalUri} to ${endpoint}...`);
    // uploadAsync automatically forms multipart/form-data
    const response = await uploadAsync(endpoint, finalUri, {
        fieldName: "file", // This is the field name expected by your backend
        httpMethod: "POST",
        uploadType: FileSystemUploadType.MULTIPART,
    });

    if (isTrimmed) {
        const tempDir = finalUri.substring(0, finalUri.lastIndexOf("/") + 1);
        await deleteAsync(tempDir, { idempotent: true }).catch(() => {});
    }

    if (response.status !== 200) {
        throw new Error(`AI API Error (${response.status}): ${response.body}`);
    }

    const data = JSON.parse(response.body) as AnalyzeResult;
    log.debug(`AI API Response: ${JSON.stringify(data)}`);
    return data;
}

export async function downloadArtworkAsync(url: string, assetId: string): Promise<string | null> {
    try {
        const artworkDir = `${cacheDirectory}artwork/`;
        await makeDirectoryAsync(artworkDir, { intermediates: true }).catch(() => {});

        const extMatch = url.match(/\.(jpg|jpeg|png|webp|gif)/i);
        const ext = extMatch ? extMatch[1] : "jpg";
        const filename = `art_${assetId || Date.now()}_${Date.now()}.${ext}`;
        const targetUri = `${artworkDir}${filename}`;

        const result = await downloadAsync(url, targetUri);
        if (result.status === 200) {
            return result.uri;
        }
        return null;
    } catch (e) {
        log.warn("Failed to download artwork:", e);
        return null;
    }
}
