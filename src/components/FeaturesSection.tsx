import { motion } from "framer-motion";
import { Shield, Smartphone, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FeatureProps {
	icon: React.ReactNode;
	title: string;
	description: string;
	index: number;
}

function Feature({ icon, title, description, index }: FeatureProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.2 + index * 0.1 }}
		>
			<Card className="border-none bg-background/30 backdrop-blur-sm hover:bg-background/50 transition-all p-4 h-full">
				<CardHeader className="flex gap-4 pb-4">
					<div className="p-3 bg-secondary rounded-xl">{icon}</div>
					<CardTitle className="text-lg">{title}</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<p className="text-muted-foreground">{description}</p>
				</CardContent>
			</Card>
		</motion.div>
	);
}

const features = [
	{
		icon: <Zap className="w-6 h-6 text-yellow-500" />,
		title: "Lightning Fast",
		description: "Get your downloads in seconds with our optimized engine.",
	},
	{
		icon: <Shield className="w-6 h-6 text-green-500" />,
		title: "Secure & Private",
		description: "We don't store your data. Your downloads are private.",
	},
	{
		icon: <Smartphone className="w-6 h-6 text-purple-500" />,
		title: "Mobile Friendly",
		description: "Works perfectly on all devices, from desktop to mobile.",
	},
];

export function FeaturesSection() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mt-12">
			{features.map((feature, index) => (
				<Feature
					key={feature.title}
					icon={feature.icon}
					title={feature.title}
					description={feature.description}
					index={index}
				/>
			))}
		</div>
	);
}
