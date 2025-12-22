const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = 'https://executors.samrat.lol';

// ดึงข้อความลึกจาก selector
const deepText = (element, selector) => {
  const found = element.find(selector);
  return found.length ? found.text().replace(/\s+/g, ' ').trim() : "N/A";
};

// ทำให้ Version เหลือเฉพาะ 3 ตัวหลัก
const cleanVersion = (version) => {
  const match = version.match(/(\d+\.\d+\.\d+)/);
  return match ? match[0] : version;
};

// ตรวจสอบ Online / Offline
const isOnline = (element, statusSelector = '.detail-item:contains("Status") .status') => {
  const statusText = deepText(element, statusSelector);
  return statusText.toLowerCase().includes("online") ? "Online" : "Offline";
};

// ตรวจสอบ Platform
const detectPlatform = (url, name) => {
  if (!url && !name) return "Unknown";
  const lowerUrl = (url || "").toLowerCase();
  const lowerName = (name || "").toLowerCase();

  if (lowerUrl.endsWith(".apk") || lowerName.includes("android") || lowerUrl.includes("android")) return "Android";
  if (lowerUrl.endsWith(".ipa") || lowerName.includes("ios") || lowerUrl.includes("ios")) return "iOS";
  if (lowerUrl.endsWith(".exe") || lowerUrl.endsWith(".msi") || lowerName.includes("windows") || lowerUrl.includes("windows")) return "Windows";
  if (lowerUrl.endsWith(".dmg") || lowerName.includes("mac") || lowerUrl.includes("macos") || lowerUrl.includes("mac")) return "MacOS";

  return "Unknown";
};

// ดึง Version + VNG
const getVersionsAndVNG = (element, platform) => {
  const version = cleanVersion(deepText(element, '.detail-item:contains("Version") .detail-value'));
  const result = { version };

  // Android มี VNG เพิ่มเติม
  if (platform === "Android") {
    const vngVersionRaw = deepText(element, '.detail-item:contains("VNG Version") .detail-value');
    const vngDownloadLink = element.find('.card-actions a[href]').eq(1).attr('href');
    const vngStatusText = deepText(element, '.detail-item:contains("VNG Status") .status').replace(/\s+/g, '');

    if (vngVersionRaw && vngVersionRaw !== "N/A") result.vngVersion = cleanVersion(vngVersionRaw);
    if (vngDownloadLink) result.vngDownloadLink = vngDownloadLink;
    if (vngStatusText) result.vngStatus = vngStatusText;
  }

  return result;
};

// API
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

      const status = isOnline(card);
      const versions = getVersionsAndVNG(card, platform);

      const executorData = {
        name,
        status: status,
        downloadLink,
        ...versions
      };

      if (status === "Online") online.push(executorData);
      else offline.push(executorData);
    });

    res.json({ success: true, online, offline });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch or parse site", error: err.message });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on port ${PORT}`));
