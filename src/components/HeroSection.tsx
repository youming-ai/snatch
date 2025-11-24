import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

export function HeroSection() {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className="text-center space-y-6 max-w-4xl"
		>
			<Badge variant="secondary" className="px-4 py-1">
				✨ Supports Instagram, TikTok & X
			</Badge>
			<h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
				Download Social Media <br />
				<span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent animate-gradient-x">
					Content Instantly
				</span>
			</h1>
			<p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
				The easiest way to download videos and images from your favorite social
				platforms. High quality, no watermarks, completely free.
			</p>
		</motion.div>
	);
}
