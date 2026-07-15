import { useEffect, useRef } from "react";

interface TurnstileWindow extends Window {
	turnstile?: {
		render: (
			container: HTMLElement,
			options: {
				sitekey: string;
				callback: (token: string) => void;
				"expired-callback"?: () => void;
				"error-callback"?: () => void;
				theme?: string;
			},
		) => string;
		remove: (widgetId: string) => void;
	};
	[key: string]: unknown;
}

interface TurnstileProps {
	sitekey: string;
	onVerify: (token: string) => void;
	onExpire?: () => void;
	onError?: () => void;
}

export function Turnstile({ sitekey, onVerify, onExpire, onError }: TurnstileProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | null>(null);

	useEffect(() => {
		const tWindow = window as unknown as TurnstileWindow;
		const callbackName = `onloadTurnstileCallback_${sitekey.replace(/[^a-zA-Z0-9]/g, "")}`;

		tWindow[callbackName] = () => {
			if (containerRef.current && tWindow.turnstile) {
				widgetIdRef.current = tWindow.turnstile.render(containerRef.current, {
					sitekey,
					callback: onVerify,
					"expired-callback": onExpire,
					"error-callback": onError,
					theme: "dark",
				});
			}
		};

		let script = document.getElementById("cloudflare-turnstile-script") as HTMLScriptElement | null;
		if (!script) {
			script = document.createElement("script");
			script.id = "cloudflare-turnstile-script";
			script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?onload=${callbackName}`;
			script.async = true;
			script.defer = true;
			document.body.appendChild(script);
		} else if (tWindow.turnstile && containerRef.current) {
			const callback = tWindow[callbackName];
			if (typeof callback === "function") {
				callback();
			}
		}

		return () => {
			if (widgetIdRef.current && tWindow.turnstile) {
				tWindow.turnstile.remove(widgetIdRef.current);
			}
			delete tWindow[callbackName];
		};
	}, [sitekey, onVerify, onExpire, onError]);

	return <div ref={containerRef} className="flex justify-center" />;
}
