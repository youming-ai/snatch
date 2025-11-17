import { Download, Link2, Loader2 } from "lucide-react";

interface DownloaderInputProps {
  url: string;
  onUrlChange: (url: string) => void;
  onDownload: () => void;
  loading: boolean;
}

export function DownloaderInput({
  url,
  onUrlChange,
  onDownload,
  loading,
}: DownloaderInputProps) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
      <div className="mb-6">
        <label
          htmlFor="url-input"
          className="block text-lg font-medium text-white mb-3"
        >
          Paste Social Media URL
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Link2 className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="url-input"
            type="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://instagram.com/reel/..."
            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-200"
            disabled={loading}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                onDownload();
              }
            }}
          />
        </div>
        <p className="mt-2 text-sm text-gray-400">
          Supports Instagram, X (Twitter), and TikTok URLs
        </p>
      </div>

      <button
        onClick={onDownload}
        disabled={loading || !url.trim()}
        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Download
          </>
        )}
      </button>
    </div>
  );
}
