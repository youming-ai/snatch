import { InstagramDownloader } from "./src/lib/native-downloaders/instagram.ts";

async function test() {
    const downloader = new InstagramDownloader();
    // Using a popular reel or the one from the user's previous request if any.
    // I'll use a generic one or try to find a working one.
    // Let's use a known public reel.
    const url = "https://www.instagram.com/reel/C3O_1K_Lq5_/";

    console.log("Testing Instagram GraphQL Downloader...");
    try {
        const results = await downloader.download(url);
        console.log("Results:", JSON.stringify(results, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
