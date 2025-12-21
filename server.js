const express = require('express');
const bodyParser = require('body-parser');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.text({ type: 'text/html' }));

// ฟังก์ชันช่วยดึงข้อความจาก selector โดยมี fallback
const safeText = (element, selector) => {
  const found = element.find(selector);
  return found.length ? found.text().trim() : null;
};

// ฟังก์ชันช่วยดึง attribute ของ element โดยมี fallback
const safeAttr = (element, selector, attr) => {
  const found = element.find(selector);
  return found.length ? found.attr(attr) || null : null;
};

app.post('/parse-executors', (req, res) => {
  const html = req.body;

  if (!html || typeof html !== 'string') {
    return res.status(400).json({ success: false, message: "No HTML provided or invalid format" });
  }

  try {
    const $ = cheerio.load(html);
    const executorCards = $('.executor-card');

    if (!executorCards.length) {
      return res.json({ success: true, executors: [] });
    }

    const executors = [];

    // ดึงข้อมูลทั้งหมดก่อน แล้วค่อยดัดแปลง
    executorCards.each((i, el) => {
      const card = $(el);

      const executor = {
        name: safeText(card, '.executor-info h3') || "Unknown",
        version: safeText(card, '.detail-item:contains("Version") .detail-value') || "N/A",
        vngVersion: safeText(card, '.detail-item:contains("VNG Version") .detail-value') || "N/A",
        status: safeText(card, '.detail-item:contains("Status") .status') || "Unknown",
        downloadLinks: {
          main: safeAttr(card, '.card-actions a.btn-download', 'href') || null,
          discord: safeAttr(card, '.card-actions a.btn-icon', 'href') || null
        },
        logo: safeAttr(card, '.executor-logo', 'src') || null
      };

      executors.push(executor);
    });

    res.json({ success: true, executors });

  } catch (error) {
    console.error("Error parsing HTML:", error);
    res.status(500).json({ success: false, message: "Error parsing HTML", error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Advanced Executor Parser API running on http://localhost:${PORT}`);
});
