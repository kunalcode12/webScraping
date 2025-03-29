const axios = require("axios");
const cheerio = require("cheerio");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrapeJobsFromIndexPages() {
  const allJobs = [];
  for (let i = 1; i < 14; i++) {
    const jobIndexPage = await axios.get(
      `https://braigslist.vercel.app/jobs/${i}`
    );
    console.log("Request fired:" + i);
    await sleep(1000);
    const $ = cheerio.load(jobIndexPage.data);

    const jobs = $(".title-blob > a")
      .map((index, element) => {
        const title = $(element).text();
        const url = $(element).attr("href");

        return { title, url };
      })
      .get();

    allJobs.push(...jobs);
  }
  console.log(allJobs.length);
  return allJobs;
}

async function scrapeJobDescription(allJobs) {
  let allJobsWithDescription = [];

  for (const job of allJobs) {
    const jobDescriptionPage = await axios.get(
      `https://braigslist.vercel.app${job.url}`
    );
    // console.log("Request fired:" + job.url);
    const $ = cheerio.load(jobDescriptionPage.data);
    const description = $("div").text();
    // console.log(description);
    job.description = description;
    allJobsWithDescription.push(job);
  }

  //in below map method , we are making multiple requests at the same time ,which can cause the ban from website ,so above methid is better one
  // const allJobsWithDescriotionPromises = allJobs.map(async (job) => {
  //   const jobDescriptionPage = await axios.get(
  //     `https://braigslist.vercel.app${job.url}`
  //   );
  //   console.log("Request fired:" + job.url);
  //   const $ = cheerio.load(jobDescriptionPage.data);
  //   const description = $("div").text();
  //   // console.log(description);
  //   job.description = description;
  //   return job;
  // });

  // const allJobsWithDescription = await Promise.all(
  //   allJobsWithDescriotionPromises
  // );
  // console.log(allJobsWithDescription);
}

async function main() {
  const allJobs = await scrapeJobsFromIndexPages();
  scrapeJobDescription(allJobs);
}

main();
