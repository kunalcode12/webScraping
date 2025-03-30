const request = require("request-promise");
const fs = require("fs");

async function main() {
  try {
    // First, get the login page to capture any tokens or cookies
    const jar = request.jar();

    // Now attempt the login with all required fields
    const loginResponse = await request.post(
      "https://accounts.craigslist.org/login",
      {
        form: {
          step: "confirmation",
          rt: "",
          rp: "",
          p: "0",
          inputEmailHandle: "kunal818196@gmail.com", // Replace with your email
          inputPassword: "9899Kun#", // Replace with your password
        },
        headers: {
          Referer: "https://accounts.craigslist.org/login",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        simple: false,
        followAllRedirects: true,
        jar: true,
        //   resolveWithFullResponse: true
      }
    );

    // Check if login was successful

    fs.writeFileSync("./account_data.html", loginResponse);
    console.log("Account data saved to account_data.html");
  } catch (e) {
    console.error(e);
  }
}

main();
