import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Download,
  Link2,
  Instagram,
  Twitter,
  Music,
  Loader2,
  CheckCircle,
  XCircle,
  Video,
  Image,
} from "lucide-react";
import { DownloaderInput } from "../components/DownloaderInput";
import { DownloadResult } from "../components/DownloadResult";
import {
  downloadFromUrl,
  type DownloadResult as DownloadResultType,
} from "../services/downloadService";

export const Route = createFileRoute("/")({ component: App });

function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DownloadResultType[]>([]);
  const [error, setError] = useState<string | null>(null);

  const detectPlatform = (
    url: string,
  ): "instagram" | "twitter" | "tiktok" | null => {
    if (url.includes("instagram.com")) return "instagram";
    if (url.includes("x.com") || url.includes("twitter.com")) return "twitter";
    if (url.includes("tiktok.com")) return "tiktok";
    return null;
  };

  const handleDownload = async () => {
    if (!url.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    const platform = detectPlatform(url);
    if (!platform) {
      setError(
        "Unsupported platform. Please enter Instagram, X (Twitter), or TikTok URL",
      );
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      // Use the real download service
      const downloadResults = await downloadFromUrl(url);
      setResults(downloadResults);
    } catch (err) {
      console.error("Download error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to download content. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const supportedPlatforms = [
    {
      name: "Instagram",
      icon: <Instagram className="w-8 h-8" />,
      color: "from-purple-500 to-pink-500",
      example: "instagram.com/reel/...",
    },
    {
      name: "X (Twitter)",
      icon: <Twitter className="w-8 h-8" />,
      color: "from-blue-400 to-blue-600",
      example: "x.com/status/...",
    },
    {
      name: "TikTok",
      icon: <Music className="w-8 h-8" />,
      color: "from-gray-800 to-gray-900",
      example: "tiktok.com/@user/video/...",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 pt-8 pb-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-4 mb-6">
            <Download className="w-12 h-12 text-cyan-400" />
            <h1 className="text-4xl md:text-6xl font-bold text-white">
              <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Social Media Downloader
              </span>
            </h1>
          </div>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Download high-quality videos and images from Instagram, X (Twitter),
            and TikTok in seconds
          </p>
        </div>

        {/* Main Input Section */}
        <div className="max-w-2xl mx-auto mb-12">
          <DownloaderInput
            url={url}
            onUrlChange={setUrl}
            onDownload={handleDownload}
            loading={loading}
          />

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {results.length > 0 && (
          <div className="max-w-4xl mx-auto mb-12">
            <h2 className="text-2xl font-semibold text-white mb-6 text-center">
              Download Results
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {results.map((result) => (
                <DownloadResult key={result.id} result={result} />
              ))}
            </div>
          </div>
        )}

        {/* Supported Platforms */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Supported Platforms
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {supportedPlatforms.map((platform, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all duration-300 group"
              >
                <div
                  className={`w-16 h-16 bg-gradient-to-r ${platform.color} rounded-xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform`}
                >
                  {platform.icon}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  {platform.name}
                </h3>
                <p className="text-gray-300 mb-4">{platform.example}</p>
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Supported
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="max-w-4xl mx-auto mt-16 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <Video className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                High Quality
              </h3>
              <p className="text-gray-400">
                Download videos and images in original quality
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <Link2 className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Simple to Use
              </h3>
              <p className="text-gray-400">
                Just paste the link and click download
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <Download className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Fast Downloads
              </h3>
              <p className="text-gray-400">
                Quick processing and download speeds
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
