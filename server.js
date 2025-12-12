import express from "express";
import bodyParser from "body-parser";
import QRCodeStyling from "qr-code-styling-node";

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

app.post("/generate", async (req, res) => {
  try {
    const options = req.body;

    const qr = new QRCodeStyling({
      width: options.size || 400,
      height: options.size || 400,
      data: options.data || "https://example.com",
      type: options.format || "png",
      dotsOptions: {
        type: options.dotStyle || "square",
        color: options.color || "#000000"
      },
      backgroundOptions: {
        color: options.bgColor || "#ffffff"
      },
      cornersSquareOptions: {
        type: options.cornerSquareStyle || "square",
        color: options.color || "#000000"
      },
      cornersDotOptions: {
        type: options.cornerDotStyle || "dot",
        color: options.color || "#000000"
      },
      qrOptions: {
        errorCorrectionLevel: options.errorCorrectionLevel || "H"
      }
    });

    const buffer = await qr.getRawData(options.format || "png");

    res.setHeader("Content-Type", `image/${options.format || "png"}`);
    res.send(buffer);

  } catch (error) {
    console.error("QR generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("QR microservice is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
