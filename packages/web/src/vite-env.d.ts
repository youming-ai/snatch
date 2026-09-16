/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Browser Sentry DSN; when unset, error reporting is disabled. */
	readonly VITE_SENTRY_DSN?: string;
	/**
	 * Public origin this deployment is served from, used for the canonical link
	 * and social preview tags. Unset means the deployment does not advertise one.
	 */
	readonly VITE_SITE_URL?: string;
	/** Microsoft Clarity project id; when unset, no analytics script is emitted. */
	readonly VITE_CLARITY_ID?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
