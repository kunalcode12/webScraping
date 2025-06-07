const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const COOKIES_PATH = path.join(__dirname, "twitter_cookies.json");

/**
 * Twitter Data Scraper with Date Filtering - Separate Files Edition
 * This script creates separate JSON files for each account with minimal post data
 */
async function main() {
  try {
    // SET YOUR TARGET DATE HERE (YYYY-MM-DD format)
    // The scraper will get all posts from now until this date
    const TARGET_DATE = "2025-04-24"; // Change this to your desired date

    console.log(`Scraping posts until: ${TARGET_DATE}`);
    const targetDateTime = new Date(TARGET_DATE);

    // Create output directory for account files
    const outputDir = path.join(
      __dirname,
      `twitter_data_${TARGET_DATE.replace(/-/g, "_")}`
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
      "aeyakovenko",
      "rajgokal",
      "solana",
      "jupiter",
      "weremeow",
      "cz_binance",
      "brian_armstrong",
      "VitalikButerin",
      "pompbitcoin",
      "superteam",
      "mSOLana",
      "orca_so",
      "raydium_io",
      "stepfinance_",
      "saber_hq",
      "helium",
      "jito_sol",
      "phantom",
      "TheSolanaBoss",
      "SolanaLegend",
      "solendprotocol",
      "DriftProtocol",
      "marginfi",
      "SolanaFndn",
      "laine_sa_",
      "SOLBigBrain",
      "AnsemCrypto",
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

      console.log(`Scraping posts for ${account} until ${TARGET_DATE}...`);

      // Create a set to track post URLs we've already seen
      const seenPostUrls = new Set();
      const allAccountPosts = [];
      let reachedTargetDate = false;
      let scrollCount = 0;
      let noNewPostsCount = 0;
      const maxNoNewPosts = 15; // Increased from 5 to 15

      while (!reachedTargetDate && noNewPostsCount < maxNoNewPosts) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));

        // Longer wait after each scroll for data to load properly
        console.log(
          `Waiting for content to load after scroll ${scrollCount + 1}...`
        );
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Increased from 2000ms to 5000ms
        scrollCount++;

        // Extract new posts
        const newPosts = await extractPostsData(page, account);

        // Filter out duplicates and add only new posts
        const uniqueNewPosts = newPosts.filter((post) => {
          // If post has no URL, use timestamp as identifier
          const identifier = post.postUrl || post.timestamp;
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

        // Check if any of the new posts are older than our target date
        for (const post of uniqueNewPosts) {
          if (post.timestamp) {
            const postDate = new Date(post.timestamp);
            if (postDate < targetDateTime) {
              console.log(`Reached target date! Post from: ${post.timestamp}`);
              reachedTargetDate = true;
              // Still add this post since it might be exactly on the target date
              allAccountPosts.push(post);
              break;
            }
            allAccountPosts.push(post);
          } else {
            // If no timestamp, add the post anyway
            allAccountPosts.push(post);
          }
        }

        console.log(
          `Scroll ${scrollCount}: Found ${uniqueNewPosts.length} new posts (total: ${allAccountPosts.length})`
        );

        if (scrollCount % 3 === 0 && scrollCount > 0) {
          console.log(
            "Taking an extra longer pause to ensure content loads..."
          );
          await new Promise((resolve) => setTimeout(resolve, 8000)); // Increased from 3000ms to 8000ms
        }

        // Safety check to prevent infinite scrolling - increased limit
        if (scrollCount > 500) {
          // Increased from 200 to 500
          console.log("Reached maximum scroll limit (500 scrolls)");
          break;
        }
      }

      // Filter posts to only include those newer than or equal to target date
      const filteredPosts = allAccountPosts.filter((post) => {
        if (!post.timestamp) return true; // Keep posts without timestamp
        const postDate = new Date(post.timestamp);
        return postDate >= targetDateTime;
      });

      console.log(
        `Filtered ${allAccountPosts.length} posts to ${filteredPosts.length} posts (from ${TARGET_DATE} onwards)`
      );

      // Create individual file for this account
      const accountFileName = path.join(outputDir, `${account}.json`);
      const accountData = {
        account: account,
        scrapingDate: new Date().toISOString(),
        targetDate: TARGET_DATE,
        totalPosts: filteredPosts.length,
        posts: filteredPosts,
      };

      fs.writeFileSync(accountFileName, JSON.stringify(accountData, null, 2));
      console.log(`Saved ${filteredPosts.length} posts to ${accountFileName}`);

      // Add to summary
      scrapingSummary.push({
        account: account,
        postsCount: filteredPosts.length,
        scrollsCount: scrollCount,
        reachedTargetDate: reachedTargetDate,
        fileName: `${account}.json`,
      });

      console.log(
        `Completed scraping for ${account}. Posts saved: ${filteredPosts.length}`
      );
    }

    // Save scraping summary
    const summaryFileName = path.join(outputDir, "_scraping_summary.json");
    fs.writeFileSync(
      summaryFileName,
      JSON.stringify(
        {
          scrapingDate: new Date().toISOString(),
          targetDate: TARGET_DATE,
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
    console.log(`Target date: ${TARGET_DATE}`);
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
