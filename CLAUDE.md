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

# Run single test file
pnpm test src/path/to/test.test.ts
```

## Architecture Overview

This is a social media downloader application built with **Astro**, **React**, **TypeScript**, **shadcn/ui**, and **Tailwind CSS**. The application supports downloading content from Instagram, X (Twitter), and TikTok with a focus on security, performance, and maintainability.

### Core Architecture Patterns

#### 1. Platform Adapter Pattern
The application uses a plugin-based architecture for platform support:

- **Base Interface**: `src/lib/adapters.ts` defines the `PlatformAdapter` interface and base class
- **Platform Implementations**: Each platform (Instagram, Twitter, TikTok) has its own adapter in `src/lib/adapters.ts`
- **Adapter Registry**: `src/lib/adapters/adapter-registry.ts` manages adapter lifecycle and provides discovery using a singleton pattern
- **API-Based Downloaders**: Each platform uses specialized API downloaders in `src/lib/api-downloaders/` for efficient data extraction

#### 2. Dual Download Service Architecture
The application implements both server-side and client-side download services:

- **UnifiedDownloadService** (`src/services/unified-download.service.ts`): Server-side service with full browser automation capabilities
- **ClientDownloadService** (`src/services/client-download.service.ts`): Client-side service for direct API calls when possible
- **Service Selection**: `environment-detector.ts` automatically chooses the appropriate service based on the runtime environment

#### 3. Security Middleware Layer
Comprehensive security implementation in `src/middleware/security.ts`:
- **Rate Limiting**: Configurable requests per minute per client with IP-based identification
- **Input Sanitization**: All inputs validated and sanitized before processing
- **XSS Prevention**: HTML tags, JavaScript protocols, and event handlers stripped from inputs
- **Bot Detection**: Basic pattern matching for suspicious user agents

#### 4. Type System Architecture
- **Core Types**: `src/types/download.ts` contains all essential type definitions
- **Platform Configuration**: `src/constants/platforms.ts` centralizes platform metadata and URL patterns
- **URL Validation**: `src/lib/validation.ts` provides secure URL parsing and platform detection with regex-based pattern matching

### Key Architectural Decisions

1. **Astro over Next.js**: Chosen for superior performance, content-first architecture, and developer experience
2. **shadcn/ui Components**: Pre-built components with consistent design system
3. **Adapter Pattern**: Enables easy addition of new social media platforms without core system changes
4. **Service Layer Isolation**: Business logic separated from UI components for better testability
5. **Type-First Development**: All external dependencies are wrapped with proper TypeScript interfaces
6. **Dual Service Architecture**: Server-side for complex scraping, client-side for direct API calls

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
│   ├── api-downloaders/           # API-based download implementations
│   │   ├── instagram-api-downloader.ts  # Instagram API downloader
│   │   ├── twitter-api-downloader.ts    # Twitter/X API downloader
│   │   ├── tiktok-api-downloader.ts     # TikTok API downloader
│   │   └── index.ts                      # Export barrel
│   └── environment.ts              # Environment configuration utilities
├── middleware/
│   └── security.ts                # Astro middleware (rate limiting, validation, sanitization)
├── services/
│   ├── unified-download.service.ts # Server-side download service
│   └── client-download.service.ts  # Client-side download service
├── components/                    # React components
│   ├── ui/                       # shadcn/ui components
│   ├── DownloaderInput.tsx        # URL input component
│   ├── DownloadResult.tsx         # Result display component
│   └── [other components...]      # UI components
├── pages/
│   ├── index.astro                # Main application page
│   └── layout.astro               # Root layout and providers
├── routes/                        # API routes
│   └── download.ts                # API endpoint for download requests
├── utils/
│   └── environment-detector.ts    # Runtime environment detection
└── config/
    └── env.ts                     # Environment configuration
```

### Adding New Platform Support

1. **Create API Downloader**:
   ```typescript
   // src/lib/api-downloaders/newplatform-api-downloader.ts
   import { createBaseDownloader } from "./index";

   export const newPlatformDownloader = createBaseDownloader({
     platformName: "newplatform",
     downloadFunction: async (url: string) => {
       // Platform-specific download implementation
     },
   });
   ```

2. **Create Platform Adapter**:
   ```typescript
   // Add to src/lib/adapters.ts
   export class NewPlatformAdapter extends BasePlatformAdapter {
     readonly platform: SupportedPlatform = "newplatform";
     readonly name = "New Platform";

     protected async downloadWithMethod(url: string): Promise<DownloadResult> {
       return this.apiDownloader(url);
     }
   }
   ```

3. **Add Platform Configuration**:
   Update `src/constants/platforms.ts` with platform metadata and URL patterns

4. **Register Adapter**:
   Add to adapter-registry.ts initialization in `initializeAdapters()` method

5. **Update Types**:
   Add platform to `SupportedPlatform` union type in `src/types/download.ts`

### Development Environment Configuration

- **Package Manager**: Uses `pnpm` (scripts defined in package.json)
- **Code Quality**: Biome for linting and formatting with tab indentation and double quotes
- **Astro Configuration**: Astro with React integration and Tailwind CSS plugin
- **Path Aliases**: `@/*` mapped to `./src/*` for clean imports
- **Build Tools**: Astro's optimized build system for fast development and production builds
- **Testing Framework**: Vitest with Testing Library integration (configured with test files in __tests__ directories)

### Security Considerations

- **Rate Limiting**: In-memory rate limiting with configurable window and max requests
- **Input Validation**: All URLs validated against platform-specific regex patterns
- **XSS Prevention**: HTML tags, JavaScript protocols, and event handlers stripped from inputs
- **URL Sanitization**: Dangerous query parameters removed and protocol validation enforced
- **Timeout Protection**: Configurable timeout on download operations (default 30 seconds)
- **Error Handling**: Comprehensive error logging with sanitized user messages
- **CORS Handling**: Graceful degradation with user-friendly error messages

### API Architecture

- **Endpoint**: `POST /api/download` handles all download requests
- **Rate Limiting Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Security Headers**: `Retry-After` for rate limits, `X-Error-ID` for debugging
- **Response Format**: Consistent JSON structure with success/error states
- **Error Handling**: Different HTTP status codes for different error types

### Development Workflow

1. **Feature Development**: Work in feature branches, use `pnpm dev` for hot reloading on port 4321
2. **Component Development**: Use shadcn/ui components as base, extend with custom variants
3. **API Integration**: All external API calls go through the appropriate download service
4. **Code Quality**: Run `pnpm check` before commits to ensure linting and formatting
5. **Testing**: Test files are located in `__tests__` directories alongside source files
6. **Package Management**: The project uses pnpm for dependency management

### Known Issues & Technical Debt

- **Limited Test Coverage**: Tests exist but need expansion (high priority)
- **Main Component Size**: `src/pages/index.astro` might benefit from further decomposition
- **Missing Error Boundaries**: React error boundaries should be implemented for better error handling
- **Bundle Size**: Icon imports could be optimized with tree shaking
- **Memory Leaks**: Rate limiting data cleanup should be monitored in production
- **No Persistence**: Rate limiting is in-memory and resets on server restart

### Performance Considerations

- **SSR/SSG Benefits**: Astro provides server-side rendering and static site generation for optimal performance
- **Code Splitting**: Astro's automatic code splitting for optimal loading
- **Image Optimization**: Images should use `loading="lazy"` and proper fallbacks
- **Bundle Analysis**: Regular bundle size monitoring recommended
- **Memory Management**: Automatic cleanup of rate limiting data prevents memory leaks
- **Dual Service Pattern**: Client-side service reduces server load when direct API calls are possible