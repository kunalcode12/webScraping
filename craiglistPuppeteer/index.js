const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

async function main() {
  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto("https://accounts.craigslist.org/login");
    await page.type("input#inputEmailHandle", "kunal818196@gmail.com", {
      delay: 200,
    });

    await page.type("input#inputPassword", "9899Kun#", { delay: 200 });

    page.click("button#login");
    await page.waitForNavigation();

    await page.goto(
      "https://accounts.craigslist.org/login/home?show_tab=searches"
    );

    const content = await page.content();
    const $ = await cheerio.load(content);

    console.log(
      $(
        "body > article > section > div.account-homepage.account-homepage-saved-searches"
      ).text()
    );
    console.log("All data fetched successfully");
  } catch (e) {
    console.error(e);
  }
}

main();
