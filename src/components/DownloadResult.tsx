import { Download, ExternalLink, Music, Video, Image } from "lucide-react";
import type { DownloadResult as DownloadResultType } from "@/types/download";

interface DownloadResultProps {
  result: DownloadResultType;
}

export function DownloadResult({ result }: DownloadResultProps) {
  const TypeIcon = result.type === "video" ? Video : result.type === "image" ? Image : Music;

  const handleDownload = () => {
    if (result.downloadUrl) {
      window.open(result.downloadUrl, "_blank");
    }
  };

  return (
    <div className="group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all duration-300">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-900">
        {result.thumbnail ? (
          <img
            src={result.thumbnail}
            alt={result.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <TypeIcon className="w-12 h-12 text-gray-600" />
          </div>
        )}
        {/* Type Badge */}
        <div className="absolute top-3 left-3">
          <span className="px-2 py-1 text-xs font-medium rounded-lg bg-black/60 text-white capitalize flex items-center gap-1">
            <TypeIcon className="w-3 h-3" />
            {result.type}
          </span>
        </div>
        {/* Quality Badge */}
        {result.quality && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 text-xs font-medium rounded-lg bg-purple-500/80 text-white uppercase">
              {result.quality}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="font-medium text-white line-clamp-2 text-sm">
          {result.title || "Untitled"}
        </h3>

        {result.metadata?.author && (
          <p className="text-xs text-gray-400">
            @{result.metadata.author}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleDownload}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-medium rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-all duration-300 flex items-center justify-center"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
