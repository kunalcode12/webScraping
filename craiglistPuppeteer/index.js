const puppeteer = require("puppeteer");

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
  } catch (e) {
    console.error(e);
  }
}

main();
