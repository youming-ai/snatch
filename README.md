# Instagram X TikTok Downloader

A powerful social media downloader application built with **Astro**, **React**, **TypeScript**, and **Tailwind CSS**. Download content from Instagram, X (Twitter), and TikTok with ease.

## Features

- 🚀 **Multi-platform Support**: Download from Instagram, X (Twitter), and TikTok
- 🎨 **Modern UI**: Beautiful interface built with shadcn/ui components
- ⚡ **High Performance**: Fast and reliable downloads with Crawlee
- 🔒 **Secure**: Built-in security middleware with rate limiting
- 📱 **Responsive**: Works perfectly on all devices
- 🎯 **Type-safe**: Full TypeScript support

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- pnpm (recommended package manager)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ins-x-tiktok-downloader.git
cd ins-x-tiktok-downloader

# Install dependencies
pnpm install
```

### Development

```bash
# Start the development server
pnpm dev

# The application will be available at http://localhost:4321
```

### Building for Production

```bash
# Build the application
pnpm build

# Preview the production build
pnpm serve
```

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   └── ...
├── lib/                # Utility libraries
│   ├── adapters/       # Platform adapters
│   └── ...
├── pages/              # Astro pages
├── routes/             # API routes
├── services/           # Business logic services
├── middleware/         # Astro middleware
└── types/              # TypeScript type definitions
```

## Technology Stack

- **Framework**: [Astro](https://astro.build/) - Modern static site builder
- **UI Library**: [React](https://reactjs.org/) - Interactive components
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- **Components**: [shadcn/ui](https://ui.shadcn.com/) - High-quality UI components
- **Type Safety**: [TypeScript](https://www.typescriptlang.org/) - Type-safe development
- **Web Scraping**: [Crawlee](https://crawlee.dev/) - Reliable web scraping
- **Code Quality**: [Biome](https://biomejs.dev/) - Linting and formatting

## Available Scripts

```bash
# Development
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm serve        # Preview production build
pnpm test         # Run tests

# Code Quality
pnpm lint         # Check for linting issues
pnpm format       # Format code with Biome
pnpm check        # Run both linting and formatting checks

# Package Management
pnpm install      # Install dependencies
```

## Adding shadcn/ui Components

```bash
# Add a new component
pnpx shadcn@latest add <component-name>

# Example:
pnpx shadcn@latest add button
```

## Architecture

### Platform Adapter Pattern

The application uses a plugin-based architecture for platform support:

- **Base Interface**: Defines the common interface for all platform adapters
- **Platform Implementations**: Each platform (Instagram, Twitter, TikTok) has its own adapter
- **Adapter Registry**: Manages adapter lifecycle and discovery

### Security Features

- **Rate Limiting**: Configurable requests per minute per client
- **Input Validation**: All URLs validated against platform-specific patterns
- **XSS Prevention**: HTML tags and JavaScript protocols stripped from inputs
- **Timeout Protection**: Configurable timeout on download operations

### API Routes

- **`/api/download`**: Main endpoint for handling download requests
- **Security Headers**: Rate limiting information and error tracking
- **Error Handling**: Comprehensive error logging with sanitized messages

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

Please respect the terms of service of the social media platforms and use this tool responsibly. The authors are not responsible for any misuse of this software.

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/yourusername/ins-x-tiktok-downloader/issues) on GitHub.