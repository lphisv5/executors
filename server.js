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
  
  // ลบช่องว่างและคำที่ไม่จำเป็น
  version = version.replace(/\s+/g, '')
                   .replace(/version:/i, '')
                   .replace(/v:/i, '')
                   .replace(/^v/, '');
  
  // แก้ปัญหา 4 หลักท้าย → 3 หลัก
  const fixFourDigits = (ver) => {
    // Pattern: ตัวเลข.ตัวเลข.ตัวเลข 4 หลัก
    const match = ver.match(/(\d+\.\d+\.\d{3})\d/);
    return match ? match[1] : ver;
  };
  
  // ลอง format ต่างๆ
  const patterns = [
    /(\d+\.\d+\.\d{3})\d/,      // 2.701.9662 → 2.701.966
    /(\d+\.\d+\.\d{3})/,        // 2.701.966
    /version-([a-f0-9]{12,})/i, // hash version
    /(\d+\.\d+\.\d+)/           // อื่นๆ
  ];
  
  for (const pattern of patterns) {
    const match = version.match(pattern);
    if (match) {
      if (pattern.toString().includes('version-')) {
        return `version-${match[1]}`;
      }
      return match[1] || match[0];
    }
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
      const version = cleanVersion(versionRaw);
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
