const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const COOKIES_PATH = path.join(__dirname, "instagram_cookies.json");

/**
 * Instagram Data Scraper with Cheerio for Better HTML Parsing
 * This script logs into Instagram and scrapes a specific number of posts from specified accounts
 */
async function main() {
  try {
    // SET YOUR TARGET POST COUNT HERE
    const TARGET_POST_COUNT = 25; // Change this to your desired number of posts per account

    console.log(`Scraping ${TARGET_POST_COUNT} posts from each account...`);

    // Launch browser with visible UI and reasonable window size
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        "--window-size=1366,768",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
      userDataDir: path.join(__dirname, "chrome_user_data_ig"),
    });

    const page = await browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    let loggedIn = false;

    if (fs.existsSync(COOKIES_PATH)) {
      console.log("Found saved cookies, attempting to use existing session...");
      const cookiesString = fs.readFileSync(COOKIES_PATH);
      const cookies = JSON.parse(cookiesString);
      await page.setCookie(...cookies);

      // Go to Instagram home to check if we're logged in
      await page.goto("https://www.instagram.com/", {
        waitUntil: "networkidle2",
      });

      // Check if we are logged in by looking for elements that only appear when logged in
      loggedIn = await page.evaluate(() => {
        // Look for elements that indicate we're logged in
        return (
          !!document.querySelector('a[href="/"]') ||
          !!document.querySelector('svg[aria-label="Home"]') ||
          !!document.querySelector('a[href*="/direct/"]') ||
          !!document.querySelector('div[role="menubar"]')
        );
      });

      console.log(
        loggedIn
          ? "Successfully logged in with saved cookies"
          : "Cookies expired, need to log in again"
      );
    }

    if (!loggedIn) {
      // Go to Instagram login page
      console.log("Navigating to Instagram login page...");
      await page.goto("https://www.instagram.com/accounts/login/", {
        waitUntil: "networkidle2",
      });

      await randomDelay(2000, 4000);

      // Enter username
      console.log("Entering username...");
      await page.waitForSelector('input[name="username"]', { timeout: 10000 });
      await page.type('input[name="username"]', "kash129553", {
        delay: 100,
      });

      // Enter password
      console.log("Entering password...");
      await page.waitForSelector('input[name="password"]');
      await page.type('input[name="password"]', "8920560393", {
        delay: 100,
      });

      await randomDelay(1000, 2000);

      // Click login button
      console.log("Clicking login button...");
      await page.click('button[type="submit"]');

      // Wait for login to complete
      console.log("Logging in...");
      await randomDelay(3000, 5000);

      // Handle potential 2FA or verification
      try {
        await page.waitForSelector('input[name="username"]', { timeout: 3000 });
        console.log("Login failed or additional verification needed");
      } catch {
        console.log("Login appears successful");
      }

      // Save cookies for future sessions
      const cookies = await page.cookies();
      fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
      console.log("Cookies saved for future sessions");

      // Handle "Save Your Login Info" popup
      try {
        await page.waitForSelector("button", { timeout: 5000 });
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
            console.log("Handled save login info popup");
            break;
          }
        }
      } catch (e) {
        console.log("No save login popup found");
      }

      // Handle "Turn on Notifications" popup
      try {
        await page.waitForSelector("button", { timeout: 5000 });
        const buttons = await page.$$("button");
        for (const button of buttons) {
          const buttonText = await page.evaluate(
            (el) => el.textContent,
            button
          );
          if (buttonText && buttonText.includes("Not Now")) {
            await button.click();
            console.log("Handled notifications popup");
            break;
          }
        }
      } catch (e) {
        console.log("No notifications popup found");
      }
    }

    // Array of accounts to scrape
    const accountsToScrape = [
      "cristiano",
      // "therock",
      // "arianagrande",
      // "selenagomez",
      // "kyliejenner",
      // "kimkardashian",
      // "leomessi",
      // "beyonce",
      // "justinbieber",
      // "taylorswift",
    ];

    const allPostsData = [];

    // Process each account
    for (let i = 0; i < accountsToScrape.length; i++) {
      await randomDelay(3000, 6000);
      const account = accountsToScrape[i];

      console.log(`Navigating to ${account}'s profile...`);
      await page.goto(`https://www.instagram.com/${account}/`, {
        waitUntil: "networkidle2",
      });

      await randomDelay(2000, 4000);

      // Get account details
      const accountData = await extractAccountDetails(page);
      console.log(`Scraping ${TARGET_POST_COUNT} posts for ${account}...`);

      // Create a set to track post URLs we've already seen
      const seenPostUrls = new Set();
      const allAccountPosts = [];
      let scrollCount = 0;
      let noNewPostsCount = 0;
      const maxNoNewPosts = 5; // Stop if no new posts found for 5 consecutive scrolls

      while (
        allAccountPosts.length < TARGET_POST_COUNT &&
        noNewPostsCount < maxNoNewPosts
      ) {
        // Scroll down to load more posts
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await randomDelay(3000, 5000);
        scrollCount++;

        // Extract new posts
        const newPosts = await extractPostsData(page, account);

        // Filter out duplicates and add only new posts
        const uniqueNewPosts = newPosts.filter((post) => {
          const identifier =
            post.postUrl ||
            `${post.engagement.likes}_${post.engagement.comments}_${scrollCount}`;
          if (!identifier || seenPostUrls.has(identifier)) {
            return false;
          }

          seenPostUrls.add(identifier);
          return true;
        });

        if (uniqueNewPosts.length === 0) {
          noNewPostsCount++;
          console.log(
            `No new posts found (${noNewPostsCount}/${maxNoNewPosts})`
          );
        } else {
          noNewPostsCount = 0;
        }

        // Add new posts to our collection (up to the target count)
        const postsToAdd = uniqueNewPosts.slice(
          0,
          TARGET_POST_COUNT - allAccountPosts.length
        );
        allAccountPosts.push(...postsToAdd);

        console.log(
          `Scroll ${scrollCount}: Found ${uniqueNewPosts.length} new posts (total: ${allAccountPosts.length}/${TARGET_POST_COUNT})`
        );

        if (scrollCount % 3 === 0 && scrollCount > 0) {
          console.log("Taking a longer pause to ensure content loads...");
          await randomDelay(4000, 7000);
        }

        // Safety check to prevent infinite scrolling
        if (scrollCount > 50) {
          console.log("Reached maximum scroll limit (50 scrolls)");
          break;
        }
      }

      // Add the account's data to our full collection
      allPostsData.push({
        account: account,
        accountDetails: accountData,
        posts: allAccountPosts,
        scrapingInfo: {
          targetPostCount: TARGET_POST_COUNT,
          totalScrolls: scrollCount,
          actualPostsFound: allAccountPosts.length,
          completedTarget: allAccountPosts.length >= TARGET_POST_COUNT,
        },
      });

      console.log(
        `Completed scraping for ${account}. Posts collected: ${allAccountPosts.length}/${TARGET_POST_COUNT}`
      );
    }

    // Save data to JSON file with timestamp in filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputFileName = `instagram_data_${TARGET_POST_COUNT}posts_${timestamp}.json`;
    fs.writeFileSync(outputFileName, JSON.stringify(allPostsData, null, 2));
    console.log(`All data fetched successfully and saved to ${outputFileName}`);

    // Print summary
    console.log("\n=== SCRAPING SUMMARY ===");
    allPostsData.forEach((accountData) => {
      console.log(
        `${accountData.account}: ${accountData.posts.length}/${TARGET_POST_COUNT} posts (${accountData.scrapingInfo.totalScrolls} scrolls)`
      );
    });

    // Keep browser open for manual review (optional)
    // await browser.close();
  } catch (error) {
    console.error("Error during scraping:", error);
  }
}

/**
 * Extract account details
 */
async function extractAccountDetails(page) {
  try {
    const accountDetails = await page.evaluate(() => {
      // Extract follower count, following count, posts count
      const statsElements = document.querySelectorAll(
        "ul li button span, ul li a span"
      );
      const stats = Array.from(statsElements).map((el) => el.textContent);

      // Extract bio
      const bioElement = document.querySelector("div.-vDIg span");
      const bio = bioElement ? bioElement.textContent : "";

      // Extract full name
      const nameElement = document.querySelector("section h2");
      const fullName = nameElement ? nameElement.textContent : "";

      // Extract verification status
      const verifiedElement = document.querySelector(
        'svg[aria-label="Verified"]'
      );
      const isVerified = !!verifiedElement;

      return {
        fullName,
        bio,
        isVerified,
        stats: stats.slice(0, 3), // [posts, followers, following]
      };
    });

    return accountDetails;
  } catch (error) {
    console.error("Error extracting account details:", error);
    return {};
  }
}

/**
 * Extract data from all posts on the page using Cheerio for better HTML parsing
 */
async function extractPostsData(page, accountName) {
  try {
    const postsData = await page.evaluate(async (currentAccountName) => {
      const posts = [];

      // Helper function to wait for a specified time
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      // Helper function to simulate mouse hover
      const hoverElement = (element) => {
        const event = new MouseEvent("mouseenter", {
          view: window,
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(event);
      };

      // Helper function to remove hover
      const unhoverElement = (element) => {
        const event = new MouseEvent("mouseleave", {
          view: window,
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(event);
      };

      // Multiple selector strategies to find post containers
      const postSelectors = [
        'div[class*="x1lliihq"][class*="x1n2onr6"]', // Primary selector from your HTML
        'div[class*="x1lliihq"] a[href*="/p/"]', // Posts with links
        'article a[href*="/p/"]', // Article-based posts
        'div[tabindex="0"] a[href*="/p/"]', // Focusable post containers
        'a[href*="/p/"]', // Direct post links
      ];

      let actualPostElements = [];

      // Try each selector until we find posts
      for (const selector of postSelectors) {
        if (selector === 'a[href*="/p/"]') {
          // For direct links, get their hoverable parent containers
          const links = document.querySelectorAll(selector);
          actualPostElements = Array.from(links)
            .map((link) => {
              // Find the best hoverable parent
              return (
                link.closest('div[class*="x1lliihq"]') ||
                link.closest('div[tabindex="0"]') ||
                link.closest("article") ||
                link.parentElement?.parentElement ||
                link.parentElement
              );
            })
            .filter((el) => el !== null);
        } else {
          actualPostElements = Array.from(document.querySelectorAll(selector));
        }

        if (actualPostElements.length > 0) {
          console.log(
            `Found ${actualPostElements.length} posts using selector: ${selector}`
          );
          break;
        }
      }

      if (actualPostElements.length === 0) {
        console.log("No post elements found with any selector");
        return posts;
      }

      // Remove duplicates by comparing elements
      const uniqueElements = [];
      const seenElements = new Set();

      for (const element of actualPostElements) {
        const elementKey =
          element.outerHTML?.substring(0, 100) || Math.random();
        if (!seenElements.has(elementKey)) {
          seenElements.add(elementKey);
          uniqueElements.push(element);
        }
      }

      actualPostElements = uniqueElements;
      console.log(
        `Processing ${actualPostElements.length} unique post elements`
      );

      for (let i = 0; i < actualPostElements.length; i++) {
        try {
          const postContainer = actualPostElements[i];

          console.log(`Processing post ${i + 1}/${actualPostElements.length}`);

          // Scroll the element into view
          postContainer.scrollIntoView({ behavior: "smooth", block: "center" });
          await wait(1000); // Wait for scroll to complete

          // Clear any existing hover states
          unhoverElement(postContainer);
          await wait(300);

          // Hover over the post container to reveal engagement data
          hoverElement(postContainer);
          await wait(2000); // Wait longer for hover effects to appear

          // Extract post URL
          let postUrl = null;
          const linkElement =
            postContainer.querySelector('a[href*="/p/"]') ||
            (postContainer.tagName === "A" &&
            postContainer.getAttribute("href")?.includes("/p/")
              ? postContainer
              : null);

          if (linkElement) {
            postUrl = linkElement.getAttribute("href");
            if (postUrl && !postUrl.startsWith("http")) {
              postUrl = `https://www.instagram.com${postUrl}`;
            }
          }

          // Initialize engagement data
          let likes = 0;
          let comments = 0;

          // Wait for hover overlay to appear
          await wait(1000);

          // Strategy 1: Look for the hover overlay (ul element that appears on hover)
          const hoverOverlay = postContainer.querySelector("ul");

          if (hoverOverlay) {
            console.log(`Found hover overlay (ul) for post ${i + 1}`);

            const overlayItems = hoverOverlay.querySelectorAll("li");
            console.log(`Found ${overlayItems.length} overlay items`);

            for (let j = 0; j < overlayItems.length; j++) {
              const item = overlayItems[j];
              const text = item.textContent || item.innerText || "";
              console.log(`Overlay item ${j + 1}: "${text}"`);

              // Extract numbers from the text
              const numberMatch = text.match(
                /(\d{1,3}(?:,\d{3})*(?:\.\d+)?[KMB]?)/i
              );
              if (numberMatch) {
                let number = numberMatch[1];

                // Convert abbreviated numbers (K, M, B)
                if (number.includes("K")) {
                  number = parseFloat(number.replace("K", "")) * 1000;
                } else if (number.includes("M")) {
                  number = parseFloat(number.replace("M", "")) * 1000000;
                } else if (number.includes("B")) {
                  number = parseFloat(number.replace("B", "")) * 1000000000;
                } else {
                  number = parseInt(number.replace(/,/g, ""));
                }

                // Determine if it's likes or comments based on position and icons
                const hasSvg = item.querySelector("svg");
                const svgContent = hasSvg ? hasSvg.innerHTML : "";

                // First item is usually likes, second is comments
                if (
                  j === 0 ||
                  svgContent.includes(
                    "M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"
                  )
                ) {
                  likes = Math.floor(number);
                  console.log(`Found likes: ${likes}`);
                } else if (
                  j === 1 ||
                  svgContent.includes(
                    "M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z"
                  )
                ) {
                  comments = Math.floor(number);
                  console.log(`Found comments: ${comments}`);
                }
              }
            }
          } else {
            console.log(
              `No hover overlay found for post ${
                i + 1
              }, trying alternative methods`
            );

            // Strategy 2: Look for engagement data in spans near SVG icons
            const svgElements = postContainer.querySelectorAll("svg");

            for (const svg of svgElements) {
              const svgContent = svg.innerHTML;
              const parent = svg.parentElement;
              const grandParent = parent?.parentElement;

              // Look for numbers in nearby elements
              const nearbyElements = [
                parent?.nextElementSibling,
                grandParent?.nextElementSibling,
                parent?.parentElement?.nextElementSibling,
                ...Array.from(
                  parent?.parentElement?.querySelectorAll("span") || []
                ),
              ].filter((el) => el);

              for (const element of nearbyElements) {
                const text = element?.textContent || "";
                const numberMatch = text.match(
                  /^(\d{1,3}(?:,\d{3})*(?:\.\d+)?[KMB]?)$/i
                );

                if (numberMatch) {
                  let number = numberMatch[1];

                  if (number.includes("K")) {
                    number = Math.floor(
                      parseFloat(number.replace("K", "")) * 1000
                    );
                  } else if (number.includes("M")) {
                    number = Math.floor(
                      parseFloat(number.replace("M", "")) * 1000000
                    );
                  } else if (number.includes("B")) {
                    number = Math.floor(
                      parseFloat(number.replace("B", "")) * 1000000000
                    );
                  } else {
                    number = parseInt(number.replace(/,/g, ""));
                  }

                  // Determine if it's likes or comments based on SVG
                  if (
                    svgContent.includes(
                      "M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"
                    ) &&
                    !likes
                  ) {
                    likes = number;
                    console.log(`Found likes via SVG: ${likes}`);
                  } else if (
                    svgContent.includes(
                      "M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z"
                    ) &&
                    !comments
                  ) {
                    comments = number;
                    console.log(`Found comments via SVG: ${comments}`);
                  }
                }
              }
            }
          }

          console.log(
            `Post ${
              i + 1
            }: URL: ${postUrl}, Likes: ${likes}, Comments: ${comments}`
          );

          // Only add posts that have engagement data or a valid URL
          if (postUrl || likes > 0 || comments > 0) {
            posts.push({
              accountName: currentAccountName,
              postUrl,
              engagement: {
                likes: likes || 0,
                comments: comments || 0,
              },
              extractedAt: new Date().toISOString(),
            });
          }

          // Remove hover to clean up
          unhoverElement(postContainer);
          await wait(800); // Longer delay between posts
        } catch (err) {
          console.log(`Error processing post ${i + 1}:`, err);
          // Continue with next post even if one fails
        }
      }

      console.log(
        `Successfully extracted ${posts.length} posts with engagement data`
      );
      return posts;
    }, accountName);

    return postsData;
  } catch (error) {
    console.error("Error extracting posts data:", error);
    return [];
  }
}

async function randomDelay(min = 2000, max = 5000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

main();
