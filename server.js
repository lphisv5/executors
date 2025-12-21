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

const detectPlatform = (url, name) => {
  if (!url) return "Unknown";
  const lowerUrl = url.toLowerCase();
  const lowerName = name.toLowerCase();

  if (lowerUrl.endsWith(".apk") || lowerName.includes("android") || lowerUrl.includes("android")) return "Android";
  if (lowerUrl.endsWith(".ipa") || lowerName.includes("ios") || lowerUrl.includes("ios")) return "iOS";
  if (lowerUrl.endsWith(".exe") || lowerUrl.endsWith(".msi") || lowerName.includes("windows") || lowerUrl.includes("windows")) return "Windows";
  if (lowerUrl.endsWith(".dmg") || lowerName.includes("mac") || lowerUrl.includes("macos") || lowerUrl.includes("mac")) return "MacOS";

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

const parseDownloads = (text) => {
  if (!text || text === "N/A") return 0;
  text = text.replace(/\+/g, '').toUpperCase();
  let num = 0;
  if (text.endsWith("K")) num = parseFloat(text) * 1000;
  else if (text.endsWith("M")) num = parseFloat(text) * 1000000;
  else num = parseFloat(text);
  return isNaN(num) ? 0 : num;
};

app.get('/parse-executors', async (req, res) => {
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

      const downloadsText = deepText(card, '.detail-item:contains("Downloads") .detail-value');
      const downloads = parseDownloads(downloadsText);

      const executorData = { name, version, status: "Online", downloadLink, downloads };

      categories[platform] = categories[platform] || [];
      categories[platform].push(executorData);
    });

    for (const key in categories) {
      categories[key].sort((a, b) => b.downloads - a.downloads);
      categories[key] = categories[key].map(({ downloads, ...rest }) => rest);
    }

    res.json({ success: true, categories });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch or parse site", error: err.message });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on port ${PORT}`));
