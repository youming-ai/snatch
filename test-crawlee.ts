import { InstagramCrawleeDownloader } from "./src/lib/crawlee-downloaders/instagram-crawlee-downloader";

async function testInstagramDownload() {
    const url = "https://www.instagram.com/reel/DRB_2ujEu-Q/";
    console.log("🔄 Testing Instagram download with Crawlee...");
    console.log("URL:", url);

    try {
        const downloader = new InstagramCrawleeDownloader({
            maxRequestsPerCrawl: 1,
            headless: true,
            requestHandlerTimeoutSecs: 30,
            navigationTimeoutSecs: 30,
        });

        const results = await downloader.download(url);

        console.log("\n✅ Download successful!");
        console.log("Results:", JSON.stringify(results, null, 2));

        if (results.length > 0) {
            console.log(`\n📊 Found ${results.length} result(s):`);
            results.forEach((result, index) => {
                console.log(`\n[${index + 1}] ${result.title}`);
                console.log(`   Type: ${result.type}`);
                console.log(`   Quality: ${result.quality}`);
                console.log(`   Download URL: ${result.downloadUrl}`);
                console.log(`   Is Mock: ${result.isMock || false}`);
            });
        }
    } catch (error) {
        console.error("\n❌ Download failed:");
        console.error(error);
    }
}

testInstagramDownload();
