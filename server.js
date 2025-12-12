import express from "express";
import puppeteer from "puppeteer";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

app.post("/generate", async (req, res) => {
  try {
    const { options, output } = req.body;

    if (!options) {
      return res.status(400).json({ error: "Missing 'options' field" });
    }

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Load qr-code-styling library
    await page.setContent(`
      <html>
        <head>
          <script src="https://unpkg.com/qr-code-styling/lib/qr-code-styling.js"></script>
        </head>
        <body>
          <div id="qr"></div>
          <script>
            window.options = ${JSON.stringify(options)};
          </script>
        </body>
      </html>
    `);

    await page.waitForSelector("#qr");

    // Generate the QR code inside browser
    const result = await page.evaluate(async () => {
      const qr = new QRCodeStyling(window.options);
      await qr.append(document.getElementById("qr"));
      const type = window.options.type || "png";
      const buffer = await qr.getRawData(type);
      return buffer.toString("base64");
    });

    await browser.close();

    const mimeTypes = {
      png: "image/png",
      svg: "image/svg+xml",
      jpeg: "image/jpeg",
      webp: "image/webp",
      pdf: "application/pdf",
    };

    const format = output || options.type || "png";

    res.json({
      success: true,
      format,
      qr_code: `data:${mimeTypes[format]};base64,${result}`,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: error.toString(),
    });
  }
});

app.get("/", (req, res) => {
  res.send("QR Code Microservice Running ✔");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`QR Microservice running on ${PORT}`));
