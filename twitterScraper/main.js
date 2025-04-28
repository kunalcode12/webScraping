const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { setTimeout } = require("timers/promises");

// Configuration
const CONFIG = {
  cookiesPath: path.join(__dirname, "twitter_cookies.json"),
  userDataDir: path.join(__dirname, "chrome_user_data"),
  outputPath: path.join(__dirname, "twitter_data"),
  accountsFile: path.join(__dirname, "accounts_to_scrape.json"),
  scrapeInterval: 60 * 60 * 1000, // 1 hour in milliseconds
  maxAccountsPerRun: 10, // Maximum accounts to scrape in one execution
  scrollCountPerAccount: 25,
  // Use multiple accounts to rotate
  accounts: [
    {
      username: "k84489567@gmail.com",
      handle: "kash121131314",
      password: "8920560393",
    },
    // Add more accounts if available
  ],
};

// Create output directory if it doesn't exist
if (!fs.existsSync(CONFIG.outputPath)) {
  fs.mkdirSync(CONFIG.outputPath, { recursive: true });
}

// Load accounts to scrape from file or use default if file doesn't exist
function getAccountsToScrape() {
  try {
    if (fs.existsSync(CONFIG.accountsFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.accountsFile, "utf8"));
    }
  } catch (error) {
    console.error("Error loading accounts file:", error);
  }

  // Fallback to default accounts list
  return [
    "realDonaldTrump",
    "elonmusk",
    "BarackObama",
    // Add more accounts to scrape
  ];
}

// Save the current progress to track which accounts have been scraped
function saveProgress(scrapedAccounts) {
  const progressPath = path.join(CONFIG.outputPath, "progress.json");
  fs.writeFileSync(
    progressPath,
    JSON.stringify(
      {
        lastRun: new Date().toISOString(),
        scrapedAccounts,
      },
      null,
      2
    )
  );
}

// Load progress from previous runs
function loadProgress() {
  const progressPath = path.join(CONFIG.outputPath, "progress.json");
  if (fs.existsSync(progressPath)) {
    try {
      return JSON.parse(fs.readFileSync(progressPath, "utf8"));
    } catch (error) {
      console.error("Error loading progress file:", error);
    }
  }
  return { lastRun: null, scrapedAccounts: [] };
}

/**
 * Twitter Data Scraper
 * Production-ready script that logs into Twitter and scrapes post data
 * with error handling, session management, and rate limiting
 */
async function main() {
  let browser;
  try {
    console.log("Starting Twitter scraper run at", new Date().toISOString());

    // Get accounts to scrape and load progress
    const allAccountsToScrape = getAccountsToScrape();
    const progress = loadProgress();

    // Determine which accounts to scrape in this run
    // Create a queue of accounts that haven't been scraped recently
    // or prioritize accounts that haven't been scraped at all
    let accountsQueue = [...allAccountsToScrape];
    if (progress.scrapedAccounts && progress.scrapedAccounts.length > 0) {
      // Sort accounts with least-recently scraped first
      accountsQueue.sort((a, b) => {
        const aLastScraped =
          progress.scrapedAccounts.find((item) => item.account === a)
            ?.timestamp || 0;
        const bLastScraped =
          progress.scrapedAccounts.find((item) => item.account === b)
            ?.timestamp || 0;
        return aLastScraped - bLastScraped;
      });
    }

    // Take only the first maxAccountsPerRun accounts
    const accountsToScrapeNow = accountsQueue.slice(
      0,
      CONFIG.maxAccountsPerRun
    );

    if (accountsToScrapeNow.length === 0) {
      console.log("No accounts to scrape at this time.");
      return;
    }

    console.log(
      `Will scrape ${accountsToScrapeNow.length} accounts in this run.`
    );

    // Choose a random account from our pool to minimize detection
    const account =
      CONFIG.accounts[Math.floor(Math.random() * CONFIG.accounts.length)];

    // Launch browser with stealth configurations
    browser = await puppeteer.launch({
      headless: false, // Change to true for production
      defaultViewport: null,
      args: [
        "--window-size=1366,768",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
      userDataDir: CONFIG.userDataDir,
    });

    const page = await browser.newPage();

    // Set more realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36"
    );

    // Add randomization to mouse movements and typing
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    });

    // Attempt to use existing session
    let loggedIn = false;

    if (fs.existsSync(CONFIG.cookiesPath)) {
      console.log("Attempting to use existing session...");
      try {
        const cookiesString = fs.readFileSync(CONFIG.cookiesPath);
        const cookies = JSON.parse(cookiesString);
        await page.setCookie(...cookies);

        // Go to Twitter home to check if we're logged in
        await page.goto("https://x.com/home", {
          waitUntil: "networkidle2",
          timeout: 60000, // Increased timeout for slower connections
        });

        // Check if we are logged in
        loggedIn = await page.evaluate(() => {
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
      } catch (error) {
        console.error("Error using saved cookies:", error);
        loggedIn = false;
      }
    }

    // Login if needed
    if (!loggedIn) {
      try {
        console.log("Logging in with credentials...");
        await loginToTwitter(page, account);

        // Save new cookies
        const cookies = await page.cookies();
        fs.writeFileSync(CONFIG.cookiesPath, JSON.stringify(cookies, null, 2));
        console.log("Cookies saved for future sessions");
      } catch (loginError) {
        console.error("Failed to login:", loginError);
        if (browser) await browser.close();
        return;
      }
    }

    const scrapedAccountsThisRun = [];

    // Process each account with random delays between accounts
    for (let i = 0; i < accountsToScrapeNow.length; i++) {
      try {
        const account = accountsToScrapeNow[i];

        // Add a longer random delay between accounts
        const accountDelay = getRandomDelay(15000, 45000);
        console.log(
          `Waiting ${
            accountDelay / 1000
          } seconds before scraping next account...`
        );
        await setTimeout(accountDelay);

        console.log(
          `Scraping account ${i + 1}/${accountsToScrapeNow.length}: ${account}`
        );

        // Scrape and save the account data
        const accountData = await scrapeAccount(page, account);

        // Save data for this specific account
        const timestamp = new Date().toISOString();
        const filename = `${account}_${timestamp.replace(/:/g, "-")}.json`;
        fs.writeFileSync(
          path.join(CONFIG.outputPath, filename),
          JSON.stringify(accountData, null, 2)
        );

        // Record that we scraped this account
        scrapedAccountsThisRun.push({
          account,
          timestamp: Date.now(),
        });

        saveProgress([
          ...progress.scrapedAccounts.filter((a) => a.account !== account),
          { account, timestamp: Date.now() },
        ]);

        console.log(`Completed scraping for ${account}`);
      } catch (accountError) {
        console.error(
          `Error scraping account ${accountsToScrapeNow[i]}:`,
          accountError
        );
        // Continue with next account despite error
      }
    }

    console.log(
      `Run completed. Scraped ${scrapedAccountsThisRun.length} accounts.`
    );
  } catch (error) {
    console.error("Fatal error during scraping:", error);
  } finally {
    if (browser) {
      console.log("Closing browser...");
      await browser.close();
    }
  }
}

/**
 * Log in to Twitter
 */
async function loginToTwitter(page, account) {
  // Go to Twitter login page
  await page.goto("https://x.com/i/flow/login", {
    waitUntil: "networkidle2",
    timeout: 60000, // 60 second timeout
  });

  // Enter username
  await page.waitForSelector('input[autocomplete="username"]', {
    timeout: 30000,
  });
  await typeWithRandomDelay(
    page,
    'input[autocomplete="username"]',
    account.username
  );

  // Click next button with retry
  await clickButtonWithText(page, "Next");

  // Twitter might ask for handle/username after email
  try {
    await page.waitForSelector('input[autocomplete="on"]', { timeout: 10000 });
    await typeWithRandomDelay(page, 'input[autocomplete="on"]', account.handle);
    await clickButtonWithText(page, "Next");
  } catch (error) {
    // It's okay if this step is skipped - not all accounts need it
    console.log("Username/handle step was skipped");
  }

  // Enter password
  await page.waitForSelector('input[name="password"]', { timeout: 30000 });
  await typeWithRandomDelay(page, 'input[name="password"]', account.password);

  // Click login button
  await clickButtonWithText(page, "Log in");

  // Wait for login to complete
  await page
    .waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 })
    .catch(() => {});

  // Verify we're logged in
  const loggedIn = await page.evaluate(() => {
    return (
      !!document.querySelector('a[data-testid="AppTabBar_Home_Link"]') ||
      !!document.querySelector('a[data-testid="SideNav_NewTweet_Button"]') ||
      !!document.querySelector('div[data-testid="tweetButtonInline"]')
    );
  });

  if (!loggedIn) {
    throw new Error("Failed to log in - couldn't verify successful login");
  }

  console.log("Successfully logged in to Twitter");
}

/**
 * Type text with random delays between keystrokes
 */
async function typeWithRandomDelay(page, selector, text) {
  for (const char of text) {
    await page.type(selector, char, {
      delay: Math.floor(Math.random() * 100) + 50,
    });
    await setTimeout(Math.floor(Math.random() * 50) + 10);
  }
}

/**
 * Click a button that contains specific text
 */
async function clickButtonWithText(page, buttonText) {
  await setTimeout(getRandomDelay(500, 1500));

  // Find all buttons
  const buttons = await page.$$('button[role="button"]');
  let buttonFound = false;

  for (const button of buttons) {
    const text = await page.evaluate((el) => el.textContent, button);
    if (text && text.includes(buttonText)) {
      // Add human-like delay before clicking
      await setTimeout(getRandomDelay(300, 1000));
      await button.click();
      buttonFound = true;
      console.log(`Button '${buttonText}' clicked`);
      await setTimeout(getRandomDelay(1000, 2000));
      break;
    }
  }

  if (!buttonFound) {
    throw new Error(`Button with text '${buttonText}' not found`);
  }
}

/**
 * Scrape data for a single account
 */
async function scrapeAccount(page, accountName) {
  try {
    console.log(`Navigating to ${accountName}'s profile...`);
    await page.goto(`https://x.com/${accountName}`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Check if account exists or we hit a rate limit
    const isRateLimited = await page.evaluate(() => {
      return (
        document.body.textContent.includes("Rate limit exceeded") ||
        document.body.textContent.includes("Try again later")
      );
    });

    if (isRateLimited) {
      throw new Error("Rate limited by Twitter. Waiting before continuing.");
    }

    const accountExists = await page.evaluate(() => {
      return (
        !document.body.textContent.includes("This account doesn't exist") &&
        !document.body.textContent.includes("Account suspended")
      );
    });

    if (!accountExists) {
      throw new Error(`Account ${accountName} doesn't exist or is suspended`);
    }

    // Get account details
    const accountData = await extractAccountDetails(page);

    // Create a set to track post URLs we've already seen
    const seenPostUrls = new Set();
    const allAccountPosts = [];

    // Scroll to load more posts
    const scrollCount = CONFIG.scrollCountPerAccount;

    for (let i = 0; i < scrollCount; i++) {
      // Add randomness to scrolling behavior
      const scrollAmount = Math.floor(Math.random() * 300) + window.innerHeight;
      await page.evaluate((amount) => window.scrollBy(0, amount), scrollAmount);

      // Random delay between scrolls
      await setTimeout(getRandomDelay(1500, 3500));

      // Extract new posts
      const newPosts = await extractPostsData(page, accountName);

      // Filter out duplicates and add only new posts
      const uniqueNewPosts = newPosts.filter((post) => {
        const identifier = post.postUrl || post.timestamp;
        if (!identifier || seenPostUrls.has(identifier)) {
          return false;
        }
        seenPostUrls.add(identifier);
        return true;
      });

      // Add unique new posts to our collection
      allAccountPosts.push(...uniqueNewPosts);

      console.log(
        `Found ${uniqueNewPosts.length} new posts (total: ${allAccountPosts.length})`
      );

      // Longer pause every few scrolls to seem more human-like
      if (i % 5 === 0 && i > 0) {
        const longPause = getRandomDelay(5000, 10000);
        console.log(
          `Taking a longer pause (${
            longPause / 1000
          }s) to ensure content loads...`
        );
        await setTimeout(longPause);
      }

      // If we haven't found any new posts for a while, we might be at the end
      if (
        i > 10 &&
        uniqueNewPosts.length === 0 &&
        allAccountPosts.length > 0 &&
        i % 5 === 0
      ) {
        console.log(
          "No new posts found for a while. May have reached the end."
        );
        break;
      }
    }

    return {
      account: accountName,
      scrapedAt: new Date().toISOString(),
      accountDetails: accountData,
      postsCount: allAccountPosts.length,
      posts: allAccountPosts,
    };
  } catch (error) {
    console.error(`Error scraping account ${accountName}:`, error);
    throw error;
  }
}

/**
 * Extract account details
 */
async function extractAccountDetails(page) {
  try {
    // Extract profile information with better error handling
    const accountDetails = await page.evaluate(() => {
      const headerElement = document.querySelector(
        'div[data-testid="UserProfileHeader_Items"]'
      );
      const bioElement = document.querySelector(
        'div[data-testid="UserDescription"]'
      );
      const displayNameElement = document.querySelector(
        'div[data-testid="UserName"]'
      );
      const followCountsElements = document.querySelectorAll(
        'a[href*="followers"], a[href*="following"]'
      );

      // Get following/follower counts
      let followingCount = "";
      let followersCount = "";

      followCountsElements.forEach((element) => {
        const href = element.getAttribute("href");
        const countText = element.textContent.trim();

        if (href && href.includes("following")) {
          followingCount = countText;
        } else if (href && href.includes("followers")) {
          followersCount = countText;
        }
      });

      return {
        displayName: displayNameElement
          ? displayNameElement.textContent.trim()
          : "",
        bio: bioElement ? bioElement.textContent.trim() : "",
        headerInfo: headerElement ? headerElement.textContent.trim() : "",
        followingCount,
        followersCount,
        scraped: new Date().toISOString(),
      };
    });

    return accountDetails;
  } catch (error) {
    console.error("Error extracting account details:", error);
    return {
      error: "Failed to extract account details",
      scraped: new Date().toISOString(),
    };
  }
}

/**
 * Extract data from all posts on the page
 */
async function extractPostsData(page, accountName) {
  try {
    const postsData = await page.evaluate(() => {
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
          const displayTime = timeElement ? timeElement.textContent : null;

          // Extract post URL
          const linkElement = article.querySelector('a[href*="/status/"]');
          const postUrl = linkElement ? linkElement.getAttribute("href") : null;

          // Extract engagement stats
          const statsDiv =
            article.querySelector('div[aria-label*="replies"]') ||
            article.querySelector('div[aria-label*="likes"]') ||
            article.querySelector('div[role="group"]');

          let statsText = statsDiv ? statsDiv.getAttribute("aria-label") : "";

          // Parse stats with enhanced regex for higher accuracy
          let replies = 0,
            reposts = 0,
            likes = 0,
            bookmarks = 0,
            views = 0;

          if (statsText) {
            // Extract numbers using regex
            const repliesMatch = statsText.match(/(\d+,?\d*)\s+repl/i);
            const repostsMatch = statsText.match(/(\d+,?\d*)\s+repost/i);
            const likesMatch = statsText.match(/(\d+,?\d*)\s+like/i);
            const bookmarksMatch = statsText.match(/(\d+,?\d*)\s+bookmark/i);
            const viewsMatch = statsText.match(/(\d+,?\d*)\s+view/i);

            // Parse numbers handling thousands separators
            replies = repliesMatch
              ? parseInt(repliesMatch[1].replace(/,/g, ""))
              : 0;
            reposts = repostsMatch
              ? parseInt(repostsMatch[1].replace(/,/g, ""))
              : 0;
            likes = likesMatch ? parseInt(likesMatch[1].replace(/,/g, "")) : 0;
            bookmarks = bookmarksMatch
              ? parseInt(bookmarksMatch[1].replace(/,/g, ""))
              : 0;
            views = viewsMatch ? parseInt(viewsMatch[1].replace(/,/g, "")) : 0;
          }

          // Extract post content
          const tweetTextElement = article.querySelector(
            'div[data-testid="tweetText"]'
          );
          const tweetText = tweetTextElement
            ? tweetTextElement.innerText.trim()
            : "";

          // Extract media information
          const mediaElements = article.querySelectorAll(
            'div[data-testid="tweetPhoto"], div[data-testid="videoPlayer"]'
          );
          const hasMedia = mediaElements.length > 0;
          const mediaTypes = [];

          mediaElements.forEach((media) => {
            if (media.getAttribute("data-testid") === "tweetPhoto") {
              mediaTypes.push("image");
            } else if (media.getAttribute("data-testid") === "videoPlayer") {
              mediaTypes.push("video");
            }
          });

          posts.push({
            timestamp,
            displayTime,
            postUrl,
            tweetText,
            hasMedia,
            mediaTypes: mediaTypes.length > 0 ? mediaTypes : undefined,
            engagement: {
              replies: replies,
              reposts: reposts,
              likes: likes,
              bookmarks: bookmarks,
              views: views,
            },
          });
        } catch (err) {
          console.log("Error processing individual post:", err);
        }
      });

      return posts;
    });

    // Add the account name to each post
    return postsData.map((post) => {
      post.accountName = accountName;
      post.scrapedAt = new Date().toISOString();
      return post;
    });
  } catch (error) {
    console.error("Error extracting posts data:", error);
    return [];
  }
}

/**
 * Generate a random delay within the specified range
 */
function getRandomDelay(min = 2000, max = 5000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Schedule the script to run repeatedly
function scheduleRuns() {
  console.log(
    `Setting up scheduler to run every ${CONFIG.scrapeInterval / 60000} minutes`
  );

  // Run immediately
  main().catch(console.error);

  // Then schedule future runs
  setInterval(() => {
    console.log("Scheduled run starting");
    main().catch(console.error);
  }, CONFIG.scrapeInterval);
}

// Start the scheduler
scheduleRuns();
