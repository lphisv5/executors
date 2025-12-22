const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = 'https://executors.samrat.lol';

// ฟังก์ชันดึงข้อความลึกจาก element
const deepText = (element, selector) => {
  const found = element.find(selector);
  return found.length ? found.text().replace(/\s+/g, ' ').trim() : null;
};

// ฟังก์ชันตรวจสอบสถานะ Online
const isOnline = (element) => {
  const statusText = deepText(element, '.detail-item:contains("Status") .status');
  if (!statusText) return false;
  return statusText.toLowerCase().includes('online');
};

// ฟังก์ชันแยก version Android
const cleanVersion = (version) => {
  if (!version) return null;
  const match = version.match(/\d+\.\d+\.\d+/);
  return match ? match[0] : version;
};

// ฟังก์ชันตรวจสอบว่าเป็น Android
const isAndroid = (link) => link && link.toLowerCase().includes('android');

// ฟังก์ชันตรวจสอบ VNG สำหรับ Android
const extractVNG = (card) => {
  const vngLink = card.find('.vng a[href]').first().attr('href');
  const vngVersionRaw = deepText(card, '.vng .version');
  if (!vngLink) return null;
  return {
    vngVersion: vngVersionRaw,
    vngDownloadLink: vngLink,
    vngStatus: isOnline(card) ? 'Online' : 'Offline'
  };
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
      const versionRaw = deepText(card, '.detail-item:contains("Version") .detail-value');
      const version = cleanVersion(versionRaw);
      const downloadLink = card.find('.card-actions a[href]').first().attr('href');
      const status = isOnline(card) ? 'Online' : 'Offline';

      const executor = { name, version, status, downloadLink };

      // สำหรับ Android เพิ่ม VNG ถ้ามี
      if (isAndroid(downloadLink)) {
        const vng = extractVNG(card);
        if (vng) Object.assign(executor, vng);
      }

      if (status === 'Online') online.push(executor);
      else offline.push(executor);
    });

    res.json({ success: true, online, offline });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch or parse site', error: err.message });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on port ${PORT}`));
