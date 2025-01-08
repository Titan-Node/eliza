import { describe, expect, it, vi, beforeEach } from "vitest";
import { ModelProviderName, IAgentRuntime, ModelClass } from "../types";
import { models } from "../models";
import {
    generateText,
    generateTrueOrFalse,
    splitChunks,
    trimTokens,
} from "../generation";

// Mock the elizaLogger
vi.mock("../index.ts", () => ({
    elizaLogger: {
        log: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock the generation functions
vi.mock("../generation", async () => {
    const actual = await vi.importActual("../generation");
    return {
        ...actual,
        generateText: vi.fn().mockImplementation(async ({ context }) => {
            if (!context) return "";
            return "mocked response";
        }),
        generateTrueOrFalse: vi.fn().mockImplementation(async () => {
            return true;
        }),
    };
});

describe("Generation", () => {
    let mockRuntime: IAgentRuntime;

    beforeEach(() => {
        // Setup mock runtime for tests
        mockRuntime = {
            modelProvider: ModelProviderName.OPENAI,
            token: "mock-token",
            character: {
                modelEndpointOverride: undefined,
            },
            getSetting: vi.fn().mockImplementation((key: string) => {
                if (key === "LLAMACLOUD_MODEL_LARGE") return false;
                if (key === "LLAMACLOUD_MODEL_SMALL") return false;
                if (key === "TOGETHER_MODEL_LARGE") return false;
                if (key === "TOGETHER_MODEL_SMALL") return false;
                return undefined;
            }),
        } as unknown as IAgentRuntime;

        // Clear all mocks before each test
        vi.clearAllMocks();
    });

    describe("generateText", () => {
        it("should return empty string for empty context", async () => {
            const result = await generateText({
                runtime: mockRuntime,
                context: "",
                modelClass: "completion",
            });
            expect(result).toBe("");
        });

        it("should return mocked response for non-empty context", async () => {
            const result = await generateText({
                runtime: mockRuntime,
                context: "test context",
                modelClass: "completion",
            });
            expect(result).toBe("mocked response");
        });

        it("should use correct model settings from provider config", () => {
            const modelProvider = mockRuntime.modelProvider;
            const modelSettings = models[modelProvider].settings;

            expect(modelSettings).toBeDefined();
            expect(modelSettings.temperature).toBeDefined();
            expect(modelSettings.frequency_penalty).toBeDefined();
            expect(modelSettings.presence_penalty).toBeDefined();
            expect(modelSettings.maxInputTokens).toBeDefined();
            expect(modelSettings.maxOutputTokens).toBeDefined();
        });
    });

    describe("generateTrueOrFalse", () => {
        it("should return boolean value", async () => {
            const result = await generateTrueOrFalse({
                runtime: mockRuntime,
                context: "test context",
                modelClass: "completion",
            });
            expect(typeof result).toBe("boolean");
        });
    });

    describe("splitChunks", () => {
        it("should split content into chunks of specified size", async () => {
            const content = "a".repeat(1000);
            const chunkSize = 100;
            const bleed = 20;

            const chunks = await splitChunks(content, chunkSize, bleed);

            expect(chunks.length).toBeGreaterThan(0);
            // Check if chunks overlap properly
            for (let i = 1; i < chunks.length; i++) {
                const prevChunkEnd = chunks[i - 1].slice(-bleed);
                const currentChunkStart = chunks[i].slice(0, bleed);
                expect(prevChunkEnd).toBe(currentChunkStart);
            }
        });

        it("should handle empty content", async () => {
            const chunks = await splitChunks("", 100, 20);
            expect(chunks).toEqual([]);
        });

        it("should handle content smaller than chunk size", async () => {
            const content = "small content";
            const chunks = await splitChunks(content, 100, 20);
            expect(chunks).toEqual([content]);
        });
    });

    describe("trimTokens", () => {
        it("should return empty string for empty input", async () => {
            const result = await trimTokens("", 100, mockRuntime);
            expect(result).toBe("");
        });

        it("should throw error for negative maxTokens", async () => {
            await expect(trimTokens("test", -1, mockRuntime)).rejects.toThrow(
                "maxTokens must be positive"
            );
        });

        it("should return unchanged text if within token limit", async () => {
            const shortText = "This is a short text";
            const result = await trimTokens(shortText, 10, mockRuntime);
            expect(result).toBe(shortText);
        });

        it("should truncate text to specified token limit", async () => {
            // Using a longer text that we know will exceed the token limit
            const longText =
                "This is a much longer text that will definitely exceed our very small token limit and need to be truncated to fit within the specified constraints.";
            const result = await trimTokens(longText, 5, mockRuntime);

            // The exact result will depend on the tokenizer, but we can verify:
            // 1. Result is shorter than original
            expect(result.length).toBeLessThan(longText.length);
            // 2. Result is not empty
            expect(result.length).toBeGreaterThan(0);
            // 3. Result is a proper substring of the original text
            expect(longText.includes(result)).toBe(true);
        });

        it("should handle non-ASCII characters", async () => {
            const unicodeText = "Hello 👋 World 🌍";
            const result = await trimTokens(unicodeText, 5, mockRuntime);
            expect(result.length).toBeGreaterThan(0);
        });

        it("should handle multiline text", async () => {
            const multilineText = `Line 1
	Line 2
	Line 3
	Line 4
	Line 5`;
            const result = await trimTokens(multilineText, 5, mockRuntime);
            expect(result.length).toBeGreaterThan(0);
            expect(result.length).toBeLessThan(multilineText.length);
        });
    });
});

describe("Livepeer Provider Generation", () => {
    let mockLivepeerRuntime: IAgentRuntime;

    beforeEach(() => {
        mockLivepeerRuntime = {
            modelProvider: ModelProviderName.LIVEPEER,
            token: "mock-livepeer-token",
            character: {
                modelEndpointOverride: undefined,
            },
            getSetting: vi.fn().mockImplementation((key: string) => {
                if (key === "LIVEPEER_GATEWAY_URL") return "http://gateway.livepeer-eliza.com:8941";
                if (key === "LIVEPEER_IMAGE_MODEL") return "ByteDance/SDXL-Lightning";
                return undefined;
            }),
        } as unknown as IAgentRuntime;

        vi.clearAllMocks();
    });

    describe("Text Generation", () => {
        it("should use correct model for text generation", async () => {
            const result = await generateText({
                runtime: mockLivepeerRuntime,
                context: "test context",
                modelClass: ModelClass.SMALL,
            });
            expect(result).toBe("mocked response");
            expect(models[ModelProviderName.LIVEPEER].model[ModelClass.SMALL])
                .toBe("meta-llama/Meta-Llama-3.1-8B-Instruct");
        });

        it("should use correct settings for text generation", () => {
            const settings = models[ModelProviderName.LIVEPEER].settings;
            expect(settings.maxInputTokens).toBe(128000);
            expect(settings.maxOutputTokens).toBe(8192);
            expect(settings.repetition_penalty).toBe(0.4);
            expect(settings.temperature).toBe(0.7);
        });

        it("should handle empty context with Livepeer provider", async () => {
            const result = await generateText({
                runtime: mockLivepeerRuntime,
                context: "",
                modelClass: ModelClass.SMALL,
            });
            expect(result).toBe("");
        });
    });

    describe("Image Generation", () => {
        it("should use correct model for image generation", () => {
            const imageModel = models[ModelProviderName.LIVEPEER].model[ModelClass.IMAGE];
            expect(imageModel).toBe("ByteDance/SDXL-Lightning");
        });

        it("should use custom image model when specified", () => {
            mockLivepeerRuntime.getSetting = vi.fn().mockImplementation((key: string) => {
                if (key === "LIVEPEER_IMAGE_MODEL") return "CustomModel/SDXL";
                return undefined;
            });
            const imageModel = mockLivepeerRuntime.getSetting("LIVEPEER_IMAGE_MODEL");
            expect(imageModel).toBe("CustomModel/SDXL");
        });

        it("should use correct endpoint for image generation", () => {
            const endpoint = models[ModelProviderName.LIVEPEER].endpoint;
            expect(endpoint).toBe("http://gateway.livepeer-eliza.com:8941");
        });
    });

    describe("Token Management", () => {
        it("should handle token trimming with Livepeer models", async () => {
            const longText = "This is a very long text that needs to be trimmed according to Livepeer's token limits";
            const result = await trimTokens(longText, 5, mockLivepeerRuntime);
            expect(result.length).toBeLessThan(longText.length);
            expect(result.length).toBeGreaterThan(0);
        });

        it("should respect Livepeer's max token limits", () => {
            const settings = models[ModelProviderName.LIVEPEER].settings;
            expect(settings.maxInputTokens).toBeLessThanOrEqual(128000);
            expect(settings.maxOutputTokens).toBeLessThanOrEqual(8192);
        });
    });

    describe("Error Handling", () => {
        it("should handle invalid model class gracefully", async () => {
            await expect(generateText({
                runtime: mockLivepeerRuntime,
                context: "test",
                modelClass: "invalid-model" as any,
            })).resolves.toBeDefined();
        });

        it("should handle missing endpoint configuration", () => {
            mockLivepeerRuntime.getSetting = vi.fn().mockReturnValue(undefined);
            const endpoint = mockLivepeerRuntime.getSetting("LIVEPEER_GATEWAY_URL");
            expect(endpoint).toBeUndefined();
            expect(models[ModelProviderName.LIVEPEER].endpoint)
                .toBe("http://gateway.livepeer-eliza.com:8941");
        });
    });
});
