# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm serve

# Run tests
pnpm test

# Code quality
pnpm lint          # Check for linting issues
pnpm format        # Format code with Biome
pnpm check          # Run both linting and formatting checks

# Add shadcn/ui components
pnpx shadcn@latest add <component-name>

# Install dependencies
pnpm install
```

## Architecture Overview

This is a social media downloader application built with **TanStack Start** (SSR-enabled React framework), **TypeScript**, **shadcn/ui**, and **Tailwind CSS**. The application supports downloading content from Instagram, X (Twitter), and TikTok with a focus on security, performance, and maintainability.

### Core Architecture Patterns

#### 1. Platform Adapter Pattern
The application uses a plugin-based architecture for platform support:

- **Base Interface**: `src/lib/adapters.ts` defines the `PlatformAdapter` interface and base class
- **Platform Implementations**: Each platform (Instagram, Twitter, TikTok) has its own adapter in `src/lib/adapters.ts`
- **Adapter Registry**: `src/lib/adapters/adapter-registry.ts` manages adapter lifecycle and provides discovery using a singleton pattern
- **Crawlee Downloaders**: Each adapter uses Crawlee-based downloaders in `src/lib/crawlee-downloaders/` for robust web scraping with Playwright

#### 2. Unified Download Service
All download operations go through the `UnifiedDownloadService` (`src/services/unified-download.service.ts`):
- **Singleton Pattern**: Ensures consistent state across the application
- **Security First**: URL validation, sanitization, and 30-second timeout protection
- **Type Safe**: Comprehensive TypeScript interfaces for all data flow
- **Error Handling**: Consistent error handling with detailed logging and user-friendly messages
- **CORS Handling**: Graceful handling of browser security restrictions

#### 3. Security Middleware Layer
Comprehensive security implementation in `src/middleware/security.ts`:
- **Rate Limiting**: 10 requests per minute per client with IP-based identification
- **Input Sanitization**: All inputs validated and sanitized before processing
- **CSRF Protection**: Token-based protection against cross-site request forgery
- **Bot Detection**: Basic pattern matching for suspicious user agents

#### 4. Type System Architecture
- **Core Types**: `src/types/download.ts` contains all essential type definitions
- **Platform Configuration**: `src/constants/platforms.ts` centralizes platform metadata and URL patterns
- **URL Validation**: `src/lib/validation.ts` provides secure URL parsing and platform detection with regex-based pattern matching

### Key Architectural Decisions

1. **TanStack Start over Next.js**: Chosen for superior SSR performance, file-based routing, and developer experience
2. **shadcn/ui over HeroUI**: Better compatibility with TanStack Start and more maintainable component patterns
3. **Adapter Pattern**: Enables easy addition of new social media platforms without core system changes
4. **Service Layer Isolation**: Business logic separated from UI components for better testability
5. **Type-First Development**: All external dependencies are wrapped with proper TypeScript interfaces
6. **Singleton Services**: Download service and adapter registry use singleton pattern for consistent state management

### File Structure Highlights

```
src/
├── types/download.ts              # Core type definitions for the download system
├── constants/platforms.ts         # Platform configurations and URL patterns
├── lib/
│   ├── validation.ts              # URL validation and platform detection
│   ├── adapters.ts                # Platform adapters (Instagram, Twitter, TikTok)
│   ├── adapters/
│   │   └── adapter-registry.ts   # Adapter management and discovery
│   ├── enhanced-crawlee-downloader.ts  # Base Crawlee downloader class
│   └── crawlee-downloaders/       # Crawlee-based download implementations
│       ├── instagram-crawlee-downloader.ts  # Instagram Crawlee downloader
│       ├── twitter-crawlee-downloader.ts    # Twitter/X Crawlee downloader
│       └── tiktok-crawlee-downloader.ts     # TikTok Crawlee downloader
├── middleware/
│   └── security.ts                # Security middleware (rate limiting, validation, sanitization)
├── services/
│   └── unified-download.service.ts # Main service orchestrating downloads
├── components/                    # React components
│   ├── ui/                       # shadcn/ui components
│   ├── DownloadForm.tsx           # Main download interface
│   ├── ResultsDisplay.tsx         # Results presentation
│   └── [other components...]      # UI components
├── routes/
│   ├── index.tsx                  # Main application page (600+ lines - needs decomposition)
│   ├── __root.tsx                 # Root layout and providers
│   └── api/download.ts            # API endpoint for download requests
```

### Adding New Platform Support

1. **Create Crawlee Downloader**:
   ```typescript
   // src/lib/crawlee-downloaders/newplatform-crawlee-downloader.ts
   export class NewPlatformCrawleeDownloader extends EnhancedCrawleeDownloader {
     constructor(options: EnhancedCrawleeOptions = {}) {
       super("newplatform", options);
     }
     
     protected async extractFromPage(page: any, url: string, log: any): Promise<ExtractedData | null> {
       // Platform-specific extraction implementation using Playwright
     }
   }
   ```

2. **Create Platform Adapter**:
   ```typescript
   // Add to src/lib/adapters.ts
   export class NewPlatformAdapter extends BasePlatformAdapter {
     readonly platform: SupportedPlatform = "newplatform";
     readonly name = "New Platform";
     
     private crawleeDownloader = new NewPlatformCrawleeDownloader();
     
     // Implement required methods: canHandle, extractId, download
   }
   ```

3. **Add Platform Configuration**:
   Update `src/constants/platforms.ts` with platform metadata and URL patterns

4. **Register Adapter**:
   Add to `adapter-registry.ts` initialization in `initializeAdapters()` method

5. **Update Types**:
   Add platform to `SupportedPlatform` union type in `src/types/download.ts`

### Development Environment Configuration

- **Package Manager**: Uses `pnpm` (scripts defined in package.json)
- **Code Quality**: Biome for linting and formatting with tab indentation and double quotes
- **Vite Configuration**: TanStack Start plugin with React and Tailwind CSS integration
- **Path Aliases**: Configured through `vite-tsconfig-paths` for clean imports
- **Build Tools**: Vite with React plugin for fast development and optimized builds
- **Testing Framework**: Vitest with Testing Library integration (configured but no tests yet)

### Security Considerations

- **Rate Limiting**: In-memory rate limiting with automatic cleanup every 5 minutes
- **Input Validation**: All URLs validated against platform-specific regex patterns
- **XSS Prevention**: HTML tags, JavaScript protocols, and event handlers stripped from inputs
- **URL Sanitization**: Dangerous query parameters removed and protocol validation enforced
- **Timeout Protection**: 30-second timeout on all download operations
- **Error Handling**: Comprehensive error logging with sanitized user messages
- **CORS Handling**: Graceful degradation with user-friendly error messages

### API Architecture

- **Endpoint**: `POST /api/download` handles all download requests
- **Rate Limiting Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Security Headers**: `Retry-After` for rate limits, `X-Error-ID` for debugging
- **Response Format**: Consistent JSON structure with success/error states
- **Error Handling**: Different HTTP status codes for different error types

### Development Workflow

1. **Feature Development**: Work in feature branches, use `pnpm dev` for hot reloading on port 3000
2. **Component Development**: Use shadcn/ui components as base, extend with custom variants
3. **API Integration**: All external API calls go through the unified download service
4. **Code Quality**: Run `pnpm check` before commits to ensure linting and formatting
5. **Testing**: Vitest is configured with Testing Library but currently has no tests - this is a priority
6. **Package Management**: The project uses pnpm for dependency management

### Known Issues & Technical Debt

- **No Test Coverage**: Vitest is configured but no tests exist (high priority)
- **Large Main Component**: `src/routes/index.tsx` is 600+ lines and needs component decomposition
- **Missing Error Boundaries**: React error boundaries should be implemented for better error handling
- **Bundle Size**: Icon imports could be optimized with tree shaking
- **Memory Leaks**: Rate limiting data cleanup should be monitored in production
- **No Persistence**: Rate limiting is in-memory and resets on server restart

### Performance Considerations

- **SSR Benefits**: TanStack Start provides server-side rendering for better initial page loads
- **Code Splitting**: File-based routing enables automatic code splitting
- **Image Optimization**: Images should use `loading="lazy"` and proper fallbacks
- **Bundle Analysis**: Regular bundle size monitoring recommended
- **Memory Management**: Automatic cleanup of rate limiting data prevents memory leaks
- **Singleton Pattern**: Reduces object creation overhead and memory usage