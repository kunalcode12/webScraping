const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const COOKIES_PATH = path.join(__dirname, "instagram_cookies.json");
const DATA_PATH = path.join(__dirname, "instagram_data.json");

/**
 * Instagram Data Scraper with Post Content Extraction
 * This script logs into Instagram and scrapes detailed post data including text and likes
 */

// Helper function for random delays
function randomDelay(min, max) {
  return new Promise((resolve) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, delay);
  });
}

// Function to extract post data from individual post page
async function extractPostData(page, postUrl) {
  try {
    console.log(`Extracting data from: ${postUrl}`);

    await page.goto(postUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await randomDelay(2000, 4000);

    const postData = await page.evaluate(() => {
      // Extract post text from h1 tag or article content
      let postText = "";
      const h1Element = document.querySelector("h1");
      if (h1Element) {
        postText = h1Element.textContent.trim();
      } else {
        // Alternative selectors for post text
        const textSelectors = [
          'article div[data-testid="post-content"] span',
          'article span[dir="auto"]',
          'article div span:not([class*="notranslate"])',
          'meta[property="og:description"]',
        ];

        for (const selector of textSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            if (element.tagName === "META") {
              postText = element.getAttribute("content");
            } else {
              postText = element.textContent.trim();
            }
            if (postText && postText.length > 10) break;
          }
        }
      }

      // Extract likes count
      let likes = 0;
      const likeSelectors = [
        'a[href*="/liked_by/"] span',
        'button span:contains("likes")',
        'section div span:contains("likes")',
        'div[role="button"] span',
      ];

      for (const selector of likeSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent.toLowerCase();
          if (text.includes("like") || text.includes("others")) {
            const numbers = text.match(/[\d,]+/g);
            if (numbers) {
              likes = parseInt(numbers[0].replace(/,/g, ""));
              break;
            }
          }
        }
        if (likes > 0) break;
      }

      // Extract additional metadata
      const timestamp =
        document.querySelector("time")?.getAttribute("datetime") || "";
      const username = document.querySelector("header a")?.textContent || "";

      return {
        url: window.location.href,
        username,
        postText: postText || "No text content found",
        likes,
        timestamp,
        extractedAt: new Date().toISOString(),
      };
    });

    console.log(
      `✓ Extracted: ${postData.postText.substring(0, 100)}... | Likes: ${
        postData.likes
      }`
    );
    return postData;
  } catch (error) {
    console.error(`Error extracting post data from ${postUrl}:`, error.message);
    return {
      url: postUrl,
      error: error.message,
      extractedAt: new Date().toISOString(),
    };
  }
}

//Function to scrape posts from a profile
// async function scrapeProfilePosts(page, username, targetCount = 30) {
//   try {
//     console.log(`\n=== Scraping posts from @${username} ===`);

//     const profileUrl = `https://www.instagram.com/${username}/`;
//     await page.goto(profileUrl, { waitUntil: "networkidle2", timeout: 30000 });
//     await randomDelay(3000, 5000);

//     let postUrls = [];
//     let scrollAttempts = 0;
//     const maxScrollAttempts = 10;

//     while (
//       postUrls.length < targetCount &&
//       scrollAttempts < maxScrollAttempts
//     ) {
//       // Extract post URLs from the current page
//       const newUrls = await page.evaluate(() => {
//         const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
//         return links
//           .map((link) => link.href)
//           .filter((href) => href.includes("/p/"));
//       });

//       // Add new unique URLs
//       newUrls.forEach((url) => {
//         if (!postUrls.includes(url)) {
//           postUrls.push(url);
//         }
//       });

//       console.log(`Found ${postUrls.length} post URLs so far...`);

//       if (postUrls.length < targetCount) {
//         // Scroll down to load more posts
//         await page.evaluate(() => {
//           window.scrollTo(0, document.body.scrollHeight);
//         });
//         await randomDelay(3000, 5000);
//         scrollAttempts++;
//       }
//     }

//     // Limit to target count
//     postUrls = postUrls.slice(0, targetCount);
//     console.log(`Found ${postUrls.length} posts to scrape from @${username}`);

//     // Extract data from each post
//     const postsData = [];
//     for (let i = 0; i < postUrls.length; i++) {
//       console.log(`\nScraping post ${i + 1}/${postUrls.length}`);
//       const postData = await extractPostData(page, postUrls[i]);
//       postsData.push(postData);

//       // Random delay between posts to avoid rate limiting
//       await randomDelay(2000, 4000);
//     }

//     return {
//       username,
//       totalPosts: postsData.length,
//       posts: postsData,
//       scrapedAt: new Date().toISOString(),
//     };
//   } catch (error) {
//     console.error(`Error scraping profile @${username}:`, error.message);
//     return {
//       username,
//       error: error.message,
//       scrapedAt: new Date().toISOString(),
//     };
//   }
// }

async function scrapeProfilePosts(page, username, targetCount = 30) {
  try {
    console.log(`\n=== Scraping posts from @${username} ===`);

    const profileUrl = `https://www.instagram.com/${username}/`;
    await page.goto(profileUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await randomDelay(3000, 5000);

    let postUrls = new Set(); // Use Set to avoid duplicates automatically
    let scrollAttempts = 0;
    const maxScrollAttempts = 15; // Increased attempts
    let previousCount = 0;
    let stuckCount = 0;

    while (postUrls.size < targetCount && scrollAttempts < maxScrollAttempts) {
      // Extract post URLs with multiple selector strategies
      const newUrls = await page.evaluate(() => {
        const allLinks = [];

        const directLinks = Array.from(document.querySelectorAll("a"));
        directLinks.forEach((link) => {
          if (
            link.href &&
            (link.href.includes("/p/") || link.href.includes("/reel/"))
          ) {
            allLinks.push(link.href);
          }
        });

        // Filter and deduplicate URLs
        const filteredUrls = allLinks;
        // Remove duplicates
        return [...new Set(filteredUrls)];
      });

      // Add new URLs to our Set
      const previousSize = postUrls.size;
      newUrls.forEach((url) => postUrls.add(url));

      console.log(
        `Found ${newUrls.length} new URLs, total: ${postUrls.size} post URLs so far...`
      );

      // Check if we're stuck (no new posts found)
      if (postUrls.size === previousCount) {
        stuckCount++;
        console.log(`No new posts found (attempt ${stuckCount}/3)`);
        if (stuckCount >= 3) {
          console.log("No more posts available, stopping scroll");
          break;
        }
      } else {
        stuckCount = 0; // Reset stuck counter
      }

      previousCount = postUrls.size;

      if (postUrls.size < targetCount) {
        // Multiple scroll strategies
        await page.evaluate(() => {
          // Scroll to bottom
          window.scrollTo(0, document.body.scrollHeight);
        });
        await randomDelay(2000, 3000);

        // Additional scroll with mouse wheel simulation
        await page.evaluate(() => {
          // Simulate mouse wheel scroll
          const scrollEvent = new WheelEvent("wheel", {
            deltaY: 1000,
            deltaMode: 0,
            bubbles: true,
          });
          document.dispatchEvent(scrollEvent);
        });
        await randomDelay(2000, 4000);

        // Try clicking "Show more" if it appears
        try {
          const showMoreButton = await page.$(
            'button:contains("Show more"), button[aria-label*="more"]'
          );
          if (showMoreButton) {
            await showMoreButton.click();
            console.log("Clicked 'Show more' button");
            await randomDelay(3000, 5000);
          }
        } catch (e) {
          // Show more button not found, continue
        }

        scrollAttempts++;
      }
    }

    // Convert Set to Array and limit to target count
    const postUrlsArray = Array.from(postUrls).slice(0, targetCount);
    console.log(
      `\n✓ Found ${postUrlsArray.length} posts to scrape from @${username}`
    );
    console.log("Sample URLs:", postUrlsArray.slice(0, 3));

    // Extract data from each post
    const postsData = [];
    for (let i = 0; i < postUrlsArray.length; i++) {
      console.log(`\nScraping post ${i + 1}/${postUrlsArray.length}`);
      const postData = await extractPostData(page, postUrlsArray[i]);
      postsData.push(postData);

      // Random delay between posts to avoid rate limiting
      await randomDelay(2000, 4000);
    }

    return {
      username,
      totalPosts: postsData.length,
      posts: postsData,
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error scraping profile @${username}:`, error.message);
    return {
      username,
      error: error.message,
      scrapedAt: new Date().toISOString(),
    };
  }
}

async function main() {
  try {
    const TARGET_POST_COUNT = 30; // Number of posts to scrape per account

    console.log(
      `Starting Instagram scraper for ${TARGET_POST_COUNT} posts per account...`
    );

    // Launch browser
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        "--window-size=1366,768",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
      ],
      userDataDir: path.join(__dirname, "chrome_user_data_ig"),
    });

    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    let loggedIn = false;

    // Try to use saved cookies
    if (fs.existsSync(COOKIES_PATH)) {
      console.log("Found saved cookies, attempting to use existing session...");
      const cookiesString = fs.readFileSync(COOKIES_PATH);
      const cookies = JSON.parse(cookiesString);
      await page.setCookie(...cookies);

      await page.goto("https://www.instagram.com/", {
        waitUntil: "networkidle2",
      });

      loggedIn = await page.evaluate(() => {
        return (
          !!document.querySelector('a[href="/"]') ||
          !!document.querySelector('svg[aria-label="Home"]') ||
          !!document.querySelector('a[href*="/direct/"]') ||
          !!document.querySelector('div[role="menubar"]')
        );
      });

      console.log(
        loggedIn
          ? "✓ Successfully logged in with saved cookies"
          : "✗ Cookies expired, need to log in again"
      );
    }

    // Login if not already logged in
    if (!loggedIn) {
      console.log("Logging into Instagram...");
      await page.goto("https://www.instagram.com/accounts/login/", {
        waitUntil: "networkidle2",
      });
      await randomDelay(2000, 4000);

      // Enter credentials (replace with your credentials)
      await page.waitForSelector('input[name="username"]', { timeout: 10000 });
      await page.type('input[name="username"]', "YOUR_USERNAME", {
        delay: 100,
      });

      await page.waitForSelector('input[name="password"]');
      await page.type('input[name="password"]', "YOUR_PASSWORD", {
        delay: 100,
      });

      await randomDelay(1000, 2000);
      await page.click('button[type="submit"]');

      console.log("Logging in...");
      await randomDelay(5000, 8000);

      // Save cookies
      const cookies = await page.cookies();
      fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
      console.log("✓ Cookies saved for future sessions");

      // Handle popups
      try {
        const buttons = await page.$$("button");
        for (const button of buttons) {
          const buttonText = await page.evaluate(
            (el) => el.textContent,
            button
          );
          if (
            buttonText &&
            (buttonText.includes("Not Now") || buttonText.includes("Save Info"))
          ) {
            await button.click();
            console.log("✓ Handled login popup");
            break;
          }
        }
      } catch (e) {
        console.log("No login popup found");
      }
    }

    // Accounts to scrape
    const accountsToScrape = [
      //   "cristiano",
      //   "leomessi",
      //   "selenagomez",
      //   "therock",
      //   "kyliejenner",
      //   "arianagrande",
      //   "kimkardashian",
      //   "rohitsharma45",
      //   "tombrady",
      //   "justinbieber",
      //   "narendramodi",
      //   "who",
      //   "virat.kohli",
      //   "mrbeast",
      //   "kamalaharris",
      //   "wired",
      //   "openai",
      //   "neildegrassetyson",
      //   "markrober",
      //   "dualipa",
      //   "carryminati",
      //   "magnus_carlsen",
      //   "champagnepapi", // Drake
      //   "physicsfun",

      //   "emmawatson",
      "nasa",
      "natgeo",
      "cryptodaily",
      "crypto.kiran",
      "solana", // Official Solana account
    ];

    const allScrapedData = [];

    // Scrape each account
    for (let i = 0; i < accountsToScrape.length; i++) {
      const username = accountsToScrape[i];
      console.log(
        `\n📱 Starting to scrape account ${i + 1}/${
          accountsToScrape.length
        }: @${username}`
      );

      const accountData = await scrapeProfilePosts(
        page,
        username,
        TARGET_POST_COUNT
      );
      allScrapedData.push(accountData);

      // Save individual account data to its own file
      const accountFilePath = path.join(__dirname, `${username}_data.json`);
      fs.writeFileSync(accountFilePath, JSON.stringify(accountData, null, 2));

      // Save data after each account in case of interruption
      fs.writeFileSync(DATA_PATH, JSON.stringify(allScrapedData, null, 2));
      console.log(
        `✓ Data saved for @${username} (${
          accountData.posts?.length || 0
        } posts)`
      );
      console.log(`📁 Individual file saved: ${accountFilePath}`);

      // Longer delay between accounts
      if (i < accountsToScrape.length - 1) {
        console.log("Waiting before next account...");
        await randomDelay(5000, 10000);
      }
    }

    // Final save and summary
    fs.writeFileSync(DATA_PATH, JSON.stringify(allScrapedData, null, 2));

    console.log("\n🎉 Scraping completed!");
    console.log("=== SUMMARY ===");
    allScrapedData.forEach((account) => {
      console.log(
        `@${account.username}: ${account.posts?.length || 0} posts scraped`
      );
    });
    console.log(`📁 Combined data saved to: ${DATA_PATH}`);
    console.log(`📁 Individual files created for each account`);

    await browser.close();
  } catch (error) {
    console.error("Main error:", error);
  }
}

// Run the scraper
main().catch(console.error);
