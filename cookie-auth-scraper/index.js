let request = require("request-promise").defaults({ jar: true });
const cookieJar = request.jar();
request = request.defaults({ jar: cookieJar });

const randomDelay = (min, max) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
};

async function main() {
  const result = await request.get("https://internshala.com/");
  //   console.log(cookieJar.getCookieString("https://internshala.com/"));

  await randomDelay(2000, 5000);
  const cookieString = cookieJar.getCookieString("https://internshala.com/");
  const splittedByCsrfCookieName = cookieString.split("csrf_cookie_name=");
  const csrf_test_name = splittedByCsrfCookieName[1].split(";")[0];
  console.log(csrf_test_name);

  await randomDelay(2000, 5000);

  const loginResult = await request.post(
    "https://internshala.com/login/verify_ajax/user",
    {
      form: {
        csrf_test_name: csrf_test_name,
        email: "kunal818196@gmail.com",
        password: "9899779757",
        action: "modal_login_submit",
      },
    }
  );
  console.log(loginResult);
}

main();
