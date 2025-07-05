const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Statische Dateien bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// API-Endpunkt zum Extrahieren von Daten
app.get('/api/extract', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || !url.includes('kleinanzeigen.de')) {
      return res.status(400).json({ error: 'Ungültige URL' });
    }
    
    // Anfrage an Kleinanzeigen senden
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // HTML parsen
    const $ = cheerio.load(response.data);
    
    // Daten extrahieren
    const title = $('h1#viewad-title').text().trim();
    const description = $('#viewad-description-text').text().trim();
    
    // Bilder extrahieren
    const images = [];
    $('.galleryimage-element img').each((i, el) => {
      const src = $(el).attr('src');
      if (src) images.push(src);
    });
    
    return res.json({ title, description, images });
  } catch (error) {
    console.error('Fehler beim Extrahieren der Daten:', error);
    return res.status(500).json({ error: 'Fehler beim Abrufen der Daten' });
  }
});

// Alle anderen Anfragen zur index.html weiterleiten (für SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});