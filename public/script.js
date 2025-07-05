document.addEventListener('DOMContentLoaded', function() {
    // Konstanten für Konfiguration
    const CONFIG = {
        DEBOUNCE_TIME: 300, // ms
        FETCH_TIMEOUT: 20000, // ms
        OVERALL_TIMEOUT: 30000, // ms
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000, // ms
        CACHE_EXPIRY: 24 * 60 * 60 * 1000, // 24 Stunden in ms
        CACHE_MAX_SIZE: 50 // Maximale Anzahl an Cache-Einträgen
    };
    
    // Cache-Mechanismus für bereits extrahierte Daten
    const dataCache = new Map();
    
    // Funktion zum Löschen alter Cache-Einträge
    function cleanupCache() {
        const now = Date.now();
        
        // Lösche abgelaufene Einträge
        for (const [url, data] of dataCache.entries()) {
            if (data.timestamp && now - data.timestamp > CONFIG.CACHE_EXPIRY) {
                dataCache.delete(url);
            }
        }
        
        // Wenn der Cache immer noch zu groß ist, lösche die ältesten Einträge
        if (dataCache.size > CONFIG.CACHE_MAX_SIZE) {
            const entries = Array.from(dataCache.entries());
            entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
            
            const toDelete = entries.slice(0, entries.length - CONFIG.CACHE_MAX_SIZE);
            for (const [url] of toDelete) {
                dataCache.delete(url);
            }
        }
    }
    
    // Offline-Status überwachen
    function updateOfflineStatus() {
        if (navigator.onLine) {
            offlineNotification.classList.remove('visible');
            document.body.classList.remove('offline');
        } else {
            offlineNotification.classList.add('visible');
            document.body.classList.add('offline');
        }
    }
    
    // Event-Listener für Online/Offline-Status
    window.addEventListener('online', updateOfflineStatus);
    window.addEventListener('offline', updateOfflineStatus);
    updateOfflineStatus(); // Initial prüfen
    // DOM-Elemente mit Fehlerbehandlung
    function getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`Element mit ID '${id}' nicht gefunden`);
            return document.createElement('div'); // Dummy-Element zurückgeben, um Fehler zu vermeiden
        }
        return element;
    }
    
    const urlInput = getElement('kleinanzeigen-url');
    const extractButton = getElement('extract-button');
    const loadingIndicator = getElement('loading-indicator');
    const resultsContainer = getElement('results-container');
    const titleContent = getElement('title-content');
    const descriptionContent = getElement('description-content');
    const imagesContainer = getElement('images-container');
    const errorMessage = getElement('error-message');
    const resetButton = getElement('reset-button');
    const errorDismissButton = getElement('error-dismiss');
    const loadingTimeElement = getElement('loading-time');
    const offlineNotification = getElement('offline-notification');
    
    // Globale Variablen für den Zustand der Anwendung
    let isProcessing = false;
    let lastProcessedUrl = '';
    let loadingStartTime = 0;
    let loadingTimer = null;
    let retryCount = 0;

    // Event-Listener für den Extract-Button mit Debounce
    let debounceTimer;
    extractButton.addEventListener('click', function() {
        // Debounce, um mehrfache Klicks zu verhindern
        if (debounceTimer) clearTimeout(debounceTimer);
        
        // Deaktiviere den Button während der Verarbeitung
        if (isProcessing) {
            showError('Bitte warte, während die Daten verarbeitet werden...');
            return;
        }
        
        debounceTimer = setTimeout(() => {
            const url = urlInput.value.trim();
            
            // Überprüfen, ob die URL gültig ist
            if (!url) {
                showError('Bitte gib eine URL oder ein Stichwort ein.');
                return;
            }
            
            // Prüfen, ob wir offline sind
            if (!navigator.onLine && !url.includes('demo')) {
                showError('Du bist offline. Bitte überprüfe deine Internetverbindung oder verwende den Demo-Modus.');
                return;
            }
            
            // Prüfen, ob die Daten im Cache sind
            if (dataCache.has(url) && !url.includes('demo')) {
                const cachedData = dataCache.get(url);
                displayData(cachedData);
                return;
            }
            
            // Verhindern, dass die gleiche URL mehrmals hintereinander verarbeitet wird
            if (url === lastProcessedUrl && !url.includes('demo')) {
                showError('Diese URL wurde bereits verarbeitet. Bitte gib eine andere URL ein.');
                return;
            }
            
            // Zurücksetzen des Retry-Zählers
            retryCount = 0;
            
            // Starte den Extraktionsprozess
            extractDataFromUrl(url);
            lastProcessedUrl = url;
        }, CONFIG.DEBOUNCE_TIME);
    });
    
    // Event-Listener für den Reset-Button
    resetButton.addEventListener('click', function() {
        clearResults();
        hideResults();
        hideError();
        urlInput.value = '';
        urlInput.focus();
        lastProcessedUrl = '';
    });
    
    // Event-Listener für den Error-Dismiss-Button
    errorDismissButton.addEventListener('click', function() {
        hideError();
    });

    // Event-Listener für Enter-Taste im Input-Feld
    urlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            extractButton.click();
        }
    });

    // Event-Delegation für Kopier-Buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('copy-button')) {
            const targetId = e.target.getAttribute('data-target');
            const contentElement = document.getElementById(targetId);
            copyToClipboard(contentElement.textContent);
            
            // Feedback für den Benutzer
            const originalText = e.target.textContent;
            e.target.textContent = 'Kopiert!';
            setTimeout(() => {
                e.target.textContent = originalText;
            }, 2000);
        }
        
        if (e.target.classList.contains('copy-image-button')) {
            const imageUrl = e.target.getAttribute('data-image-url');
            copyImageToClipboard(imageUrl);
            
            // Feedback für den Benutzer
            const originalText = e.target.textContent;
            e.target.textContent = 'Kopiert!';
            setTimeout(() => {
                e.target.textContent = originalText;
            }, 2000);
        }
    });

    // Verbesserte Funktion zur Überprüfung der URL
    function isValidKleinanzeigenUrl(url) {
        try {
            // Wenn es ein Stichwort ist (für Demo-Daten), akzeptieren
            if (!url.includes('.') && url.length < 30) {
                return true;
            }
            
            // URL-Validierung
            const parsedUrl = new URL(url);
            return parsedUrl.hostname.includes('kleinanzeigen.de') && parsedUrl.protocol.startsWith('http');
        } catch (e) {
            // Wenn es keine gültige URL ist, aber ein kurzer Text, behandeln wir es als Stichwort
            return !url.includes('.') && url.length < 30;
        }
    }

    // Funktion zum Anzeigen der Daten
    function displayData(data) {
        try {
            // Prüfen, ob es sich um Fehlerdaten handelt
            if (data.error) {
                showError(data.message || 'Ein Fehler ist aufgetreten.');
                hideLoading();
                return;
            }
            
            // Daten in der UI anzeigen mit Fehlerbehandlung
            titleContent.textContent = data.title || 'Kein Titel gefunden';
            descriptionContent.textContent = data.description || 'Keine Beschreibung gefunden';
            
            // Zusätzliche Informationen anzeigen, wenn verfügbar
            if (data.price || data.location) {
                // Entferne vorhandene zusätzliche Informationen, falls vorhanden
                const existingInfo = resultsContainer.querySelector('.additional-info');
                if (existingInfo) {
                    existingInfo.remove();
                }
                
                const additionalInfo = document.createElement('div');
                additionalInfo.className = 'additional-info';
                
                if (data.price) {
                    const priceElement = document.createElement('p');
                    priceElement.innerHTML = `<strong>Preis:</strong> ${data.price}`;
                    additionalInfo.appendChild(priceElement);
                }
                
                if (data.location) {
                    const locationElement = document.createElement('p');
                    locationElement.innerHTML = `<strong>Standort:</strong> ${data.location}`;
                    additionalInfo.appendChild(locationElement);
                }
                
                // Füge die zusätzlichen Informationen vor den Ergebnissen ein
                resultsContainer.insertBefore(additionalInfo, resultsContainer.firstChild);
            }
            
            // Bilder anzeigen mit Fehlerbehandlung
            if (data.images && data.images.length > 0) {
                data.images.forEach(imageUrl => {
                    if (imageUrl && typeof imageUrl === 'string') {
                        addImageToContainer(imageUrl);
                    }
                });
            } else {
                const noImagesMessage = document.createElement('p');
                noImagesMessage.textContent = 'Keine Bilder gefunden.';
                imagesContainer.appendChild(noImagesMessage);
            }
            
            hideLoading();
            showResults();
        } catch (error) {
            console.error('Fehler beim Anzeigen der Daten:', error);
            showError('Fehler beim Anzeigen der Daten: ' + error.message);
            hideLoading();
        }
    }
    
    // Verbesserte Funktion zum Extrahieren der Daten mit Timeout und Fehlerbehandlung
    function extractDataFromUrl(url) {
        // UI-Status aktualisieren
        showLoading();
        hideError();
        clearResults();
        isProcessing = true;
        
        // Starte den Ladezeit-Timer
        loadingStartTime = Date.now();
        updateLoadingTime();
        
        // Timeout für die Anfrage setzen
        const timeoutId = setTimeout(() => {
            if (isProcessing) {
                showError('Die Anfrage dauert länger als erwartet. Bitte versuche es später erneut.');
                hideLoading();
                isProcessing = false;
            }
        }, CONFIG.OVERALL_TIMEOUT); // Timeout aus Konfiguration
        
        try {
            // Wenn Demo-Modus aktiviert ist oder ein Stichwort eingegeben wurde
            if (url.includes('demo') || (!url.includes('.') && url.length < 30)) {
                // Prüfen, ob Demo-Daten im Cache sind
                if (dataCache.has(url)) {
                    const cachedData = dataCache.get(url);
                    // Prüfen, ob die Cache-Daten noch gültig sind
                    if (cachedData.timestamp && Date.now() - cachedData.timestamp < CONFIG.CACHE_EXPIRY) {
                        displayData(cachedData);
                        clearTimeout(timeoutId);
                        isProcessing = false;
                        return;
                    }
                }
                
                // Simuliere Ladezeit für bessere Benutzererfahrung
                setTimeout(() => {
                    try {
                        // Zeige Demo-Daten an
                        showDemoData(url);
                        clearTimeout(timeoutId);
                        isProcessing = false;
                    } catch (error) {
                        console.error('Fehler beim Anzeigen der Demo-Daten:', error);
                        showError('Fehler beim Anzeigen der Demo-Daten.');
                        hideLoading();
                        isProcessing = false;
                    }
                }, 1000);
                return;
            }
            
            // Wenn es eine echte Kleinanzeigen-URL ist
            if (isValidKleinanzeigenUrl(url)) {
                // API-Anfrage an den Backend-Server senden mit Fetch API und AbortController für Timeout
                const controller = new AbortController();
                const signal = controller.signal;
                
                // Setze einen Timeout für die Fetch-Anfrage
                const fetchTimeoutId = setTimeout(() => controller.abort(), 20000); // 20 Sekunden Timeout
                
                // Funktion für Wiederholungsversuche bei Fehlern
                function fetchWithRetry() {
                    if (retryCount >= CONFIG.MAX_RETRIES) {
                        throw new Error(`Maximale Anzahl an Wiederholungsversuchen (${CONFIG.MAX_RETRIES}) erreicht.`);
                    }
                    
                    // Neuen AbortController für jeden Versuch erstellen
                    const controller = new AbortController();
                    const signal = controller.signal;
                    const fetchTimeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);
                    
                    return fetch(`/api/extract?url=${encodeURIComponent(url)}`, { 
                        signal,
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    })
                    .then(response => {
                        clearTimeout(fetchTimeoutId);
                        
                        if (!response.ok) {
                            return response.json().then(errorData => {
                                throw new Error(errorData.error || errorData.message || `HTTP-Fehler: ${response.status}`);
                            }).catch(e => {
                                throw new Error(`HTTP-Fehler: ${response.status}`);
                            });
                        }
                        return response.json();
                    })
                    .catch(error => {
                        clearTimeout(fetchTimeoutId);
                        
                        // Bei bestimmten Fehlern einen Wiederholungsversuch starten
                        if (
                            error.name === 'AbortError' || // Timeout
                            error.message.includes('network') || // Netzwerkfehler
                            (error.message.includes('HTTP-Fehler') && [429, 500, 502, 503, 504].includes(parseInt(error.message.match(/\d+/)?.[0] || '0'))) // Server-Fehler
                        ) {
                            retryCount++;
                            console.log(`Wiederholungsversuch ${retryCount} von ${CONFIG.MAX_RETRIES}...`);
                            
                            // Zeige dem Benutzer an, dass ein Wiederholungsversuch stattfindet
                            loadingTimeElement.textContent += ` (Versuch ${retryCount} von ${CONFIG.MAX_RETRIES})`;
                            
                            // Warte kurz vor dem nächsten Versuch
                            return new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY))
                                .then(() => fetchWithRetry());
                        }
                        
                        // Bei anderen Fehlern den Fehler weiterleiten
                        throw error;
                    });
                }
                
                // Starte den ersten Versuch
                 fetchWithRetry()
                     .then(data => {
                         // Füge Zeitstempel hinzu und speichere die Daten im Cache
                         data.timestamp = Date.now();
                         dataCache.set(url, data);
                         
                         // Bereinige den Cache
                         cleanupCache();
                         
                         // Zeige die Daten an
                         displayData(data);
                         
                         clearTimeout(timeoutId);
                         isProcessing = false;
                     })
                    .catch(error => {
                        console.error('Fehler beim Abrufen der Daten:', error);
                        
                        let errorMsg = 'Fehler beim Abrufen der Daten.';
                        
                        if (error.name === 'AbortError') {
                            errorMsg = 'Die Anfrage wurde wegen Zeitüberschreitung abgebrochen. Bitte versuche es später erneut.';
                        } else if (error.message.includes('Maximale Anzahl')) {
                            errorMsg = error.message + ' Bitte versuche es später erneut.';
                        } else if (error.message) {
                            errorMsg += ' ' + error.message;
                        }
                        
                        // Speichere den Fehler im Cache, um wiederholte Fehler zu vermeiden
                        const errorData = { error: true, message: errorMsg, timestamp: Date.now() };
                        dataCache.set(url, errorData);
                        
                        showError(errorMsg);
                        hideLoading();
                        clearTimeout(timeoutId);
                        isProcessing = false;
                    });
                return;
            }
            
            // Wenn keine gültige URL eingegeben wurde
            showError('Bitte gib eine gültige Kleinanzeigen-URL oder ein Stichwort wie "demo", "iphone" oder "sofa" ein.');
            hideLoading();
            clearTimeout(timeoutId);
            isProcessing = false;
        } catch (error) {
            console.error('Unerwarteter Fehler:', error);
            showError('Ein unerwarteter Fehler ist aufgetreten: ' + error.message);
            hideLoading();
            clearTimeout(timeoutId);
            isProcessing = false;
        }
    }

    // Funktion zum Anzeigen von Demo-Daten (für Testzwecke)
    function showDemoData(url) {
        // Prüfen, ob Demo-Daten bereits im Cache sind und noch gültig
        if (dataCache.has(url)) {
            const cachedData = dataCache.get(url);
            const now = Date.now();
            
            // Prüfen, ob die Daten noch gültig sind
            if (cachedData.timestamp && now - cachedData.timestamp < CONFIG.CACHE_EXPIRY) {
                console.log('Verwende Demo-Daten aus dem Cache');
                displayData(cachedData);
                return;
            }
        }
        
        // Simuliere Ladezeit für ein realistischeres Erlebnis
        showLoading();
        loadingStartTime = Date.now();
        updateLoadingTime();
        
        setTimeout(() => {
            // Hinweis anzeigen, dass Demo-Daten angezeigt werden
            const demoNotice = document.createElement('div');
            demoNotice.className = 'demo-notice';
            demoNotice.innerHTML = '<strong>Hinweis:</strong> Du siehst gerade Demo-Daten. ' +
                'Für echte Daten gib bitte eine vollständige Kleinanzeigen-URL ein.';
            
            // Demo-Daten basierend auf der URL
            let title, description, demoImages, price, location;
            
            // Verschiedene Demo-Daten je nach URL
            if (url.includes('iphone') || url.includes('smartphone')) {
                title = 'iPhone 13 Pro Max - 256GB - Graphit - Wie neu';
                description = 'Verkaufe mein iPhone 13 Pro Max mit 256GB in der Farbe Graphit. ' +
                    'Das Gerät ist in einem sehr guten Zustand, ohne Kratzer oder Dellen. ' +
                    'Originalverpackung, Ladekabel und Originalrechnung sind vorhanden. ' +
                    'Akku-Gesundheit liegt bei 92%. ' +
                    'Versand möglich oder Abholung in München.';
                price = '799 €';
                location = 'München';
                demoImages = [
                    'https://i.ebayimg.com/00/s/MTYwMFgxMjAw/z/s~gAAOSwH4VkWGxc/$_59.JPG',
                    'https://i.ebayimg.com/00/s/MTYwMFgxMjAw/z/XVIAAOSwH4VkWGxc/$_59.JPG',
                    'https://i.ebayimg.com/00/s/MTYwMFgxMjAw/z/s~gAAOSwH4VkWGxc/$_59.JPG'
                ];
            } else if (url.includes('möbel') || url.includes('sofa') || url.includes('moebel')) {
                title = 'Schönes Sofa - 3-Sitzer - Grau - Sehr guter Zustand';
                description = 'Verkaufe mein 3-Sitzer Sofa in grau. Das Sofa ist ca. 2 Jahre alt und in einem sehr guten Zustand. ' +
                    'Keine Flecken, keine Risse, keine Haustiere. ' +
                    'Maße: 220cm x 90cm x 85cm (BxTxH). ' +
                    'Nur Abholung in Berlin-Mitte.';
                price = '350 €';
                location = 'Berlin-Mitte';
                demoImages = [
                    'https://i.ebayimg.com/00/s/MTIwMFgxNjAw/z/E~IAAOSwm1Nj~hQP/$_59.JPG',
                    'https://i.ebayimg.com/00/s/MTIwMFgxNjAw/z/E~IAAOSwm1Nj~hQP/$_59.JPG'
                ];
            } else {
                // Standard-Demo-Daten
                title = 'Mountainbike - 29 Zoll - Fully - Shimano XT - Top Zustand';
                description = 'Verkaufe mein Mountainbike der Marke Trek. ' +
                    '29 Zoll, Fully, Shimano XT Schaltung, hydraulische Scheibenbremsen. ' +
                    'Das Bike ist in einem sehr guten Zustand, wurde regelmäßig gewartet. ' +
                    'Neupreis war 2.200€. ' +
                    'Bei Fragen einfach melden. Probefahrt möglich in Hamburg.';
                price = '1.250 €';
                location = 'Hamburg';
                demoImages = [
                    'https://i.ebayimg.com/00/s/MTYwMFgxMjAw/z/DL8AAOSwLwBkpCpb/$_59.JPG',
                    'https://i.ebayimg.com/00/s/MTYwMFgxMjAw/z/DL8AAOSwLwBkpCpb/$_59.JPG'
                ];
            }
            
            // Erstelle ein Datenobjekt für die Anzeige und den Cache
            const demoData = {
                title: title,
                description: description,
                price: price,
                location: location,
                images: demoImages,
                timestamp: Date.now(),
                isDemo: true
            };
            
            // Speichere die Demo-Daten im Cache
            dataCache.set(url, demoData);
            
            // Zeige die Daten an
            displayData(demoData);
            
            // Demo-Hinweis vor den Ergebnissen einfügen
            resultsContainer.insertBefore(demoNotice, resultsContainer.firstChild);
            
            hideLoading();
        }, 1000); // 1 Sekunde Verzögerung für ein realistischeres Erlebnis
    }
    }

    // Verbesserte Funktion zum Hinzufügen eines Bildes zum Container mit Fehlerbehandlung und Lazy Loading
    function addImageToContainer(imageUrl) {
        if (!imageUrl || typeof imageUrl !== 'string') {
            console.warn('Ungültige Bild-URL:', imageUrl);
            return;
        }
        
        try {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            
            const img = document.createElement('img');
            // Platzhalter-Bild anzeigen, während das eigentliche Bild geladen wird
            img.src = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 300 200%22%3E%3Crect width%3D%22300%22 height%3D%22200%22 fill%3D%22%23cccccc%22%3E%3C%2Frect%3E%3Ctext x%3D%22150%22 y%3D%22100%22 font-size%3D%2220%22 text-anchor%3D%22middle%22 alignment-baseline%3D%22middle%22 fill%3D%22%23ffffff%22%3ELade Bild...%3C%2Ftext%3E%3C%2Fsvg%3E';
            img.alt = 'Produktbild';
            img.dataset.src = imageUrl; // Speichere die eigentliche URL als Datenattribut
            img.loading = 'lazy'; // Aktiviere Lazy Loading
            
            // Lade das eigentliche Bild, wenn es sichtbar wird
            const observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        observer.unobserve(img);
                    }
                });
            });
            
            // Fehlerbehandlung für Bilder
            img.onerror = function() {
                this.onerror = null;
                this.src = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 300 200%22%3E%3Crect width%3D%22300%22 height%3D%22200%22 fill%3D%22%23f5f5f5%22%3E%3C%2Frect%3E%3Ctext x%3D%22150%22 y%3D%22100%22 font-size%3D%2220%22 text-anchor%3D%22middle%22 alignment-baseline%3D%22middle%22 fill%3D%22%23999999%22%3EBild nicht verfügbar%3C%2Ftext%3E%3C%2Fsvg%3E';
                console.warn('Bild konnte nicht geladen werden:', imageUrl);
            };
            
            // Erfolgsbehandlung für Bilder
            img.onload = function() {
                if (this.src !== this.dataset.src) return; // Ignoriere das Laden des Platzhalters
                this.classList.add('loaded');
            };
            
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-image-button';
            copyButton.textContent = 'Kopieren';
            copyButton.setAttribute('data-image-url', imageUrl);
            
            // Füge einen Download-Button hinzu
            const downloadButton = document.createElement('button');
            downloadButton.className = 'download-image-button';
            downloadButton.textContent = 'Download';
            downloadButton.addEventListener('click', function() {
                try {
                    const a = document.createElement('a');
                    a.href = imageUrl;
                    a.download = 'bild_' + new Date().getTime() + '.jpg';
                    a.target = '_blank';
                    a.click();
                } catch (error) {
                    console.error('Fehler beim Herunterladen des Bildes:', error);
                    alert('Das Bild konnte nicht heruntergeladen werden. Versuche es mit Rechtsklick -> Bild speichern unter...');
                }
            });
            
            imageItem.appendChild(img);
            imageItem.appendChild(copyButton);
            imageItem.appendChild(downloadButton);
            imagesContainer.appendChild(imageItem);
            
            // Beobachte das Bild für Lazy Loading
            observer.observe(img);
        } catch (error) {
            console.error('Fehler beim Hinzufügen des Bildes:', error);
        }
    }

    // Funktion zum Aktualisieren der Ladezeit-Anzeige
    function updateLoadingTime() {
        if (!isProcessing) return;
        
        const elapsedSeconds = Math.floor((Date.now() - loadingStartTime) / 1000);
        loadingTimeElement.textContent = `${elapsedSeconds}s`;
        
        // Aktualisiere die Anzeige jede Sekunde
        loadingTimer = setTimeout(updateLoadingTime, 1000);
    }
    
    // Hilfsfunktionen für die UI
    function showLoading() {
        loadingIndicator.style.display = 'block';
        loadingTimeElement.textContent = '0s';
    }

    function hideLoading() {
        loadingIndicator.style.display = 'none';
        if (loadingTimer) {
            clearTimeout(loadingTimer);
            loadingTimer = null;
        }
    }

    function showResults() {
        resultsContainer.style.display = 'block';
    }

    function hideResults() {
        resultsContainer.style.display = 'none';
    }

    function showError(message) {
        errorMessage.querySelector('p').textContent = message;
        errorMessage.style.display = 'block';
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }

    function clearResults() {
        titleContent.textContent = '';
        descriptionContent.textContent = '';
        imagesContainer.innerHTML = '';
        hideResults();
    }

    // Verbesserte Funktion zum Kopieren von Text in die Zwischenablage mit Fallback
    function copyToClipboard(text) {
        // Prüfen, ob die Clipboard API verfügbar ist
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    console.log('Text erfolgreich in die Zwischenablage kopiert');
                })
                .catch(err => {
                    console.error('Fehler beim Kopieren in die Zwischenablage:', err);
                    fallbackCopyToClipboard(text);
                });
        } else {
            // Fallback für Browser, die die Clipboard API nicht unterstützen
            fallbackCopyToClipboard(text);
        }
    }

    // Fallback-Methode zum Kopieren in die Zwischenablage
    function fallbackCopyToClipboard(text) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (!successful) {
                console.error('Fallback: Kopieren fehlgeschlagen');
                alert('Kopieren fehlgeschlagen. Bitte markiere den Text manuell und drücke Strg+C / Cmd+C.');
            }
        } catch (err) {
            console.error('Fallback: Fehler beim Kopieren:', err);
            alert('Kopieren fehlgeschlagen. Bitte markiere den Text manuell und drücke Strg+C / Cmd+C.');
        }
    }

    // Verbesserte Funktion zum Kopieren eines Bildes in die Zwischenablage
    function copyImageToClipboard(imageUrl) {
        // Versuche, das Bild in die Zwischenablage zu kopieren (funktioniert nur in einigen Browsern)
        try {
            // Erstelle ein Canvas-Element und zeichne das Bild darauf
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Versuche, CORS-Probleme zu umgehen
            
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    // Versuche, das Canvas-Bild in die Zwischenablage zu kopieren
                    canvas.toBlob(function(blob) {
                        try {
                            const item = new ClipboardItem({ 'image/png': blob });
                            navigator.clipboard.write([item])
                                .then(() => {
                                    console.log('Bild erfolgreich in die Zwischenablage kopiert');
                                })
                                .catch(err => {
                                    console.error('Fehler beim Kopieren des Bildes:', err);
                                    // Fallback: Kopiere die Bild-URL
                                    navigator.clipboard.writeText(imageUrl);
                                });
                        } catch (e) {
                            console.error('ClipboardItem wird nicht unterstützt:', e);
                            // Fallback: Kopiere die Bild-URL
                            navigator.clipboard.writeText(imageUrl);
                        }
                    });
                } catch (e) {
                    console.error('Canvas-Fehler:', e);
                    // Fallback: Kopiere die Bild-URL
                    navigator.clipboard.writeText(imageUrl);
                }
            };
            
            img.onerror = function() {
                console.error('Bild konnte nicht geladen werden');
                // Fallback: Kopiere die Bild-URL
                navigator.clipboard.writeText(imageUrl);
            };
            
            img.src = imageUrl;
        } catch (error) {
            console.error('Fehler beim Kopieren des Bildes:', error);
            // Fallback: Kopiere die Bild-URL
            navigator.clipboard.writeText(imageUrl);
        }
            .catch(err => {
                console.error('Fehler beim Kopieren der Bild-URL:', err);
            });
        
        // Eine fortgeschrittenere Implementierung könnte das Bild herunterladen
        // und als Blob in die Zwischenablage kopieren, was jedoch komplexer ist
    }
});