const request = require("request-promise");
const cheerio = require("cheerio");
const Nightmare = require("nightmare");
const nightmare = Nightmare({ show: true });

async function scrapeTitlesRanksAndRatings() {
  try {
    const result = await request.get(
      "https://www.imdb.com/chart/moviemeter/?ref_=nv_mv_mpm&sort=user_rating%2Cdesc"
    );

    const $ = cheerio.load(result);

    const movies = [];

    $("li.ipc-metadata-list-summary-item").each((index, element) => {
      // Within each list item, find the title element
      const title = $(element).find("h3.ipc-title__text").text();

      //All metadata items (year, runtime, rating)
      const metadataItems = $(element).find("span.cli-title-metadata-item");
      const ranking = $(element)
        .find("div.cli-meter-title-header")
        .text()
        .trim();

      const descriptionUrl = $(element).find("a").attr("href");
      const descriptionUrlFull = `https://www.imdb.com${descriptionUrl}`; // Full URL for the description page
      const posterUrl = $(element).find("img").attr("src");

      const imdbRating = $(element).find("span.ipc-rating-star--rating").text();

      const year = metadataItems.eq(0).text();
      const runtime = metadataItems.eq(1).text();
      const rating = metadataItems.eq(2).text();

      movies.push({
        title,
        year,
        runtime,
        rating,
        ranking,
        descriptionUrl,
        descriptionUrlFull,
        posterUrl,
        imdbRating,
      });

      console.log(`Movie ${index + 1}: ${title}`);
      console.log(`Year: ${year}`);
      console.log(`Runtime: ${runtime}`);
      console.log(`Rating: ${rating}`);
      console.log(`Ranking: ${ranking}`);
      console.log(`Description URL: ${descriptionUrlFull}`);
      console.log(`Poster URL: ${posterUrl}`);
      console.log(`IMDB Rating: ${imdbRating}`);
      console.log("---------------------");
    });

    return movies;
  } catch (error) {
    console.error("Error scraping data:", error);
    return [];
  }
}

async function scrapePosterUrl(movies) {
  const moviesWithPosterURls = await Promise.all(
    movies.map(async (movie) => {
      try {
        const html = await request.get(movie.descriptionUrlFull);

        const $ = await cheerio.load(html);
        movie.posterUrl2 = $("div.ipc-poster > a").attr("href");
        return movie;
      } catch (err) {
        console.error(err);
        return movie;
      }
    })
  );

  return moviesWithPosterURls;
}

async function main() {
  let movies = await scrapeTitlesRanksAndRatings();
  movies = await scrapePosterUrl(movies);
  console.log(movies);
}

main();
