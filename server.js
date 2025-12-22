const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = 'https://executors.samrat.lol';

// ดึงข้อความภายใน element
const deepText = (element, selector) => {
  const found = element.find(selector);
  return found.length ? found.text().replace(/\s+/g, ' ').trim() : "N/A";
};

// แปลง version ให้เหลือเฉพาะหลัก 3 หลัก เช่น 2.701.966
const cleanVersion = (version) => {
  if (!version) return "N/A";
  if (version.startsWith("version-")) return version;
  const match = version.match(/(\d+\.\d+\.\d+)/);
  return match ? match[0] : version;
};

// ดึงสถานะ Online/Offline
const getStatuses = (element) => {
  const status = deepText(element, '.detail-item:contains("Status") .status') || "Offline";
  const vngStatus = deepText(element, '.detail-item:contains("VNG Status") .status') || "Offline";
  return {
    status: status.replace(/\s+/g, ""),
    vngStatus: vngStatus.replace(/\s+/g, "")
  };
};

// ดึงเวอร์ชันหลัก + VNG Version
const getVersions = (element) => {
  const version = cleanVersion(deepText(element, '.detail-item:contains("Version") .detail-value'));
  const vngVersion = cleanVersion(deepText(element, '.detail-item:contains("VNG Version") .detail-value'));
  return { version, vngVersion: vngVersion || "N/A" };
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
      const { version, vngVersion } = getVersions(card);
      const { status, vngStatus } = getStatuses(card);

      const downloadLink = card.find('.card-actions a[href]').first().attr('href') || null;
      const vngDownloadLink = card.find('.card-actions a[href]').eq(1).attr('href') || null;

      const executorData = {
        name,
        version,
        vngVersion,
        status: status + vngStatus.includes("Online") ? "Online" : "",
        vngStatus,
        downloadLink,
        vngDownloadLink
      };

      if (status.toLowerCase().includes("online")) online.push(executorData);
      else offline.push(executorData);
    });

    res.json({ success: true, online, offline });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch or parse site", error: err.message });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on port ${PORT}`));
