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
  
  const hashMatch = version.match(/(?:version-|ersion-)?([a-f0-9]{12,})/i);
  if (hashMatch) return `version-${hashMatch[1]}`;
  
  const numMatch = version.match(/(\d+\.\d+\.\d{3,4})/);
  if (numMatch) return numMatch[1];
  
  return version;
};

const isOnline = (element) => {
  const statusText = deepText(element, '.detail-item:contains("Status") .status');
  return statusText.toLowerCase().includes("online");
};

// ✅ มีแค่ endpoint เดียวเท่านั้น
app.get('/executors', async (req, res) => {
  try {
    const response = await axios.get(TARGET_URL);
    const $ = cheerio.load(response.data);
    const executors = [];

    $('.executor-card').each((i, el) => {
      const card = $(el);
      if (!isOnline(card)) return;

      executors.push({ 
        name: deepText(card, '.executor-info h3'),
        version: cleanVersion(deepText(card, '.detail-item:contains("Version") .detail-value')),
        status: "Online", 
        downloadLink: card.find('.card-actions a[href]').first().attr('href') || null
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
