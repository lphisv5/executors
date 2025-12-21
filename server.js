const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

const TARGET_URL = 'https://executors.samrat.lol';

const safeText = (element, selector) => {
  const found = element.find(selector);
  return found.length ? found.text().trim() : "N/A";
};

app.get('/parse-executors', async (req, res) => {
  try {
    const response = await axios.get(TARGET_URL);
    const $ = cheerio.load(response.data);

    const executors = [];

    $('.executor-card').each((i, el) => {
      const card = $(el);
      const statusText = safeText(card, '.detail-item:contains("Status") .status');

      executors.push({
        name: safeText(card, '.executor-info h3'),
        version: safeText(card, '.detail-item:contains("Version") .detail-value'),
        status: statusText
      });
    });

    // จัดเรียงให้ Online มาก่อน Offline
    executors.sort((a, b) => {
      const statusOrder = { "Online": 1, "Offline": 0 };
      const aStatus = a.status.includes("Online") ? 1 : 0;
      const bStatus = b.status.includes("Online") ? 1 : 0;
      return bStatus - aStatus;
    });

    res.json({ success: true, executors });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch or parse site", error: err.message });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on port ${PORT}`));
