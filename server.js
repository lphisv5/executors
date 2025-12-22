const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = 'https://executors.samrat.lol';

// ดึงข้อความลึกจาก selector
const getText = (el, selector) => {
  const found = el.find(selector);
  return found.length ? found.text().replace(/\s+/g, ' ').trim() : null;
};

// ตรวจสถานะ Online / Offline
const parseStatus = (el) => {
  const status = getText(el, '.detail-item:contains("Status") .status');
  return status ? status.replace(/\s+/g, '') : 'Offline';
};

// ตรวจ VNG Status
const parseVngStatus = (el) => {
  const status = getText(el, '.detail-item:contains("VNG Status") .status');
  return status ? status.replace(/\s+/g, '') : null;
};

// ดึง version เต็มจาก text (รวมทั้ง Android + VNG)
const parseVersion = (text) => {
  return text ? text.replace(/\s+/g, '') : null;
};

// หาลิงก์หลัก
const parseDownloadLink = (el, idx = 0) =>
  el.find('.card-actions a[href]').eq(idx).attr('href') || null;

// หา VNG link ทั้งหมด
const parseAllVngLinks = (el) => {
  return el
    .find('.card-actions a[href]')
    .toArray()
    .map((a) => cheerio(a).attr('href'))
    .filter((l, i) => i > 0); // skip index 0 (main download)
};

// ตัดเฉพาะ version number pattern
const extractVerNumber = (ver) => {
  if (!ver) return null;
  const match = ver.match(/(\d+\.\d+\.\d+)/g);
  return match ? match.join('.') : ver;
};

app.get('/executors', async (req, res) => {
  try {
    const { data } = await axios.get(TARGET_URL);
    const $ = cheerio.load(data);

    const online = [];
    const offline = [];

    $('.executor-card').each((_, el) => {
      const card = $(el);

      const name = getText(card, '.executor-info h3') || 'Unknown';
      const status = parseStatus(card);

      const mainDownload = parseDownloadLink(card, 0);

      // version หลัก + vngVersion
      const rawVersion = getText(card, '.detail-item:contains("Version") .detail-value');
      const rawVngVersion = getText(card, '.detail-item:contains("VNG Version") .detail-value');

      let version = rawVersion ? parseVersion(rawVersion) : null;
      let vngVersion = rawVngVersion ? parseVersion(rawVngVersion) : null;

      // หา VNG Links
      const vngLinks = parseAllVngLinks(card);

      // ถ้ามี VNG versions & links เยอะให้จับคู่ให้ใกล้เคียงก่อน
      let bestVngLink = null;
      if (vngLinks.length) {
        // ถ้ามี vngVersion
        if (vngVersion) {
          const matched = vngLinks.find((l) =>
            l.toLowerCase().includes(vngVersion.toLowerCase())
          );
          bestVngLink = matched || vngLinks[0]; // ถ้าไม่มีตรง version เอา fallback ตัวแรก
        } else {
          // ไม่มี vngVersion เลย → fallback ตัวแรก
          bestVngLink = vngLinks[0];
        }
      }

      const executorData = {
        name,
        version: extractVerNumber(version) || version,
        status,
        downloadLink: mainDownload,
      };

      // ถ้าเป็น Android และมี VNG link ให้ใส่
      if (mainDownload && mainDownload.toLowerCase().includes('android') && bestVngLink) {
        executorData.vngDownloadLink = bestVngLink;
        if (vngVersion) executorData.vngVersion = extractVerNumber(vngVersion) || vngVersion;
        const vngStatus = parseVngStatus(card);
        if (vngStatus) executorData.vngStatus = vngStatus;
      }

      if (status.toLowerCase() === 'online') online.push(executorData);
      else offline.push(executorData);
    });

    res.json({ success: true, online, offline });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch or parse site',
      error: err.message,
    });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on ${PORT}`));
