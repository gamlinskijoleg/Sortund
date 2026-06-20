import { saveBase64ArtworkAsync } from "./file-utils";
import { Directory, File } from "expo-file-system";
import { log } from "./logger";

// Mock expo-file-system
jest.mock("expo-file-system", () => {
    return {
        Paths: {
            cache: "mock-cache-path",
        },
        Directory: jest.fn().mockImplementation(() => {
            return {
                exists: false,
                create: jest.fn(),
            };
        }),
        File: jest.fn().mockImplementation((dir, filename) => {
            return {
                write: jest.fn(),
                uri: `file://mock-cache-path/artwork/${filename}`,
            };
        }),
    };
});

// Mock logger
jest.mock("./logger", () => ({
    log: {
        warn: jest.fn(),
    },
}));

describe("file-utils", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("saveBase64ArtworkAsync", () => {
        it("should save a base64 string to a file and return the URI", async () => {
            const base64Str =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
            const assetId = "test-asset-123";

            const result = await saveBase64ArtworkAsync(base64Str, assetId);

            expect(Directory).toHaveBeenCalledWith("mock-cache-path", "artwork");
            expect(File).toHaveBeenCalled();
            expect(result).toBe(`file://mock-cache-path/artwork/cover_test-asset-123.png`);
        });

        it("should log a warning and return null if an error occurs", async () => {
            // Mock File to throw an error on write
            const mockWrite = jest.fn().mockImplementation(() => {
                throw new Error("Write failed");
            });
            (File as jest.Mock).mockImplementationOnce((dir, filename) => {
                return {
                    write: mockWrite,
                    uri: `file://mock-cache-path/artwork/${filename}`,
                };
            });

            const base64Str = "data:image/png;base64,invalid-base64";
            const result = await saveBase64ArtworkAsync(base64Str);

            expect(result).toBeNull();
            expect(log.warn).toHaveBeenCalledWith(
                "Failed to save base64 artwork string to file",
                expect.any(Error)
            );
        });
    });
});
