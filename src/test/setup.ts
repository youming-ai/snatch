import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock IntersectionObserver for OptimizedImage component
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}));

// Mock crypto.getRandomValues for CSRF token generation
Object.defineProperty(global, "crypto", {
	value: {
		getRandomValues: vi.fn().mockReturnValue(new Uint8Array(32)),
	},
});

// Mock fetch API for download service tests
global.fetch = vi.fn();

// Mock URL constructor
global.URL = class URL {
	public protocol: string;
	public hostname: string;
	public pathname: string;
	public search: string;
	public searchParams: URLSearchParams;

	constructor(
		public href: string,
		base?: string,
	) {
		// Simple URL parsing for testing
		const urlMatch = href.match(/^(\w+):\/\/([^/]+)(\/.*)?$/);
		if (urlMatch) {
			this.protocol = urlMatch[1] + ":";
			this.hostname = urlMatch[2];
			this.pathname = urlMatch[3] || "/";
			this.search = "";
			this.searchParams = new URLSearchParams();
		} else {
			// Throw error for invalid URLs (like real URL constructor)
			throw new Error(`Invalid URL: ${href}`);
		}
	}

	toString() {
		return this.href;
	}
};

// Mock btoa for CSRF token validation
global.btoa = (str: string) => Buffer.from(str).toString("base64");

// Mock atob for CSRF token validation
global.atob = (str: string) => Buffer.from(str, "base64").toString("utf-8");
