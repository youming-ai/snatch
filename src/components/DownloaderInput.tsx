import { Download, Loader2 } from "lucide-react";

interface DownloaderInputProps {
  url: string;
  onUrlChange: (url: string) => void;
  onDownload: () => void;
  loading: boolean;
}

export function DownloaderInput({ url, onUrlChange, onDownload, loading }: DownloaderInputProps) {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) {
      onDownload();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <input
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Paste Instagram, TikTok, or X (Twitter) URL here..."
          className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300"
          disabled={loading}
        />
      </div>
      <button
        onClick={onDownload}
        disabled={loading || !url.trim()}
        className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 min-w-[140px]"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing</span>
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            <span>Download</span>
          </>
        )}
      </button>
    </div>
  );
}
