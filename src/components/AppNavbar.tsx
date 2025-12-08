import { Download, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppNavbar() {
	return (
		<nav className="w-full max-w-screen-xl mx-auto border-border/10 px-4 py-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center">
					<div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-2 rounded-lg mr-3 shadow-lg shadow-cyan-500/20">
						<Download size={20} />
					</div>
					<p className="font-bold text-foreground text-xl tracking-tight">
						Media<span className="text-primary">Grabber</span>
					</p>
				</div>
				<Button asChild variant="ghost" className="font-medium">
					<a
						href="https://github.com"
						target="_blank"
						rel="noopener noreferrer"
					>
						<Github size={18} className="mr-2" />
						GitHub
					</a>
				</Button>
			</div>
		</nav>
	);
}
