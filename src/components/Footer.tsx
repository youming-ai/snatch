export function Footer() {
	return (
		<footer className="w-full py-8 text-center text-muted-foreground border-t border-border/10 mt-12 bg-background/50 backdrop-blur-lg">
			<div className="container mx-auto px-4">
				<p>© {new Date().getFullYear()} MediaGrabber. All rights reserved.</p>
				<div className="flex justify-center gap-6 mt-4">
					<a
						href="#"
						className="text-sm hover:text-foreground transition-colors"
					>
						Privacy Policy
					</a>
					<a
						href="#"
						className="text-sm hover:text-foreground transition-colors"
					>
						Terms of Service
					</a>
					<a
						href="#"
						className="text-sm hover:text-foreground transition-colors"
					>
						Contact
					</a>
				</div>
			</div>
		</footer>
	);
}
