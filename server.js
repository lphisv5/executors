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
  
  // ทำความสะอาดเบื้องต้น
  version = version.replace(/\s+/g, ' ').trim();
  
  // กรณีที่เป็น hash version ที่อาจขึ้นต้นด้วย "ersion" (ผิดพลาดจากต้นทาง)
  if (version.toLowerCase().includes('ersion')) {
    // แก้ไขให้ถูกต้อง: เปลี่ยน e เป็น v
    version = version.replace(/^[eE]/, 'v');
  }
  
  // ลบคำนำหน้าที่ไม่จำเป็น
  version = version
    .replace(/version:/i, '')
    .replace(/v:/i, '')
    .replace(/^v\s*/i, '')
    .trim();
  
  // Pattern สำหรับเวอร์ชัน hash (เช่น version-5b077c09380f4fe6)
  const hashMatch = version.match(/(?:version-|ersion-)?([a-f0-9]{12,})/i);
  if (hashMatch) {
    return `version-${hashMatch[1]}`;
  }
  
  // Pattern สำหรับเวอร์ชันเลข (เช่น 2.702.632, 2.702.622)
  const numMatch = version.match(/(\d+\.\d+\.\d{3,4})/);
  if (numMatch) {
    let versionStr = numMatch[1];
    
    // ถ้ามี 4 หลักท้าย ให้ตัดเหลือ 3 หลัก
    const parts = versionStr.split('.');
    if (parts[2].length > 3) {
      parts[2] = parts[2].substring(0, 3);
      versionStr = parts.join('.');
    }
    
    return versionStr;
  }
  
  // ถ้าไม่ match pattern ใดเลย
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
