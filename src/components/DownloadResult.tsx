import { Download, Video, Image, ExternalLink } from "lucide-react";

interface DownloadResultProps {
  result: {
    id: string;
    type: "video" | "image";
    url: string;
    thumbnail: string;
    downloadUrl: string;
    title: string;
    size: string;
    platform?: "instagram" | "twitter" | "tiktok";
  };
}

export function DownloadResult({ result }: DownloadResultProps) {
  const handleDownload = () => {
    // Create a temporary link element for downloading
    const link = document.createElement("a");
    link.href = result.downloadUrl;
    link.download = `${result.title.replace(/[^a-z0-9]/gi, "_")}_${
      result.id
    }.${result.type === "video" ? "mp4" : "jpg"}`;
    link.target = "_blank";

    // Add to DOM, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // If it's just a URL open, open in new tab
    if (result.downloadUrl === result.url) {
      window.open(result.url, "_blank");
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden border border-white/20 hover:bg-white/15 transition-all duration-300 group">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden">
        <img
          src={result.thumbnail}
          alt={result.title}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
          onError={(e) => {
            // Fallback if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `
                <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  ${
                    result.type === "video"
                      ? '<svg class="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
                      : '<svg class="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>'
                  }
                </div>
              `;
            }
          }}
        />
        <div className="absolute top-4 right-4 bg-black/50 rounded-full p-2">
          {result.type === "video" ? (
            <Video className="w-4 h-4 text-white" />
          ) : (
            <Image className="w-4 h-4 text-white" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3
          className="text-lg font-semibold text-white mb-2 truncate"
          title={result.title}
        >
          {result.title}
        </h3>
        <p className="text-sm text-gray-400 mb-4">{result.size}</p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center"
            title="Open original"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
