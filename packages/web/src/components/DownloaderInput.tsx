import { useForm } from "@tanstack/react-form";
import { Download, Loader2 } from "lucide-react";
import { downloadUrlSchema } from "../schemas/download";

interface DownloaderInputProps {
	onSubmit: (url: string) => Promise<void>;
	onValueChange: () => void;
	loading: boolean;
}

export function DownloaderInput({ onSubmit, onValueChange, loading }: DownloaderInputProps) {
	const form = useForm({
		defaultValues: { url: "" },
		onSubmit: async ({ value }) => {
			await onSubmit(value.url.trim());
		},
	});

	return (
		<form
			className="space-y-2"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit();
			}}
		>
			<form.Field
				name="url"
				validators={{
					onSubmit: ({ value }) => {
						const parsed = downloadUrlSchema.safeParse(value);
						return parsed.success
							? undefined
							: (parsed.error.issues[0]?.message ?? "Please paste a link");
					},
				}}
			>
				{(field) => {
					const error = field.state.meta.errors[0];

					return (
						<>
							<div className="flex flex-col gap-4 sm:flex-row">
								<div className="relative flex-1">
									<input
										type="url"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event) => {
											field.handleChange(event.target.value);
											onValueChange();
										}}
										placeholder="Paste a link from any supported service..."
										aria-label="Video URL"
										aria-invalid={Boolean(error)}
										className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-white placeholder-gray-500 transition-all duration-300 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
										disabled={loading}
									/>
								</div>
								<button
									type="submit"
									disabled={loading || !field.state.value.trim()}
									className="flex min-w-[140px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-4 font-semibold text-white transition-all duration-300 hover:from-purple-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:from-gray-600 disabled:to-gray-700"
								>
									{loading ? (
										<>
											<Loader2 className="h-5 w-5 animate-spin" />
											<span>Processing</span>
										</>
									) : (
										<>
											<Download className="h-5 w-5" />
											<span>Download</span>
										</>
									)}
								</button>
							</div>
							{typeof error === "string" && (
								<p className="px-1 text-left text-sm text-red-400" role="alert">
									{error}
								</p>
							)}
						</>
					);
				}}
			</form.Field>
		</form>
	);
}
