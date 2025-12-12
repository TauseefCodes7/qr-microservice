import express from "express";
import bodyParser from "body-parser";
import puppeteer from "puppeteer";

const app = express();
app.use(bodyParser.json({ limit: "20mb" }));

app.post("/generate", async (req, res) => {
  let { data, width, height, format, bodyStyle, eyeFrameStyle, eyeBallStyle, color, bgColor } = req.body;

  width = width || 400;
  height = height || 400;
  format = (format || "png").toLowerCase();

  try {
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
          window.generateQR = async () => {
            const qr = new QRCodeStyling({
              width: ${width},
              height: ${height},
              data: \`${data}\`,
              type: "${format}",
              backgroundOptions: { color: "${bgColor || "#ffffff"}" },
              dotsOptions: { type: "${bodyStyle || "square"}", color: "${color || "#000000"}" },
              cornersSquareOptions: { type: "${eyeFrameStyle || "square"}", color: "${color || "#000"}" },
              cornersDotOptions: { type: "${eyeBallStyle || "square"}", color: "${color || "#000"}" }
            });

            const raw = await qr.getRawData("${format}");
            return raw;
          };
        </script>
      </body>
      </html>
    `);

    const buffer = await page.evaluate(async () => {
      const result = await window.generateQR();
      return result.toString("base64");
    });

    await browser.close();

    const mimeTypes = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      svg: "image/svg+xml",
      pdf: "application/pdf"
    };

    res.setHeader("Content-Type", mimeTypes[format] || "image/png");
    res.send(Buffer.from(buffer, "base64"));

  } catch (err) {
    console.error("QR ERROR:", err);
    res.status(500).send("Failed to generate QR");
  }
});

app.get("/", (req, res) => res.send("QR microservice running"));

app.listen(3000, () => console.log("Server running on port 3000"));
