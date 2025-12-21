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

const detectPlatform = (url) => {
  if (!url) return "Unknown";
  url = url.toLowerCase();
  if (url.endsWith(".apk") || url.includes("android")) return "Android";
  if (url.endsWith(".ipa") || url.includes("ios")) return "iOS";
  if (url.endsWith(".exe") || url.includes("windows")) return "Windows";
  if (url.endsWith(".dmg") || url.includes("macos") || url.includes("mac")) return "MacOS";
  return "Unknown";
};

const cleanVersion = (version) => {
  const match = version.match(/(\d+\.\d+\.\d+)/);
  return match ? match[0] : version;
};

const isOnline = (element) => {
  const statusText = deepText(element, '.detail-item:contains("Status") .status');
  return statusText.toLowerCase().includes("online");
};

app.get('/executors', async (req, res) => {
  try {
    const response = await axios.get(TARGET_URL);
    const $ = cheerio.load(response.data);

    const categories = { Android: [], iOS: [], Windows: [], MacOS: [], Unknown: [] };

    $('.executor-card').each((i, el) => {
      const card = $(el);

      if (!isOnline(card)) return;

      const name = deepText(card, '.executor-info h3');
      const versionRaw = deepText(card, '.detail-item:contains("Version") .detail-value');
      const version = cleanVersion(versionRaw);

      const downloadLink = card.find('.card-actions a[href]').first().attr('href') || null;
      const platform = detectPlatform(downloadLink);

      const executorData = { name, version, status: "Online", downloadLink };

      categories[platform] = categories[platform] || [];
      categories[platform].push(executorData);
    });

    res.json({ success: true, categories });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch or parse site", error: err.message });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on port ${PORT}`));
