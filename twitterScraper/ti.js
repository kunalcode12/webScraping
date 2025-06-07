const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const COOKIES_PATH = path.join(__dirname, "twitter_cookies.json");

/**
 * Twitter Data Scraper with Fixed Post Count - 30-40 Posts Per Account
 * This script creates separate JSON files for each account with minimal post data
 */
async function main() {
  try {
    // SET YOUR DESIRED POST COUNT HERE
    const TARGET_POST_COUNT = 30; // Will aim for around 30-40 posts per account

    console.log(`Scraping ${TARGET_POST_COUNT} posts per account`);

    // Create output directory for account files
    const outputDir = path.join(
      __dirname,
      `twitter_data_${TARGET_POST_COUNT}_posts`
    );
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Launch browser with visible UI and reasonable window size
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ["--window-size=1366,768"],
      userDataDir: path.join(__dirname, "chrome_user_data"),
    });

    const page = await browser.newPage();

    let loggedIn = false;

    if (fs.existsSync(COOKIES_PATH)) {
      console.log("Found saved cookies, attempting to use existing session...");
      const cookiesString = fs.readFileSync(COOKIES_PATH);
      const cookies = JSON.parse(cookiesString);
      await page.setCookie(...cookies);

      // Go to Twitter home to check if we're logged in
      await page.goto("https://x.com/home", { waitUntil: "networkidle2" });

      // Check if we are logged in by looking for elements that only appear when logged in
      loggedIn = await page.evaluate(() => {
        // Look for elements that indicate we're logged in
        return (
          !!document.querySelector('a[data-testid="AppTabBar_Home_Link"]') ||
          !!document.querySelector(
            'a[data-testid="SideNav_NewTweet_Button"]'
          ) ||
          !!document.querySelector('div[data-testid="tweetButtonInline"]')
        );
      });

      console.log(
        loggedIn
          ? "Successfully logged in with saved cookies"
          : "Cookies expired, need to log in again"
      );
    }

    if (!loggedIn) {
      // Go to Twitter login page
      console.log("Navigating to Twitter login page...");
      await page.goto("https://x.com/i/flow/login", {
        waitUntil: "networkidle2",
      });

      // Enter username
      console.log("Entering username...");
      await page.waitForSelector('input[autocomplete="username"]');
      await page.type('input[autocomplete="username"]', "k84489567@gmail.com", {
        delay: 200,
      });

      // Click next button
      const nextButtons = await page.$$('button[role="button"]');
      let nextButtonFound = false;

      for (const button of nextButtons) {
        const buttonText = await page.evaluate((el) => el.textContent, button);
        if (buttonText && buttonText.includes("Next")) {
          await button.click();
          nextButtonFound = true;
          console.log("Next button clicked");
          break;
        }
      }

      // Enter password
      console.log("Entering password...");
      await page.waitForSelector('input[name="password"]');
      await page.type('input[name="password"]', "8920560393", { delay: 200 });

      // Click login button
      const nextButtons1 = await page.$$('button[role="button"]');

      for (const button of nextButtons1) {
        const buttonText = await page.evaluate((el) => el.textContent, button);
        if (buttonText && buttonText.includes("Log in")) {
          await button.click();
          nextButtonFound = true;
          console.log("Log in button clicked");
          break;
        }
      }

      // Wait for login to complete
      console.log("Logging in...");
      await randomDelay();

      const cookies = await page.cookies();
      fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
      console.log("Cookies saved for future sessions");
    }

    // Array of accounts to scrape
    const accountsToScrape = [
      //   "aeyakovenko",
      //   "rajgokal",
      //   "solana",
      //   "JupiterExchange",
      //   "weremeow",
      //   "cz_binance",
      //   "brian_armstrong",
      //   "VitalikButerin",
      //   "Bitcoin",
      //   "superteam",
      //   "SuperteamIN",
      //   "orca_so",
      //   "SonicSVM",
      //   "stepfinance_",
      //   "sendarcadefun",
      //   "heliuslabs",
      //   "jito_sol",
      //   "phantom",
      //   "TheSolanaBoss",
      //   "SolanaLegend",
      //   "save_finance",
      //   "DriftProtocol",
      //   "marginfi",
      //   "SolanaFndn",
      //   "laine_sa_",
      //   "SOLBigBrain",
      "CryptooIndia",
      "garyvee",
      "realDonaldTrump",
      "elonmusk",
    ];

    const scrapingSummary = [];

    // Process each account
    for (let i = 0; i < accountsToScrape.length; i++) {
      await randomDelay();
      const account = accountsToScrape[i];

      console.log(`\n=== Processing ${account} ===`);
      console.log(`Navigating to ${account}'s profile...`);
      await page.goto(`https://x.com/${account}`, {
        waitUntil: "networkidle2",
      });

      console.log(`Scraping ${TARGET_POST_COUNT} posts for ${account}...`);

      // Create a set to track post URLs we've already seen
      const seenPostUrls = new Set();
      const allAccountPosts = [];
      let reachedTargetCount = false;
      let scrollCount = 0;
      let noNewPostsCount = 0;
      const maxNoNewPosts = 15;

      while (!reachedTargetCount && noNewPostsCount < maxNoNewPosts) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));

        // Longer wait after each scroll for data to load properly
        console.log(
          `Waiting for content to load after scroll ${scrollCount + 1}...`
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
        scrollCount++;

        // Extract new posts
        const newPosts = await extractPostsData(page, account);

        // Filter out duplicates and add only new posts
        const uniqueNewPosts = newPosts.filter((post) => {
          // If post has no URL, use timestamp as identifier
          const identifier = post.postUrl || post.timestamp || post.tweetText;
          if (!identifier || seenPostUrls.has(identifier)) {
            return false;
          }

          // Add to seen set and return true to keep this post
          seenPostUrls.add(identifier);
          return true;
        });

        if (uniqueNewPosts.length === 0) {
          noNewPostsCount++;
          console.log(
            `No new posts found (${noNewPostsCount}/${maxNoNewPosts})`
          );
        } else {
          noNewPostsCount = 0; // Reset counter when we find new posts
        }

        // Add new posts until we reach target count
        for (const post of uniqueNewPosts) {
          if (allAccountPosts.length < TARGET_POST_COUNT) {
            allAccountPosts.push(post);
          } else {
            reachedTargetCount = true;
            break;
          }
        }

        console.log(
          `Scroll ${scrollCount}: Found ${uniqueNewPosts.length} new posts (total: ${allAccountPosts.length}/${TARGET_POST_COUNT})`
        );

        // Check if we've reached our target
        if (allAccountPosts.length >= TARGET_POST_COUNT) {
          console.log(`Reached target of ${TARGET_POST_COUNT} posts!`);
          reachedTargetCount = true;
        }

        if (scrollCount % 3 === 0 && scrollCount > 0) {
          console.log(
            "Taking an extra longer pause to ensure content loads..."
          );
          await new Promise((resolve) => setTimeout(resolve, 8000));
        }

        // Safety check to prevent infinite scrolling
        if (scrollCount > 200) {
          console.log("Reached maximum scroll limit (200 scrolls)");
          break;
        }
      }

      console.log(`Collected ${allAccountPosts.length} posts for ${account}`);

      // Create individual file for this account
      const accountFileName = path.join(outputDir, `${account}.json`);
      const accountData = {
        account: account,
        scrapingDate: new Date().toISOString(),
        targetPostCount: TARGET_POST_COUNT,
        totalPosts: allAccountPosts.length,
        posts: allAccountPosts,
      };

      fs.writeFileSync(accountFileName, JSON.stringify(accountData, null, 2));
      console.log(
        `Saved ${allAccountPosts.length} posts to ${accountFileName}`
      );

      // Add to summary
      scrapingSummary.push({
        account: account,
        postsCount: allAccountPosts.length,
        scrollsCount: scrollCount,
        reachedTargetCount: reachedTargetCount,
        fileName: `${account}.json`,
      });

      console.log(
        `Completed scraping for ${account}. Posts saved: ${allAccountPosts.length}`
      );
    }

    // Save scraping summary
    const summaryFileName = path.join(outputDir, "_scraping_summary.json");
    fs.writeFileSync(
      summaryFileName,
      JSON.stringify(
        {
          scrapingDate: new Date().toISOString(),
          targetPostCount: TARGET_POST_COUNT,
          totalAccounts: accountsToScrape.length,
          accounts: scrapingSummary,
        },
        null,
        2
      )
    );

    // Print final summary
    console.log("\n=== SCRAPING COMPLETE ===");
    console.log(`Output directory: ${outputDir}`);
    console.log(`Target post count: ${TARGET_POST_COUNT}`);
    console.log("Files created:");
    scrapingSummary.forEach((summary) => {
      console.log(`- ${summary.fileName}: ${summary.postsCount} posts`);
    });
    console.log(`- _scraping_summary.json: Overall summary`);

    const totalPosts = scrapingSummary.reduce(
      (sum, account) => sum + account.postsCount,
      0
    );
    console.log(`\nTotal posts scraped: ${totalPosts}`);

    // Keep browser open for manual review (optional)
    // await browser.close();
  } catch (error) {
    console.error("Error during scraping:", error);
  }
}

/**
 * Extract data from all posts on the page - Minimal version
 */
async function extractPostsData(page, accountName) {
  try {
    const postsData = await page.evaluate((currentAccountName) => {
      const posts = [];
      const articleElements = document.querySelectorAll(
        'article[data-testid="tweet"]'
      );

      articleElements.forEach((article) => {
        try {
          // Extract timestamp
          const timeElement = article.querySelector("time");
          const timestamp = timeElement
            ? timeElement.getAttribute("datetime")
            : null;

          // Extract post URL to determine original author
          const linkElement = article.querySelector('a[href*="/status/"]');
          const postUrl = linkElement ? linkElement.getAttribute("href") : null;

          // Extract the account name from post URL
          let originalAuthor = "";
          let isRepost = false;

          if (postUrl) {
            // Extract account name from URL pattern: /accountname/status/id
            const urlMatch = postUrl.match(/^\/([^\/]+)\/status\/\d+/);
            if (urlMatch) {
              originalAuthor = urlMatch[1];
              // Check if this is a repost by comparing account names
              isRepost =
                originalAuthor.toLowerCase() !==
                currentAccountName.toLowerCase();
            }
          }

          // If it's not a repost, the original author is the current account
          if (!isRepost) {
            originalAuthor = currentAccountName;
          }

          // Extract post content
          const tweetTextElement = article.querySelector(
            'div[data-testid="tweetText"]'
          );
          const tweetText = tweetTextElement
            ? tweetTextElement.innerText.trim()
            : "";

          // Only add posts that have content or timestamp
          if (tweetText || timestamp) {
            posts.push({
              timestamp,
              tweetText,
              isRepost,
              originalAuthor,
              postUrl,
            });
          }
        } catch (err) {
          console.log("Error processing individual post:", err);
        }
      });

      return posts;
    }, accountName); // Pass accountName as parameter to page.evaluate

    return postsData;
  } catch (error) {
    console.error("Error extracting posts data:", error);
    return [];
  }
}

async function randomDelay(min = 4000, max = 8000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

main();
