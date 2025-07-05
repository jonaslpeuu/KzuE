# Kleinanzeigen to eBay

Dieses Tool extrahiert Informationen aus Kleinanzeigen-Anzeigen und bereitet sie für die Verwendung auf eBay vor. Die Anwendung verwendet einen Backend-Server, um CORS-Beschränkungen zu umgehen und echte Daten von Kleinanzeigen zu extrahieren.

## Funktionen

- Extraktion von Titel, Beschreibung und Bildern aus echten Kleinanzeigen-Links
- Einfaches Kopieren der extrahierten Daten in die Zwischenablage
- Benutzerfreundliche Oberfläche
- Demo-Modus mit verschiedenen Beispieldaten basierend auf Stichwörtern

## Installation und Verwendung

### Installation

Diese Anwendung benötigt einen Node.js-Server, um CORS-Beschränkungen zu umgehen und echte Daten von Kleinanzeigen zu extrahieren.

1. Stelle sicher, dass Node.js und npm auf deinem System installiert sind
2. Klone oder lade dieses Repository herunter
3. Führe `npm install` aus, um die Abhängigkeiten zu installieren
4. Starte den Server mit `npm start`
5. Die Anwendung ist nun unter http://localhost:3000 verfügbar

### Deployment auf Render.com

Die Anwendung kann einfach auf Render.com deployt werden:

1. Erstelle ein Konto auf [Render.com](https://render.com)
2. Erstelle einen neuen Web Service und verbinde ihn mit deinem Repository
3. Wähle Node.js als Umgebung
4. Setze den Build-Befehl auf `npm install`
5. Setze den Start-Befehl auf `node server.js`
6. Klicke auf "Create Web Service"

### Verwendung

1. Öffne die Anwendung in deinem Browser (lokal oder auf Render.com)
2. Du hast zwei Möglichkeiten:
   - Gib eine echte Kleinanzeigen-URL ein, um echte Daten zu extrahieren
   - Oder verwende einen der folgenden Begriffe für Demo-Daten:
     - `demo` für allgemeine Demo-Daten (Mountainbike)
     - `iphone` oder `smartphone` für Smartphone-bezogene Demo-Daten
     - `sofa` oder `möbel` für Möbel-bezogene Demo-Daten
3. Klicke auf "Daten extrahieren"
4. Die extrahierten Daten (Titel, Beschreibung und Bilder) werden angezeigt
5. Nutze die Kopier-Buttons, um die Daten in die Zwischenablage zu kopieren

## Technische Details

Diese Anwendung verwendet:
- HTML5 für die Struktur
- CSS3 für das Styling
- Vanilla JavaScript für die Frontend-Funktionalität
- Node.js mit Express für den Backend-Server
- Axios für HTTP-Anfragen
- Cheerio für HTML-Parsing

## Wie es funktioniert

### Echte Daten-Extraktion
1. Der Benutzer gibt eine Kleinanzeigen-URL in das Eingabefeld ein
2. Die Frontend-Anwendung sendet eine Anfrage an den Backend-Server
3. Der Backend-Server:
   - Sendet eine Anfrage an Kleinanzeigen
   - Extrahiert die relevanten Daten (Titel, Beschreibung, Bilder) aus der HTML-Antwort
   - Sendet die extrahierten Daten zurück an das Frontend
4. Die extrahierten Daten werden in der Benutzeroberfläche angezeigt
5. Der Benutzer kann die Daten mit den Kopier-Buttons in die Zwischenablage kopieren

### Demo-Modus
1. Der Benutzer gibt ein Stichwort (demo, iphone, sofa) in das Eingabefeld ein
2. Die Anwendung erkennt das Stichwort und zeigt entsprechende Demo-Daten an
3. Die Demo-Daten werden in der Benutzeroberfläche angezeigt
4. Der Benutzer kann die Daten mit den Kopier-Buttons in die Zwischenablage kopieren

## Technische Implementierung

Diese Anwendung verwendet einen Backend-Server, um CORS-Beschränkungen zu umgehen. Der Server fungiert als Proxy, der Anfragen an Kleinanzeigen weiterleitet und die Daten extrahiert, bevor sie an das Frontend zurückgegeben werden.

### Warum ein Backend-Server?

Browser blockieren aus Sicherheitsgründen Cross-Origin-Anfragen (CORS-Beschränkungen), was bedeutet, dass JavaScript im Browser keine direkten Anfragen an Kleinanzeigen stellen kann. Unser Backend-Server umgeht diese Beschränkung, indem er:

1. Anfragen vom Frontend entgegennimmt
2. Diese Anfragen an Kleinanzeigen weiterleitet
3. Die HTML-Antwort analysiert und relevante Daten extrahiert
4. Die extrahierten Daten in einem strukturierten Format (JSON) zurückgibt

## Hinweise

- Diese Anwendung ist für persönliche Nutzung gedacht
- Beachte die Nutzungsbedingungen von Kleinanzeigen bei der Verwendung
- Die Struktur der Kleinanzeigen-Website kann sich ändern, was zu Anpassungsbedarf führen kann
- Der Server sollte nicht für kommerzielle Zwecke oder mit hohem Anfragevolumen verwendet werden
- Für eine produktive Nutzung sollten zusätzliche Sicherheitsmaßnahmen implementiert werden