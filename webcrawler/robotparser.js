var robotsParser = require("robots-parser");

var robots = robotsParser(
  "http://www.example.com/robots.txt",
  [
    "User-agent: *",
    "Disallow: /dir/",
    "Disallow: /test.html",
    "Allow: /dir/test.html",
    "Allow: /test.html",
    "Crawl-delay: 1",
    "Sitemap: http://example.com/sitemap.xml",
    "Host: example.com",
  ].join("\n")
);

robots.isAllowed("http://www.example.com/test.html", "Sams-Bot/1.0"); // true
robots.isAllowed("http://www.example.com/dir/test.html", "Sams-Bot/1.0"); // true
robots.isDisallowed("http://www.example.com/dir/test2.html", "Sams-Bot/1.0"); // true
// robots.isExplicitlyDisallowed(
//   "http://www.example.com/dir/test2.html",
//   "Sams-Bot/1.0"
// ); // false
robots.getCrawlDelay("Sams-Bot/1.0"); // 1
robots.getSitemaps(); // ['http://example.com/sitemap.xml']
// robots.getPreferredHost(); // example.com
