const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

let browser;

async function scrapeHomesInIndexPage(url) {
  try {
    const page = await browser.newPage();
    await page.goto(url);

    const html = await page.evaluate(() => document.body.innerHTML);
    const $ = await cheerio.load(html);

    const homes = $("[itemprop='url']")
      .map((i, element) => "https://" + $(element).attr("content"))
      .get();

    return homes;
  } catch (err) {
    console.error(err);
  }
}

async function scrapeDescriptionPage(url, page) {
  try {
    await page.goto(url, { waitUntil: "networkidle2" });

    const html = await page.evaluate(() => document.body.innerHTML);
    const $ = await cheerio.load(html);

    const pricePerNight = $(
      "#site > div > div:nth-child(1) > div:nth-child(3) > div > div > div > div > div:nth-child(1) > div > div > div > div:nth-child(2) > div > div > div > div > div > div > span > div:nth-child(1) > div > span > div > button > span"
    ).text();
    console.log(pricePerNight);
  } catch (err) {
    console.error(err);
  }
}

async function main() {
  browser = await puppeteer.launch({ headless: false });
  const descriptionPage = await browser.newPage();
  const homes = await scrapeHomesInIndexPage(
    "https://www.airbnb.co.in/s/Copenhagen/homes?refinement_paths%5B%5D=%2Fhomes&click_referer=t%3ASEE_ALL%7Csid%3A9ea0a18e-f8e0-4eec-8840-b5a4290dfd22%7Cst%3ASTOREFRONT_DESTINATION_GROUPINGS&title_type=HOMES_WITH_LOCATION&query=Copenhagen&allow_override%5B%5D=&s_tag=UrkEXloL&section_offset=7&items_offset=36&locale=en&_set_bev_on_new_domain=1745766765_EAN2I5YTE0MjIyOW"
  );

  for (let i = 0; i < homes.length; i++) {
    await scrapeDescriptionPage(homes[i], descriptionPage);
    const delay = 2000;
    console.log(`Waiting ${delay}ms before next request...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  console.log(homes);
}

main();
