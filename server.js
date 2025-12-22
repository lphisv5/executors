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

// ตัดเวอร์ชั่นให้เหลือ 9 หลัก รวมจุด เช่น 2.701.966
const cleanVersion = (version) => {
  const match = version.match(/(\d+\.\d+\.\d+)/);
  return match ? match[0] : version;
};

// ตรวจสถานะ Online/Offline
const isOnline = (element) => {
  const statusText = deepText(element, '.detail-item:contains("Status") .status');
  return statusText.toLowerCase().includes("online");
};

// ตรวจ Platform
const detectPlatform = (url, name) => {
  const lowerUrl = (url || "").toLowerCase();
  const lowerName = (name || "").toLowerCase();
  if (lowerUrl.endsWith(".apk") || lowerName.includes("android") || lowerUrl.includes("android")) return "Android";
  if (lowerUrl.endsWith(".ipa") || lowerName.includes("ios") || lowerUrl.includes("ios")) return "iOS";
  if (lowerUrl.endsWith(".exe") || lowerUrl.endsWith(".msi") || lowerName.includes("windows") || lowerUrl.includes("windows")) return "Windows";
  if (lowerUrl.endsWith(".dmg") || lowerName.includes("mac") || lowerUrl.includes("macos") || lowerUrl.includes("mac")) return "MacOS";
  return "Unknown";
};

// ดาวน์โหลดตัวเลข
const parseDownloads = (text) => {
  if (!text || text === "N/A") return 0;
  text = text.replace(/\+/g, '').toUpperCase();
  let num = 0;
  if (text.endsWith("K")) num = parseFloat(text) * 1000;
  else if (text.endsWith("M")) num = parseFloat(text) * 1000000;
  else num = parseFloat(text);
  return isNaN(num) ? 0 : num;
};

// ดึงเวอร์ชั่นและ VNG เฉพาะ Android
const getVersionsAndVNG = (element, platform) => {
  const version = cleanVersion(deepText(element, '.detail-item:contains("Version") .detail-value'));
  if (platform === "Android") {
    const vngVersionRaw = deepText(element, '.detail-item:contains("VNG Version") .detail-value');
    const vngVersion = vngVersionRaw !== "N/A" ? cleanVersion(vngVersionRaw) : "N/A";
    const vngDownloadLink = element.find('.card-actions a[href]').eq(1).attr('href') || null;
    const vngStatusText = deepText(element, '.detail-item:contains("VNG Status") .status');
    const vngStatus = vngStatusText ? vngStatusText.replace(/\s+/g, '') : "Offline";
    return { version, vngVersion, vngDownloadLink, vngStatus };
  }
  return { version, vngVersion: undefined, vngDownloadLink: undefined, vngStatus: undefined };
};

app.get('/executors', async (req, res) => {
  try {
    const response = await axios.get(TARGET_URL);
    const $ = cheerio.load(response.data);

    const online = [];
    const offline = [];

    $('.executor-card').each((i, el) => {
      const card = $(el);
      const name = deepText(card, '.executor-info h3');
      const downloadLink = card.find('.card-actions a[href]').first().attr('href') || null;
      const platform = detectPlatform(downloadLink, name);

      const { version, vngVersion, vngDownloadLink, vngStatus } = getVersionsAndVNG(card, platform);

      const statusText = deepText(card, '.detail-item:contains("Status") .status').replace(/\s+/g, '');
      const status = statusText ? statusText : "Offline";

      const executor = {
        name,
        version,
        status,
        downloadLink
      };

      if (platform === "Android" && vngVersion !== undefined) {
        executor.vngVersion = vngVersion;
        executor.vngDownloadLink = vngDownloadLink;
        executor.vngStatus = vngStatus;
      }

      if (isOnline(card)) online.push(executor);
      else offline.push(executor);
    });

    res.json({ success: true, online, offline });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch or parse site", error: err.message });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on port ${PORT}`));
