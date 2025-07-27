const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(
    "https://www.uvic.ca/calendar/undergrad/index.php#/programs/SJKVp7AME",
    {
      waitUntil: "domcontentloaded",
    }
  );

  await page.waitForSelector('a[href*="courses/view"]');

  const courses = await page.evaluate(() => {
    const courseList = [];
    const items = document.querySelectorAll('a[href*="courses/view"]');
    items.forEach((item) => {
      const course = item.innerText.trim();
      const href =
        "https://www.uvic.ca/calendar/undergrad/index.php" +
        item.getAttribute("href");
      if (course.length > 0) {
        courseList.push({ course, href });
      }
    });
    console.log("COMPLETED COURSE LIST");
    return courseList;
  });

  const finalData = [];

  for (const { course, href } of courses) {
    try {
      const coursePage = await browser.newPage();
      await coursePage.goto(href, {
        waitUntil: "domcontentloaded",
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));
      await coursePage.waitForSelector('a[href*="courses/view"]');

      const prereqInfo = await coursePage.evaluate(() => {
        const h3s = [...document.querySelectorAll("h3")];
        const prereqHeader = h3s.find((h) =>
          h.innerText.includes("Prerequisites")
        );
        const prereqSection = prereqHeader?.nextElementSibling;

        if (!prereqSection) {
          console.log("NO PRE-REQ SECTION FOUND");
          return {
            prereqText: null,
            prereqHTML: null,
            prereqLinks: [],
          };
        }

        const prereqText = prereqSection.innerText.trim();
        const links = [...prereqSection.querySelectorAll("a")].map((link) => ({
          text: link.innerText.trim(),
          href: link.href,
        }));

        const baseURL = "https://www.uvic.ca/calendar/undergrad/index.php";
        prereqSection.querySelectorAll('a[href^="#"]').forEach((link) => {
          const relative = link.getAttribute("href");
          link.setAttribute("href", baseURL + relative);
        });

        prereqSection.querySelectorAll("a").forEach((link) => {
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
        });

        const prereqHTML = prereqSection.innerHTML;

        return { prereqText, prereqHTML, prereqLinks: links };
      });

      finalData.push({
        course: course,
        href: href,
        prereqText: prereqInfo.prereqText,
        prereqHTML: prereqInfo.prereqHTML,
        prereqLinks: prereqInfo.prereqLinks,
      });
      await coursePage.close();
    } catch (err) {
      console.error(`Error processing ${course.course}:`, err.message);
    }
  }

  // Save the array to courses.json
  fs.writeFileSync("courses.json", JSON.stringify(finalData, null, 2));
  console.log(`Saved ${finalData.length} courses to courses.json`);

  await browser.close();
})();
