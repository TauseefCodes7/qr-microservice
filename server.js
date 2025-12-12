// server.js
import express from "express";
import bodyParser from "body-parser";
import Chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import QRCodeStyling from "qr-code-styling-node";

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

app.post("/generate", async (req, res) => {
  try {
    const options = req.body.options || req.body; // accept both shapes

    // Launch puppeteer-core using sparticuz chromium
    const browser = await puppeteer.launch({
      args: Chromium.args,
      executablePath: await Chromium.executablePath(),
      headless: Chromium.headless,
      defaultViewport: null,
    });

    const page = await browser.newPage();

    // Create a minimal page and generate QR inside the page context.
    await page.setContent(`
      <html>
      <head>
        <meta charset="utf-8"/>
        <script src="https://unpkg.com/qr-code-styling/lib/qr-code-styling.js"></script>
      </head>
      <body>
        <div id="qr"></div>
        <script>
          window._options = ${JSON.stringify(options)};
        </script>
      </body>
      </html>
    `, { waitUntil: "networkidle0" });

    // Evaluate in page to let qr-code-styling render and return base64
    const base64 = await page.evaluate(async () => {
      const opts = window._options || {};
      // Ensure type defaults
      const type = (opts.type || "png").toLowerCase();
      const qr = new QRCodeStyling(opts);
      await qr.append(document.getElementById("qr"));
      const raw = await qr.getRawData(type); // returns Buffer in browser env shim
      // In puppeteer evaluate the buffer can be returned as base64 string:
      return typeof raw === "string" ? raw : raw.toString("base64");
    });

    await browser.close();

    // Determine mime
    const format = (options.type || "png").toLowerCase();
    const mimes = {
      png: "image/png",
      svg: "image/svg+xml",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      webp: "image/webp",
      pdf: "application/pdf"
    };
    const mime = mimes[format] || "image/png";

    // If the string already contains data URI, strip it
    const b64 = base64.startsWith("data:") ? base64.split(",")[1] : base64;

    res.setHeader("Content-Type", mime);
    const buffer = Buffer.from(b64, "base64");
    res.send(buffer);
  } catch (err) {
    console.error("Generate error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get("/", (req, res) => res.send("QR microservice running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
