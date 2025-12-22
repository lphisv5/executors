const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = 'https://executors.samrat.lol';

const deepText = (element, selector) => {
  const found = element.find(selector);
  return found.length ? found.text().replace(/\s+/g, ' ').trim() : "N/A";
};

const cleanVersion = (version) => {
  const match = version.match(/(\d+\.\d+\.\d+)/);
  if (match) return match[0];
  const altMatch = version.match(/version-(\d{1,3}\.\d{1,3}\.\d{1,3})/);
  if (altMatch) return altMatch[1];
  return version;
};

const isOnline = (element) => {
  const statusText = deepText(element, '.detail-item:contains("Status") .status');
  return statusText.toLowerCase().includes("online");
};

const parseDownloads = (text) => {
  if (!text || text === "N/A") return 0;
  text = text.replace(/\+/g, '').toUpperCase();
  let num = 0;
  if (text.endsWith("K")) num = parseFloat(text) * 1000;
  else if (text.endsWith("M")) num = parseFloat(text) * 1000000;
  else num = parseFloat(text);
  return isNaN(num) ? 0 : num;
};

app.get('/executors', async (req, res) => {
  try {
    const response = await axios.get(TARGET_URL);
    const $ = cheerio.load(response.data);

    const executors = [];

    $('.executor-card').each((i, el) => {
      const card = $(el);
      if (!isOnline(card)) return;

      const name = deepText(card, '.executor-info h3');
      const versionRaw = deepText(card, '.detail-item:contains("Version") .detail-value');
      const version = cleanVersion(versionRaw);
      const downloadLink = card.find('.card-actions a[href]').first().attr('href') || null;

      const downloadsText = deepText(card, '.detail-item:contains("Downloads") .detail-value');
      const downloads = parseDownloads(downloadsText);

      executors.push({ name, version, status: "Online", downloadLink, downloads });
    });

    executors.sort((a, b) => b.downloads - a.downloads);
    executors.forEach(e => delete e.downloads);

    res.json({ success: true, executors });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch or parse site", error: err.message });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on port ${PORT}`));
