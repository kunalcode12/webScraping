const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

async function scrapeListings(page) {
  await page.goto("https://sfbay.craigslist.org/search/sof#search=2~thumb~0");
  await page.waitForSelector(".cl-search-result");

  const html = await page.content();
  const $ = cheerio.load(html);

  const results = $(".result-node")
    .map((index, element) => {
      const titleElement = $(element).find(
        ".cl-app-anchor.text-only.posting-title"
      );
      const loaction = $(element).find(".supertitle").text();
      const time = $(element).find(".meta").find("span").attr("title");
      const url = $(titleElement).attr("href");
      const title = $(titleElement).find("span.label").text();
      return { title, url, time, loaction };
    })
    .get();

  return results;
}

async function scrapeJobDescriptions(listings, page) {
  for (let i = 0; i < listings.length; i++) {
    await page.goto(listings[i].url);
    const html = await page.content();
    const $ = cheerio.load(html);

    const jobDescription = $("#postingbody").text();
    listings[i].jobDescription = jobDescription;
    console.log(listings[i].jobDescription);
    await sleep(1000);
  }
  return listings;
}

async function sleep(miliseconds) {
  return new Promise((resolve) => setTimeout(resolve, miliseconds));
}

async function main() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  const listings = await scrapeListings(page);

  const listingsWithJobDescription = await scrapeJobDescriptions(
    listings,
    page
  );
  // console.log(listings);
  console.log(listingsWithJobDescription);
}

main();
