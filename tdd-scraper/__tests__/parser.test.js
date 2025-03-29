const parser = require("../parser");
const fs = require("fs");
let html;
let listings;

beforeAll(() => {
  html = fs.readFileSync("./test.html");
  listings = parser.listings(html);
});

// const listings = [
//   {
//     title: "getting a band together - looking for Covid conscious band members",
//     url: "https://sfbay.craigslist.org/sfc/muc/d/san-francisco-getting-band-together/7837019673.html",
//     datePosted: new Date("2021-06-02"),
//     hood: "mission district",
//   },
// ];

it("should give the correct listing object", () => {
  expect(listings.length).toBe(782);
});

it("should get hood from listing", () => {
  expect(listings[0].hood).toBe("mission district");
});

it("should get correct date from listing", () => {
  expect(listings[0].datePosted).toBe(
    new Date("Mar 24 2025 15:04:56 GMT+0000")
  );
});

it("should get correct url", () => {
  expect(listings[0].url).toBe(
    "https://sfbay.craigslist.org/sfc/muc/d/san-francisco-getting-band-together/7837019673.html"
  );
});

it("should get correct title", () => {
  const listings = parser.listings(html);
  expect(listings[0].title).toBe(
    "getting a band together - looking for Covid conscious band members"
  );
});
