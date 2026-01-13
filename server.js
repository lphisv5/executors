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

const cleanVersion = (version) => {
  if (!version || version === "N/A") return "N/A";
  
  version = version.replace(/\s+/g, ' ').trim();
  
  if (version.toLowerCase().includes('ersion')) {
    version = version.replace(/^[eE]/, 'v');
  }
  
  version = version
    .replace(/version:/i, '')
    .replace(/v:/i, '')
    .replace(/^v\s*/i, '')
    .trim();
  
  // Hash version
  const hashMatch = version.match(/(?:version-|ersion-)?([a-f0-9]{12,})/i);
  if (hashMatch) return `version-${hashMatch[1]}`;
  
  // Numeric version - แก้ไขเฉพาะ pattern ที่ผิดปกติ
  const numMatch = version.match(/(\d+\.\d+\.\d{3,4})/);
  if (numMatch) {
    let versionStr = numMatch[1];
    const parts = versionStr.split('.');
    const lastPart = parts[2];
    
    // ✅ แก้ไขเฉพาะกรณีที่มี 4 หลักท้ายและดูผิดปกติ
    if (lastPart.length === 4) {
      // ถ้า 2 หลักท้ายซ้ำกัน (เช่น 22, 33, 44)
      if (lastPart[2] === lastPart[3]) {
        parts[2] = lastPart.substring(0, 3);
        versionStr = parts.join('.');
      }
      // ถ้าเป็นเลขเดียวกันทั้ง 4 ตัว
      else if (lastPart === lastPart[0].repeat(4)) {
        parts[2] = lastPart.substring(0, 3);
        versionStr = parts.join('.');
      }
    }
    
    return versionStr;
  }
  
  return version;
};

const isOnline = (element) => {
  const statusText = deepText(element, '.detail-item:contains("Status") .status');
  return statusText.toLowerCase().includes("online");
};

app.get('/executors', async (req, res) => {
  try {
    const response = await axios.get(TARGET_URL);
    const $ = cheerio.load(response.data);

    const executors = [];

    $('.executor-card').each((i, el) => {
      const card = $(el);

      if (!isOnline(card)) return;

      const name = deepText(card, '.executor-info h3');
      const versionRaw = deepText(card, '.detail-item:contains("Version") .detail-value');
      const version = cleanVersion(versionRaw); // ✅ ใช้ cleanVersion เดิม
      const downloadLink = card.find('.card-actions a[href]').first().attr('href') || null;

      executors.push({ 
        name, 
        version, 
        status: "Online", 
        downloadLink 
      });
    });

    res.json({ 
      success: true,
      timestamp: new Date().toISOString(),
      count: executors.length,
      executor: executors
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch or parse site", 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(PORT, () => console.log(`Executor Parser API running on port ${PORT}`));
