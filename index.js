const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// QR Code generation endpoint
app.post('/generate', async (req, res) => {
  const {
    data,
    size = 300,
    color = '#000000',
    bgColor = '#ffffff',
    bodyStyle = 'square',
    eyeFrameStyle = 'square',
    eyeBallStyle = 'square',
    format = 'svg',
    errorCorrectionLevel = 'M',
    logo = null,
    logoSize = 0.3
  } = req.body;

  if (!data) {
    return res.status(400).json({ error: 'data is required' });
  }

  let browser;
  try {
    // Map our API styles to qr-code-styling options
    const dotsTypeMap = {
      'square': 'square',
      'dots': 'dots',
      'rounded': 'rounded',
      'extra-rounded': 'extra-rounded',
      'classy': 'classy',
      'classy-rounded': 'classy-rounded'
    };

    const cornersSquareTypeMap = {
      'square': 'square',
      'dot': 'dot',
      'rounded': 'rounded',
      'extra-rounded': 'extra-rounded'
    };

    const cornersDotTypeMap = {
      'square': 'square',
      'dot': 'dot',
      'circle': 'dot'
    };

    const ecLevelMap = {
      'L': 'L',
      'M': 'M',
      'Q': 'Q',
      'H': 'H'
    };

    // Launch headless browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: size + 100, height: size + 100 });

    // Create HTML page with qr-code-styling
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://unpkg.com/qr-code-styling@1.5.0/lib/qr-code-styling.js"></script>
        <style>
          body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
          #qr-container { display: inline-block; }
        </style>
      </head>
      <body>
        <div id="qr-container"></div>
        <script>
          const qrCode = new QRCodeStyling({
            width: ${size},
            height: ${size},
            type: "${format === 'svg' ? 'svg' : 'canvas'}",
            data: ${JSON.stringify(data)},
            dotsOptions: {
              color: "${color}",
              type: "${dotsTypeMap[bodyStyle] || 'square'}"
            },
            cornersSquareOptions: {
              color: "${color}",
              type: "${cornersSquareTypeMap[eyeFrameStyle] || 'square'}"
            },
            cornersDotOptions: {
              color: "${color}",
              type: "${cornersDotTypeMap[eyeBallStyle] || 'square'}"
            },
            backgroundOptions: {
              color: "${bgColor}"
            },
            qrOptions: {
              errorCorrectionLevel: "${ecLevelMap[errorCorrectionLevel] || 'M'}"
            },
            ${logo ? `
            image: "${logo}",
            imageOptions: {
              crossOrigin: "anonymous",
              margin: 5,
              imageSize: ${logoSize}
            }
            ` : ''}
          });
          
          qrCode.append(document.getElementById("qr-container"));
          
          // Signal when done
          setTimeout(() => {
            window.qrReady = true;
          }, 500);
        </script>
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Wait for QR to be rendered
    await page.waitForFunction('window.qrReady === true', { timeout: 10000 });

    let result;
    let mimeType;

    if (format === 'svg') {
      // Extract SVG content
      result = await page.evaluate(() => {
        const svg = document.querySelector('#qr-container svg');
        if (svg) {
          return svg.outerHTML;
        }
        return null;
      });

      if (result) {
        const base64 = Buffer.from(result).toString('base64');
        result = `data:image/svg+xml;base64,${base64}`;
        mimeType = 'image/svg+xml';
      }
    } else {
      // Get PNG/JPEG from canvas
      const element = await page.$('#qr-container canvas');
      if (element) {
        const screenshot = await element.screenshot({
          type: format === 'jpeg' || format === 'jpg' ? 'jpeg' : 'png',
          omitBackground: bgColor === 'transparent'
        });
        mimeType = format === 'jpeg' || format === 'jpg' ? 'image/jpeg' : 'image/png';
        result = `data:${mimeType};base64,${screenshot.toString('base64')}`;
      }
    }

    await browser.close();

    if (!result) {
      return res.status(500).json({ error: 'Failed to generate QR code' });
    }

    res.json({
      success: true,
      qr_code: result,
      mime_type: mimeType,
      format,
      size
    });

  } catch (error) {
    console.error('QR generation error:', error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({ error: 'Failed to generate QR code', details: error.message });
  }
});

// Bulk QR generation endpoint
app.post('/generate-bulk', async (req, res) => {
  const {
    items,
    size = 300,
    color = '#000000',
    bgColor = '#ffffff',
    bodyStyle = 'square',
    eyeFrameStyle = 'square',
    eyeBallStyle = 'square',
    format = 'svg'
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  if (items.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 items per request' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const results = [];

    for (const item of items) {
      const page = await browser.newPage();
      await page.setViewport({ width: size + 100, height: size + 100 });

      const dotsTypeMap = {
        'square': 'square',
        'dots': 'dots',
        'rounded': 'rounded',
        'extra-rounded': 'extra-rounded',
        'classy': 'classy',
        'classy-rounded': 'classy-rounded'
      };

      const cornersSquareTypeMap = {
        'square': 'square',
        'dot': 'dot',
        'rounded': 'rounded',
        'extra-rounded': 'extra-rounded'
      };

      const cornersDotTypeMap = {
        'square': 'square',
        'dot': 'dot',
        'circle': 'dot'
      };

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <script src="https://unpkg.com/qr-code-styling@1.5.0/lib/qr-code-styling.js"></script>
          <style>
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            #qr-container { display: inline-block; }
          </style>
        </head>
        <body>
          <div id="qr-container"></div>
          <script>
            const qrCode = new QRCodeStyling({
              width: ${size},
              height: ${size},
              type: "${format === 'svg' ? 'svg' : 'canvas'}",
              data: ${JSON.stringify(item.data)},
              dotsOptions: {
                color: "${color}",
                type: "${dotsTypeMap[bodyStyle] || 'square'}"
              },
              cornersSquareOptions: {
                color: "${color}",
                type: "${cornersSquareTypeMap[eyeFrameStyle] || 'square'}"
              },
              cornersDotOptions: {
                color: "${color}",
                type: "${cornersDotTypeMap[eyeBallStyle] || 'square'}"
              },
              backgroundOptions: {
                color: "${bgColor}"
              },
              qrOptions: {
                errorCorrectionLevel: "M"
              }
            });
            
            qrCode.append(document.getElementById("qr-container"));
            
            setTimeout(() => {
              window.qrReady = true;
            }, 500);
          </script>
        </body>
        </html>
      `;

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      await page.waitForFunction('window.qrReady === true', { timeout: 10000 });

      let qrCode;
      let mimeType;

      if (format === 'svg') {
        const svg = await page.evaluate(() => {
          const svg = document.querySelector('#qr-container svg');
          return svg ? svg.outerHTML : null;
        });
        if (svg) {
          qrCode = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
          mimeType = 'image/svg+xml';
        }
      } else {
        const element = await page.$('#qr-container canvas');
        if (element) {
          const screenshot = await element.screenshot({
            type: format === 'jpeg' || format === 'jpg' ? 'jpeg' : 'png'
          });
          mimeType = format === 'jpeg' || format === 'jpg' ? 'image/jpeg' : 'image/png';
          qrCode = `data:${mimeType};base64,${screenshot.toString('base64')}`;
        }
      }

      await page.close();

      results.push({
        data: item.data,
        name: item.name || null,
        qr_code: qrCode,
        mime_type: mimeType
      });
    }

    await browser.close();

    res.json({
      success: true,
      total: results.length,
      qr_codes: results
    });

  } catch (error) {
    console.error('Bulk QR generation error:', error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({ error: 'Failed to generate QR codes', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`QR Microservice running on port ${PORT}`);
});
