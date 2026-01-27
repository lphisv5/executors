const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = 'https://executors.samrat.lol';

const deepText = (element, selector) => {
  const found = element.find(selector);
  return found.length
    ? found.text().replace(/\s+/g, ' ').trim()
    : "N/A";
};

const cleanVersion = (version) => {
  if (!version || version === "N/A") return "N/A";

  version = version
    .replace(/version:/i, '')
    .replace(/v:/i, '')
    .replace(/^v\s*/i, '')
    .trim();

  const hashMatch = version.match(/([a-f0-9]{12,})/i);
  if (hashMatch) return `version-${hashMatch[1]}`;

  const numMatch = version.match(/(\d+\.\d+\.\d{3,4})/);
  if (numMatch) return numMatch[1];

  return version;
};

const isOnline = (card) => {
  const statusText = deepText(card, '.detail-item:contains("Status") .status');
  return statusText.toLowerCase().includes('online');
};

const detectPlatformBySection = (card) =>
  card.closest('.platform-section').attr('id');


app.get('/executors', async (req, res) => {
  try {
    const response = await axios.get(TARGET_URL);
    const $ = cheerio.load(response.data);

    const result = {
      Android: [],
      iOS: [],
      Windows: [],
      macOS: [],
      External: []
    };

    let online = 0;

    $('.executor-card').each((i, el) => {
      const card = $(el);
      if (!isOnline(card)) return;

      online++;

      const name = deepText(card, '.executor-info h3');
      const versionRaw = deepText(
        card,
        '.detail-item:contains("Version") .detail-value'
      );
      const version = cleanVersion(versionRaw);
      const downloadLink =
        card.find('.card-actions a[href]').first().attr('href') || null;

      const platformId = detectPlatformBySection(card);

      const data = {
        name,
        version,
        status: "Online",
        downloadLink
      };

      if (platformId === 'android') result.Android.push(data);
      if (platformId === 'ios') result.iOS.push(data);
      if (platformId === 'windows') result.Windows.push(data);
      if (platformId === 'macos') result.macOS.push(data);
      if (platformId === 'external') result.External.push(data);
    });

    res.json({
      online,
      Android: result.Android,
      iOS: result.iOS,
      Windows: result.Windows,
      macOS: result.macOS,
      External: result.External
    });

  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch or parse site",
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Executor Parser API running on port ${PORT}`);
});
