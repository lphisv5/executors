const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = 'https://executors.samrat.lol';

// clean version ให้เป็น x.x.x
const cleanVersion = (version) => {
  if (!version) return null;
  const match = version.match(/\d+\.\d+\.\d+/);
  return match ? match[0] : version;
};

// ตรวจสอบ Android
const isAndroid = (link) => link && link.toLowerCase().includes('android');

// ตรวจสอบ status Online/Offline
const getStatus = (card) => {
  const statusText = card.find('.detail-item:contains("Status") .status').text();
  return statusText && statusText.toLowerCase().includes('online') ? 'Online' : 'Offline';
};

// ดึงข้อความ
const getText = (card, selector) => {
  const el = card.find(selector);
  return el.length ? el.text().replace(/\s+/g, ' ').trim() : null;
};

// ดึงลิงก์ VNG Android ล่าสุด (fallback)
const getVNG = (card) => {
  const vngCards = card.find('.vng a[href]');
  if (!vngCards.length) return null;

  let selectedLink = null;
  let selectedVersion = null;

  vngCards.each((i, el) => {
    const link = cheerio(el).attr('href');
    const versionRaw = getText(card, '.vng .version');
    const version = cleanVersion(versionRaw);

    // ถ้าไม่มี version เลือกลิงก์ล่าสุดเป็น fallback
    if (!selectedVersion || (version && version > selectedVersion)) {
      selectedVersion = version;
      selectedLink = link;
    }
  });

  if (!selectedLink) return null;
  return {
    vngVersion: selectedVersion,
    vngDownloadLink: selectedLink,
    vngStatus: getStatus(card)
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

      const name = getText(card, '.executor-info h3');
      const versionRaw = getText(card, '.detail-item:contains("Version") .detail-value');
      const version = cleanVersion(versionRaw);
      const downloadLink = card.find('.card-actions a[href]').first().attr('href');
      const status = getStatus(card);

      const executor = { name, version, status, downloadLink };

      if (isAndroid(downloadLink)) {
        const vng = getVNG(card);
        if (vng) Object.assign(executor, vng);
      }

      status === 'Online' ? online.push(executor) : offline.push(executor);
    });

    res.json({ success: true, online, offline });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch or parse site', error: err.message });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on port ${PORT}`));
