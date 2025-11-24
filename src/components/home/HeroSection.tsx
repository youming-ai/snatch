import { Download, Link2 } from "lucide-react";
import { DownloaderInput } from "@/components/DownloaderInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface HeroSectionProps {
  url?: string;
  loading: boolean;
  onUrlChange: (url: string) => void;
  onDownload: () => void;
  error?: string | null;
}

export function HeroSection({
  url,
  loading,
  onUrlChange,
  onDownload,
  error,
}: HeroSectionProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      onDownload();
    }
  };

  return (
    <div className="text-center space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
          Social Media Downloader
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Download high-quality videos and images from Instagram, TikTok, and X
          (Twitter) with just one click.
        </p>
      </div>

      <Card className="max-w-2xl mx-auto border-none shadow-2xl bg-card/50 backdrop-blur-sm">
        <CardContent className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2 text-muted-foreground">
              <Link2 className="w-5 h-5" />
              <span>Paste any social media URL to get started</span>
            </div>

            <DownloaderInput
              value={url}
              onChange={onUrlChange}
              onKeyPress={handleKeyPress}
              disabled={loading}
              placeholder="https://www.tiktok.com/@user/video/1234567890"
            />

            <Button
              onClick={onDownload}
              disabled={loading || !url.trim()}
              size="lg"
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Download Content
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {[
          {
            title: "Lightning Fast",
            description:
              "Download content in seconds with our optimized technology",
            icon: "⚡",
          },
          {
            title: "High Quality",
            description:
              "Get the best possible quality for your downloaded media",
            icon: "🎯",
          },
          {
            title: "Free to Use",
            description: "No registration required, completely free service",
            icon: "🆓",
          },
        ].map((feature, index) => (
          <div
            key={index}
            className="p-6 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50 hover:border-border transition-colors"
          >
            <div className="text-2xl mb-2">{feature.icon}</div>
            <h3 className="font-semibold mb-1">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
