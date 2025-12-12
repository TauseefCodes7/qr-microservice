const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();

// Railway MUST override the port — no fallback allowed
const PORT = process.env.PORT;

console.log("🚀 Using PORT:", PORT);
console.log("🔍 Chromium path:", process.env.PUPPETEER_EXECUTABLE_PATH);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Root route
app.get("/", (req, res) => {
  res.send("QR Microservice is running ✔️");
});

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Helper: launch browser safely
async function launchBrowser() {
  return await puppeteer.launch({
    headless: "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer"
    ]
  });
}

// Single QR generator
app.post("/generate", async (req, res) => {
  try {
    const browser = await launchBrowser();
    const page = await browser.newPage();

    const {
      data,
      size = 300,
      color = "#000000",
      bgColor = "#ffffff",
      bodyStyle = "square",
      eyeFrameStyle = "square",
      eyeBallStyle = "square",
      format = "svg"
    } = req.body;

    if (!data) return res.status(400).json({ error: "data is required" });

    const html = `
      <html>
      <head>
        <script src="https://unpkg.com/qr-code-styling@1.5.0/lib/qr-code-styling.js"></script>
      </head>
      <body>
        <div id="qr"></div>
        <script>
          const qr = new QRCodeStyling({
            width: ${size},
            height: ${size},
            data: ${JSON.stringify(data)},
            type: "${format === "svg" ? "svg" : "canvas"}",
            dotsOptions: { color: "${color}", type: "${bodyStyle}" },
            cornersSquareOptions: { color: "${color}", type: "${eyeFrameStyle}" },
            cornersDotOptions: { color: "${color}", type: "${eyeBallStyle}" },
            backgroundOptions: { color: "${bgColor}" }
          });

          qr.append(document.getElementById("qr"));
          setTimeout(() => window.done = true, 500);
        </script>
      </body>
      </html>
    `;

    await page.setViewport({ width: size + 40, height: size + 40 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.waitForFunction("window.done === true");

    let image;

    if (format === "svg") {
      const svg = await page.$eval("#qr svg", (el) => el.outerHTML);
      image = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    } else {
      const canvas = await page.$("#qr canvas");
      const buffer = await canvas.screenshot({ type: "png" });
      image = `data:image/png;base64,${buffer.toString("base64")}`;
    }

    await browser.close();

    res.json({ success: true, qr_code: image });
  } catch (err) {
    console.error("🔥 QR Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ QR Microservice running on ${PORT}`);
});
