import { z } from "zod";

/**
 * Field-level schema for the download form's URL input. Structural only
 * (non-empty); platform/host validation stays in `DownloaderApp` so an
 * unsupported link surfaces as the app's error card, not an inline field error.
 */
export const downloadUrlSchema = z.string().trim().min(1, "Please paste a link");
