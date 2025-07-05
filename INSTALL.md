# Installationsanleitung für Kleinanzeigen to eBay

Diese Anleitung führt dich durch die Installation und Einrichtung des Kleinanzeigen to eBay Tools.

## Voraussetzungen

Für die lokale Entwicklung und Installation benötigst du:

- Node.js (Version 14 oder höher)
- npm (wird mit Node.js installiert)
- Einen modernen Webbrowser (Chrome, Firefox, Safari, Edge)

## Installationsschritte

### 1. Lokale Installation

1. Klone oder lade das Repository herunter
   ```
   git clone [repository-url]
   cd kleinanzeigen-to-ebay
   ```

2. Installiere die Abhängigkeiten
   ```
   npm install
   ```

3. Starte den Server
   ```
   npm start
   ```

4. Öffne die Anwendung in deinem Browser unter `http://localhost:3000`

### 2. Deployment auf Render.com

Du kannst die Anwendung einfach auf Render.com deployen:

1. Erstelle ein Konto auf [Render.com](https://render.com)
2. Klicke auf "New Web Service"
3. Verbinde dein GitHub-Repository oder lade das Projekt manuell hoch
4. Konfiguriere den Service:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Klicke auf "Create Web Service"

### 3. Andere Hosting-Optionen

Die Anwendung kann auch auf anderen Plattformen gehostet werden, die Node.js unterstützen:

- **Heroku**: Bietet eine kostenlose Stufe für kleine Anwendungen
- **Glitch**: Einfach zu bedienen und ideal für kleine Projekte
- **Railway**: Moderne Plattform mit einfachem Deployment-Prozess

## Verwendung

1. Öffne die Anwendung in deinem Browser (lokal unter http://localhost:3000 oder auf deinem Hosting-Dienst)
2. Du hast zwei Möglichkeiten:
   - Gib eine echte Kleinanzeigen-URL ein, um echte Daten zu extrahieren (z.B. https://www.kleinanzeigen.de/s-anzeige/...)
   - Oder verwende einen der folgenden Begriffe für Demo-Daten:
     - `demo` für allgemeine Demo-Daten (Mountainbike)
     - `iphone` oder `smartphone` für Smartphone-bezogene Demo-Daten
     - `sofa` oder `möbel` für Möbel-bezogene Demo-Daten
3. Klicke auf "Daten extrahieren"
4. Die extrahierten Daten (Titel, Beschreibung und Bilder) werden angezeigt
5. Nutze die Kopier-Buttons, um die Daten in die Zwischenablage zu kopieren

## Hinweise zur Funktionsweise

Diese Anwendung verwendet einen Node.js-Backend-Server, um CORS-Beschränkungen zu umgehen und echte Daten von Kleinanzeigen zu extrahieren. Der Server fungiert als Proxy, der:

1. Anfragen vom Frontend entgegennimmt
2. Diese Anfragen an Kleinanzeigen weiterleitet
3. Die HTML-Antwort analysiert und relevante Daten extrahiert
4. Die extrahierten Daten in einem strukturierten Format (JSON) zurückgibt

Der Demo-Modus funktioniert weiterhin ohne Serveranfragen und zeigt vordefinierte Beispieldaten an.

## Weitere Hilfe

Wenn du weitere Hilfe benötigst:

- Überprüfe die README.md-Datei für zusätzliche Informationen
- Sieh dir die Kommentare im Code an, insbesondere in server.js
- Bei Problemen mit dem Deployment auf Render.com, konsultiere die [Render-Dokumentation](https://render.com/docs)
- Bei Fehlern oder unerwarteten Verhaltensweisen, überprüfe die Konsole im Browser und die Server-Logs

Für Entwickler, die die Anwendung erweitern möchten:

- Die Frontend-Dateien befinden sich im `public`-Verzeichnis
- Die Backend-Logik ist in `server.js` implementiert
- Die Abhängigkeiten sind in `package.json` definiert