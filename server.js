const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { promisify } = require('util');

const app = express();
// CORS-Konfiguration für mehr Sicherheit
app.use(cors({
  origin: '*', // In Produktion sollte dies auf die tatsächliche Domain beschränkt werden
  methods: ['GET'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request-Größenbeschränkung und Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Statische Dateien bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Hilfsfunktion zur URL-Validierung
function isValidKleinanzeigenUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.includes('kleinanzeigen.de') && parsedUrl.protocol.startsWith('http');
  } catch (e) {
    return false;
  }
}

// Hilfsfunktion für HTTP-Anfragen mit Timeout und Retry-Mechanismus
async function fetchWithRetry(url, options = {}, maxRetries = 3, timeout = 10000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Timeout für die Anfrage setzen
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const mergedOptions = {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'de,en-US;q=0.7,en;q=0.3',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          ...options.headers
        },
        timeout: timeout,
        httpsAgent: new https.Agent({ 
          rejectUnauthorized: false, // Für den Fall, dass SSL-Zertifikate Probleme verursachen
          keepAlive: true
        })
      };
      
      const response = await axios(url, mergedOptions);
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error;
      console.warn(`Versuch ${attempt + 1}/${maxRetries} fehlgeschlagen: ${error.message}`);
      
      // Wenn es ein Abbruch durch Timeout war oder der letzte Versuch, nicht erneut versuchen
      if (error.name === 'AbortError' || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponentielles Backoff für Wiederholungsversuche
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  
  throw lastError;
}

// API-Endpunkt zum Extrahieren von Daten
app.get('/api/extract', async (req, res) => {
  try {
    const { url } = req.query;
    
    // URL-Validierung
    if (!url) {
      return res.status(400).json({ error: 'URL ist erforderlich' });
    }
    
    if (!isValidKleinanzeigenUrl(url)) {
      return res.status(400).json({ 
        error: 'Ungültige URL', 
        message: 'Bitte gib eine gültige Kleinanzeigen-URL ein (z.B. https://www.kleinanzeigen.de/...)'
      });
    }
    
    // Anfrage an Kleinanzeigen senden mit Retry-Mechanismus
    const response = await fetchWithRetry(url);
    
    // HTML parsen mit Fehlerbehandlung
    if (!response.data) {
      throw new Error('Keine Daten von Kleinanzeigen erhalten');
    }
    
    const $ = cheerio.load(response.data);
    
    // Daten extrahieren mit Fallback-Werten
    const title = $('h1#viewad-title').text().trim() || 'Titel nicht gefunden';
    const description = $('#viewad-description-text').text().trim() || 'Beschreibung nicht gefunden';
    
    // Bilder extrahieren mit verschiedenen Selektoren für bessere Kompatibilität
    const images = [];
    // Primärer Selektor
    $('.galleryimage-element img').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !images.includes(src)) images.push(src);
    });
    
    // Fallback-Selektoren, falls der primäre keine Ergebnisse liefert
    if (images.length === 0) {
      $('div.galleryimage-element img, div.ad-keyvalue + div img, #viewad-image img').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && !images.includes(src)) images.push(src);
      });
    }
    
    // Preis extrahieren (neue Funktion)
    const price = $('#viewad-price').text().trim() || 'Preis nicht angegeben';
    
    // Standort extrahieren (neue Funktion)
    const location = $('#viewad-locality').text().trim() || 'Standort nicht angegeben';
    
    return res.json({ 
      title, 
      description, 
      images,
      price,
      location,
      extractedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Fehler beim Extrahieren der Daten:', error);
    
    // Detaillierte Fehlermeldungen für bessere Diagnose
    let errorMessage = 'Fehler beim Abrufen der Daten';
    let statusCode = 500;
    
    if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
      errorMessage = 'Zeitüberschreitung bei der Anfrage. Bitte versuche es später erneut.';
      statusCode = 504; // Gateway Timeout
    } else if (error.response) {
      // Der Server hat mit einem Statuscode außerhalb des 2xx-Bereichs geantwortet
      statusCode = error.response.status;
      errorMessage = `Fehler ${statusCode}: ${error.response.statusText || 'Unbekannter Fehler'}`;
    } else if (error.request) {
      // Die Anfrage wurde gestellt, aber keine Antwort erhalten
      errorMessage = 'Keine Antwort vom Server erhalten. Bitte überprüfe deine Internetverbindung.';
      statusCode = 503; // Service Unavailable
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Alle anderen Anfragen zur index.html weiterleiten (für SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Globale Fehlerbehandlung für unbehandelte Ausnahmen
process.on('uncaughtException', (error) => {
  console.error('Unbehandelte Ausnahme:', error);
  // In einer Produktionsumgebung könnte hier ein Neustart des Servers oder eine Benachrichtigung erfolgen
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unbehandelte Promise-Ablehnung:', reason);
});

// Graceful Shutdown
function gracefulShutdown() {
  console.log('Beende Server...');
  server.close(() => {
    console.log('Server beendet');
    process.exit(0);
  });
  
  // Wenn der Server nicht innerhalb von 10 Sekunden beendet wird, erzwinge das Beenden
  setTimeout(() => {
    console.error('Konnte Server nicht ordnungsgemäß beenden, erzwinge Beendigung');
    process.exit(1);
  }, 10000);
}

// Shutdown-Handler für verschiedene Signale
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Server starten
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`Server-Zeit: ${new Date().toLocaleString()}`);
});

// Server-Timeout-Einstellungen
server.timeout = 60000; // 60 Sekunden Timeout für Anfragen