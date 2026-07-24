import { createFileRoute } from "@tanstack/react-router";
import { DownloaderApp } from "../components/DownloaderApp";

export const Route = createFileRoute("/")({
	component: DownloaderApp,
});
