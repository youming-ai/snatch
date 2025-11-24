import { motion } from "framer-motion";
import { Separator } from "@/components/ui/separator";

interface ResultsHeaderProps {
	visible: boolean;
}

export function ResultsHeader({ visible }: ResultsHeaderProps) {
	if (!visible) return null;

	return (
		<motion.div
			initial={{ opacity: 0, height: 0 }}
			animate={{ opacity: 1, height: "auto" }}
			exit={{ opacity: 0, height: 0 }}
			className="w-full"
		>
			<div className="flex items-center gap-4">
				<Separator className="flex-1" />
				<h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
					Ready to Download
				</h2>
				<Separator className="flex-1" />
			</div>
		</motion.div>
	);
}
