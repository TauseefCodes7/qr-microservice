const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();

// ❗ Railway MUST inject this, no fallback allowed
const PORT = process.env.PORT;
if (!PORT) {
  console.error("❌ ERROR: Railway did not inject PORT env");
  process.exit(1);
}

console.log("🚀 PORT from Railway:", PORT);
console.log("🔍 PUPPETEER_EXECUTABLE_PATH:", process.env.PUPPETEER_EXECUTABLE_PATH);

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// Root route
app.get("/", (req, res) => {
  res.send("QR Microservice is running successfully.");
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Debug route
app.get("/debug", (req, res) => {
  res.json({
    port_received: PORT,
    exec_path: process.env.PUPPETEER_EXECUTABLE_PATH,
  });
});

// SINGLE QR GENERATION
app.post("/generate", async (req, res) => {
  const {
    data,
    size = 300,
    color = "#000000",
    bgColor = "#ffffff",
    bodyStyle = "square",
    eyeFrameStyle = "square",
    eyeBallStyle = "square",
    format = "svg",
    errorCorrectionLevel = "M",
    logo = null,
    logoSize = 0.3,
  } = req.body;

  if (!data) {
    return res.status(400).json({ error: "data is required" });
  }

  let browser;
  try {
    // Style mapping
    const dotsTypeMap = {
      square: "square",
      dots: "dots",
      rounded: "rounded",
      "extra-rounded": "extra-rounded",
      classy: "classy",
      "classy-rounded": "classy-rounded",
    };

    const cornersSquareTypeMap = {
      square: "square",
      dot: "dot",
      rounded: "rounded",
      "extra-rounded": "extra-rounded",
    };

    const cornersDotTypeMap = {
      square: "square",
      dot: "dot",
      circle: "dot",
    };

    const ecLevelMap = { L: "L", M: "M", Q: "Q", H: "H" };

    // Launch Chrome
    const browser = await puppeteer.launch({
    headless: "new",
    args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });


    const page = await browser.newPage();
    await page.setViewport({ width: size + 100, height: size + 100 });

    // HTML rendering content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <body style="margin:0; display:flex; justify-content:center; align-items:center; height:100vh;">
        <div id="qr"></div>

        <script src="https://unpkg.com/qr-code-styling@1.5.0/lib/qr-code-styling.js"></script>

        <script>
          const qr = new QRCodeStyling({
            width: ${size},
            height: ${size},
            data: ${JSON.stringify(data)},
            type: "${format === "svg" ? "svg" : "canvas"}",
            dotsOptions: { color: "${color}", type: "${dotsTypeMap[bodyStyle]}" },
            cornersSquareOptions: { color: "${color}", type: "${cornersSquareTypeMap[eyeFrameStyle]}" },
            cornersDotOptions: { color: "${color}", type: "${cornersDotTypeMap[eyeBallStyle]}" },
            backgroundOptions: { color: "${bgColor}" },
            qrOptions: { errorCorrectionLevel: "${ecLevelMap[errorCorrectionLevel]}" },
            ${
              logo
                ? `
            image: "${logo}",
            imageOptions: { margin: 5, imageSize: ${logoSize} }
            `
                : ""
            }
          });

          qr.append(document.getElementById("qr"));
          setTimeout(() => window.done = true, 500);
        </script>
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    await page.waitForFunction("window.done === true", { timeout: 10000 });

    let result;
    let mimeType;

    if (format === "svg") {
      const svg = await page.evaluate(() => {
        const el = document.querySelector("svg");
        return el ? el.outerHTML : null;
      });
      result = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
      mimeType = "image/svg+xml";
    } else {
      const canvas = await page.$("canvas");
      const screenshot = await canvas.screenshot({
        type: format === "jpeg" ? "jpeg" : "png",
      });
      mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
      result = `data:${mimeType};base64,${screenshot.toString("base64")}`;
    }

    await browser.close();

    res.json({
      success: true,
      qr_code: result,
      mime_type: mimeType,
    });
  } catch (err) {
    console.error("QR generation failed:", err);
    if (browser) await browser.close();

    res.status(500).json({ error: "QR generation failed", details: err.message });
  }
});

// START SERVER — required by Railway
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ QR Microservice running on port ${PORT}`);
});

