const express = require('express');
const axios = require('axios'); // ดึง HTML จาก URL
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// ฟังก์ชันช่วยดึงข้อความจาก selector โดย fallback
const safeText = (element, selector) => {
  const found = element.find(selector);
  return found.length ? found.text().trim() : null;
};

const safeAttr = (element, selector, attr) => {
  const found = element.find(selector);
  return found.length ? found.attr(attr) || null : null;
};

// GET /parse-executors?url=...
app.get('/parse-executors', async (req, res) => {
  const { url } = req.query;

  if (!url) return res.status(400).json({ success: false, message: "Missing URL parameter" });

  try {
    // ดึง HTML จาก URL
    const response = await axios.get(url);
    const html = response.data;

    const $ = cheerio.load(html);
    const executorCards = $('.executor-card');

    if (!executorCards.length) return res.json({ success: true, executors: [] });

    const executors = [];
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
    console.error("Error fetching or parsing URL:", error.message);
    res.status(500).json({ success: false, message: "Error fetching or parsing URL", error: error.message });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on port ${PORT}`));
