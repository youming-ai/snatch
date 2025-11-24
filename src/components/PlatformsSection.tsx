import { motion } from "framer-motion";
import { CheckCircle, Instagram, Music, Twitter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORM_CONFIGS } from "@/constants/platforms";
import type { SupportedPlatform } from "@/types/download";

const platformIcons = {
	instagram: <Instagram className="w-6 h-6" />,
	twitter: <Twitter className="w-6 h-6" />,
	tiktok: <Music className="w-6 h-6" />,
} as const;

interface PlatformCardProps {
	platform: SupportedPlatform;
	config: (typeof PLATFORM_CONFIGS)[SupportedPlatform];
	index: number;
}

function PlatformCard({ platform, config, index }: PlatformCardProps) {
	return (
		<motion.div
			key={platform}
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ delay: 0.4 + index * 0.1 }}
		>
			<Card className="border-none bg-background/30 backdrop-blur-sm hover:bg-background/50 transition-colors cursor-default">
				<CardHeader className="flex gap-4 px-6 pt-6">
					<div className={`p-3 rounded-xl ${config.bgColor} ${config.color}`}>
						{platformIcons[platform]}
					</div>
					<div className="flex flex-col items-start">
						<CardTitle className="text-lg">{config.name}</CardTitle>
						<div className="flex items-center gap-1 text-green-600 text-xs bg-green-100 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
							<CheckCircle size={10} />
							<span>Active</span>
						</div>
					</div>
				</CardHeader>
				<CardContent className="px-6 pb-6 pt-2">
					<p className="text-muted-foreground text-sm">{config.description}</p>
				</CardContent>
			</Card>
		</motion.div>
	);
}

export function PlatformsSection() {
	return (
		<div className="w-full max-w-5xl space-y-8 mt-8">
			<h2 className="text-3xl font-bold text-center">Supported Platforms</h2>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{Object.entries(PLATFORM_CONFIGS).map(([platform, config], index) => (
					<PlatformCard
						key={platform}
						platform={platform as SupportedPlatform}
						config={config}
						index={index}
					/>
				))}
			</div>
		</div>
	);
}
