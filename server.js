import express from "express";
import bodyParser from "body-parser";
import puppeteer from "puppeteer";

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

app.post("/generate", async (req, res) => {
  const options = req.body;

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  await page.setContent(`
    <html>
      <body>
        <div id="qr"></div>
        <script src="https://unpkg.com/qr-code-styling/lib/qr-code-styling.js"></script>
        <script>
          const opts = ${JSON.stringify(options)};
          const qr = new QRCodeStyling(opts);
          qr.append(document.getElementById("qr"));
          qr.getRawData(opts.type || "png").then(data => {
            window.result = data.toString("base64");
          });
        </script>
      </body>
    </html>
  `);

  await page.waitForFunction(() => window.result);

  const base64 = await page.evaluate(() => window.result);

  await browser.close();

  res.json({
    success: true,
    qr_code: "data:image/png;base64," + base64
  });
});

app.listen(3000, () => console.log("QR service running on port 3000"));
