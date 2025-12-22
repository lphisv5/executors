const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = 'https://executors.samrat.lol';

// ฟังก์ชันดึงข้อความ
const getText = (el, selector) => {
  const found = el.find(selector);
  return found.length ? found.text().trim() : null;
};

// ฟังก์ชันดึงลิงก์
const getLink = (el, idx = 0) => {
  const a = el.find('.card-actions a[href]').eq(idx);
  return a.length ? a.attr('href') : null;
};

// ตรวจสถานะ
const parseStatus = (el, label) => {
  const text = getText(el, `.detail-item:contains("${label}") .status`);
  return text ? text.replace(/\s+/g, '') : null;
};

app.get('/executors', async (req, res) => {
  try {
    // โหลด HTML จากเว็บ
    const { data } = await axios.get(TARGET_URL);
    const $ = cheerio.load(data);

    const online = [];
    const offline = [];

    $('.executor-card').each((_, cardEl) => {
      const card = $(cardEl);

      // ชื่อ executor
      const name = getText(card, '.executor-info h3') || '';

      // สถานะ Online / Offline
      const status = parseStatus(card, 'Status') || 'Offline';

      // ดึง version เต็มของทั้ง Android และ VNG ถ้ามี
      const versionMain = getText(card, '.detail-item:contains("Version") .detail-value');
      const versionVNG = getText(card, '.detail-item:contains("VNG Version") .detail-value');

      // ลิงก์หลัก และลิงก์ VNG fallback
      const downloadLink = getLink(card, 0);

      // หา VNG links ทุกตัวจากปุ่มต่าง ๆ
      const allLinks = card.find('.card-actions a[href]').toArray().map(a => $(a).attr('href'));
      let vngDownloadLink = null;

      if (allLinks.length > 1) {
        // btn ที่สองมักเป็น VNG
        vngDownloadLink = allLinks[1] || null;
      }

      // รวม version แบบ x.y.z…x.y.z
      let version = versionMain;
      if (versionVNG) {
        version = `${versionMain}${versionVNG}`;
      }

      // ผลลัพธ์ object
      const executorData = {
        name,
        version,
        status,
        downloadLink
      };

      // เพิ่ม VNG info ก็ต่อเมื่อมีจริง ๆ
      if (vngDownloadLink && versionVNG) {
        executorData.vngVersion = versionVNG;
        executorData.vngDownloadLink = vngDownloadLink;
        const vngStatus = parseStatus(card, 'VNG Status');
        if (vngStatus) executorData.vngStatus = vngStatus;
      }

      // แยก Online / Offline ตามสถานะจริง
      if (status.toLowerCase() === 'online') online.push(executorData);
      else offline.push(executorData);
    });

    res.json({ success: true, online, offline });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch or parse site',
      error: err.message
    });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on port ${PORT}`));
