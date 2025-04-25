const request = require("request-promise");
const fs = require("fs");
const cheerio = require("cheerio");

async function main() {
  const result = await request.get(
    "https://www.codingwithstefan.com/table-example/"
  );
  const $ = cheerio.load(result);

  const scrapedRows = [];
  $("body > table > tbody > tr").each((index, element) => {
    if (index === 0) return true;
    const tds = $(element).find("td");
    const company = $(tds[0]).text();
    const contact = $(tds[1]).text();
    const country = $(tds[2]).text();
    // console.log($($(element).find("td")[0]).text());
    const scrappedRow = { company, contact, country };
    scrapedRows.push(scrappedRow);
  });
}

main();
