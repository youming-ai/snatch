import { beforeEach, describe, expect, it, vi } from "vitest";
import { adapterRegistry } from "@/lib/adapters/adapter-registry";
import type { DownloadResult } from "@/types/download";
import { UnifiedDownloadService } from "../unified-download.service";

// Mock the adapter registry
vi.mock("@/lib/adapters/adapter-registry", () => ({
	adapterRegistry: {
		getAdapter: vi.fn(),
		getSupportedPlatforms: vi.fn(),
	},
}));

describe("UnifiedDownloadService", () => {
	let service: UnifiedDownloadService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = UnifiedDownloadService.getInstance();
	});

	describe("Singleton pattern", () => {
		it("should return the same instance", () => {
			const instance1 = UnifiedDownloadService.getInstance();
			const instance2 = UnifiedDownloadService.getInstance();
			expect(instance1).toBe(instance2);
		});
	});

	describe("error handling", () => {
		it("should handle invalid URLs", async () => {
			const result = await service.download("invalid-url");
			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		it("should handle empty URLs", async () => {
			const result = await service.download("");
			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe("download method", () => {
		it("should successfully download content", async () => {
			const mockResult: DownloadResult = {
				id: "test-id",
				type: "video",
				url: "https://instagram.com/p/123",
				thumbnail: "https://example.com/thumb.jpg",
				downloadUrl: "https://example.com/download.mp4",
				title: "Test Video",
				size: "10 MB",
				platform: "instagram",
				quality: "hd",
			};

			const mockAdapter = {
				platform: "instagram",
				name: "Instagram",
				canHandle: () => true,
				download: vi.fn().mockResolvedValue([mockResult]),
				extractId: () => "test-id",
			};

			vi.mocked(adapterRegistry.getAdapter).mockReturnValue(mockAdapter as any);

			const result = await service.download("https://instagram.com/p/123");

			expect(result.success).toBe(true);
			expect(result.results).toHaveLength(1);
			expect(result.results?.[0].id).toBe("test-id");
		});

		it("should preserve isMock flag", async () => {
			const mockResult: DownloadResult = {
				id: "test-id-mock",
				type: "video",
				url: "https://instagram.com/p/mock",
				thumbnail: "https://example.com/thumb.jpg",
				downloadUrl: "https://example.com/download.mp4",
				title: "Mock Video",
				size: "10 MB",
				platform: "instagram",
				quality: "hd",
				isMock: true,
			};

			const mockAdapter = {
				platform: "instagram",
				name: "Instagram",
				canHandle: () => true,
				download: vi.fn().mockResolvedValue([mockResult]),
				extractId: () => "test-id-mock",
			};

			vi.mocked(adapterRegistry.getAdapter).mockReturnValue(mockAdapter as any);

			const result = await service.download("https://instagram.com/p/mock");

			expect(result.success).toBe(true);
			expect(result.results?.[0].isMock).toBe(true);
		});
	});
});
