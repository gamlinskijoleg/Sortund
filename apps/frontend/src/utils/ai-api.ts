import { log } from "./logger";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";

export type AnalyzeResult = {
    title: string;
    artist: string;
    album: string | null;
    year: number | null;
    analysis_source: string;
    tags: string[];
};

export async function analyzeTrackAPI(
    sourceUri: string
): Promise<AnalyzeResult> {
    const aiServiceUrl = process.env.EXPO_PUBLIC_AI_SERVICE_URL;
    if (!aiServiceUrl) {
        throw new Error("EXPO_PUBLIC_AI_SERVICE_URL is not set");
    }

    const endpoint = `${aiServiceUrl.replace(/\/$/, "")}/v1/analyze-track`;

    log.debug(`Uploading ${sourceUri} to ${endpoint}...`);
    // uploadAsync автоматично формує multipart/form-data
    const response = await uploadAsync(endpoint, sourceUri, {
        fieldName: "file", // Це ім'я поля, яке очікує ваш бекенд
        httpMethod: "POST",
        uploadType: FileSystemUploadType.MULTIPART,
    });

    if (response.status !== 200) {
        throw new Error(`AI API Error (${response.status}): ${response.body}`);
    }

    const data: AnalyzeResult = JSON.parse(response.body);
    log.debug(`AI API Response: ${JSON.stringify(data)}`);
    return data;
}
