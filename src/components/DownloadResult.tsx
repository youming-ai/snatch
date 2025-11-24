import { Download, ExternalLink, Image, Video, Play, Heart, MessageCircle, Share2 } from "lucide-react";
import type { DownloadResult as DownloadResultType } from "@/types/download";

interface DownloadResultProps {
  result: DownloadResultType;
}

export function DownloadResult({ result }: DownloadResultProps) {
  const handleDownload = () => {
    window.open(result.downloadUrl, "_blank");
  };

  const handleOpenOriginal = () => {
    window.open(result.url, "_blank");
  };

  const formatNumber = (num?: number) => {
    if (!num) return "0";
    return new Intl.NumberFormat("en-US", { notation: "compact" }).format(num);
  };

  return (
    <div className="group relative bg-gray-900/50 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden hover:border-white/20 transition-all duration-300 hover:-translate-y-1 shadow-2xl">
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] md:aspect-video bg-black/40 group-hover:brightness-110 transition-all duration-500">
        <img
          src={result.thumbnail}
          alt={result.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = `https://via.placeholder.com/400x225/1a1a2e/16213e?text=${encodeURIComponent(result.title)}`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Type Badge */}
        <div className="absolute top-4 right-4">
          <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 text-white text-xs font-medium border border-white/10">
            {result.type === "video" ? (
              <>
                <Video className="w-3.5 h-3.5" />
                Video
              </>
            ) : (
              <>
                <Image className="w-3.5 h-3.5" />
                Image
              </>
            )}
          </div>
        </div>

        {/* Platform Badge */}
        <div className="absolute top-4 left-4">
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs font-medium border border-white/10 capitalize">
            {result.platform}
          </div>
        </div>

        {/* Mock Data Badge */}
        {result.isMock && (
          <div className="absolute bottom-4 right-4">
            <div className="bg-yellow-500/80 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold shadow-lg">
              Demo Data
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <h3 className="text-white font-bold text-lg line-clamp-2 leading-snug">
            {result.title}
          </h3>
          <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
            {result.size && result.size !== "Unknown" && (
              <span className="px-2 py-1 rounded-md bg-white/5 border border-white/5">
                {result.size}
              </span>
            )}
            {result.quality && (
              <span className="px-2 py-1 rounded-md bg-white/5 border border-white/5 uppercase">
                {result.quality}
              </span>
            )}
          </div>
        </div>

        {/* Metadata Stats */}
        {result.metadata && (
          <div className="grid grid-cols-4 gap-2 py-4 border-y border-white/5">
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <Play className="w-4 h-4" />
              <span className="text-xs">{formatNumber(result.metadata.playCount)}</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <Heart className="w-4 h-4" />
              <span className="text-xs">{formatNumber(result.metadata.likeCount)}</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs">{formatNumber(result.metadata.commentCount)}</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <Share2 className="w-4 h-4" />
              <span className="text-xs">{formatNumber(result.metadata.shareCount)}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 px-4 py-3.5 bg-white text-black font-bold rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 hover:scale-[1.02] active:scale-[0.98]"
          >
            {result.downloadUrl === result.url ? "Open Link" : "Download"}
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenOriginal}
            className="px-4 py-3.5 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Open Original"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
