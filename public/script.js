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
    
    // Cache-Mechanismus für bereits extrahierte Daten mit localStorage-Persistenz
    let dataCache = new Map();
    
    // Lade den Cache aus dem localStorage beim Start
    function loadCacheFromStorage() {
        try {
            const savedCache = localStorage.getItem('kleinanzeigenExtractorCache');
            if (savedCache) {
                const parsedCache = JSON.parse(savedCache);
                dataCache = new Map(parsedCache);
                console.log(`Cache geladen: ${dataCache.size} Einträge`);
                cleanupCache(); // Bereinige den geladenen Cache sofort
            }
        } catch (error) {
            console.error('Fehler beim Laden des Caches:', error);
            dataCache = new Map(); // Fallback zu leerem Cache bei Fehler
        }
    }
    
    // Speichere den Cache im localStorage
    function saveCacheToStorage() {
        try {
            const cacheArray = Array.from(dataCache.entries());
            localStorage.setItem('kleinanzeigenExtractorCache', JSON.stringify(cacheArray));
        } catch (error) {
            console.error('Fehler beim Speichern des Caches:', error);
            // Bei Speicherfehlern (z.B. QuotaExceededError) Cache leeren
            if (error.name === 'QuotaExceededError') {
                dataCache.clear();
                try {
                    localStorage.removeItem('kleinanzeigenExtractorCache');
                } catch (e) {
                    console.error('Konnte Cache nicht entfernen:', e);
                }
            }
        }
    }
    
    // Funktion zum Löschen alter Cache-Einträge
    function cleanupCache() {
        const now = Date.now();
        let entriesRemoved = 0;
        
        // Lösche abgelaufene Einträge
        for (const [url, data] of dataCache.entries()) {
            if (data.timestamp && now - data.timestamp > CONFIG.CACHE_EXPIRY) {
                dataCache.delete(url);
                entriesRemoved++;
            }
        }
        
        // Wenn der Cache immer noch zu groß ist, lösche die ältesten Einträge
        if (dataCache.size > CONFIG.CACHE_MAX_SIZE) {
            const entries = Array.from(dataCache.entries());
            entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
            
            const toDelete = entries.slice(0, entries.length - CONFIG.CACHE_MAX_SIZE);
            for (const [url] of toDelete) {
                dataCache.delete(url);
                entriesRemoved++;
            }
        }
        
        // Speichere den bereinigten Cache, wenn Einträge entfernt wurden
        if (entriesRemoved > 0) {
            saveCacheToStorage();
            console.log(`Cache bereinigt: ${entriesRemoved} Einträge entfernt`);
        }
        
        return entriesRemoved;
    }
    
    // Lade den Cache beim Start
    loadCacheFromStorage();
    
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
    
    const urlInput = getElement('url-input');
    const extractButton = getElement('extract-button');
    const pasteButton = getElement('paste-button');
    const loadingIndicator = getElement('loading-indicator');
    const loadingSubtext = getElement('loading-subtext');
    const resultsContainer = getElement('results-container');
    const titleResult = getElement('title-result');
    const descriptionResult = getElement('description-result');
    const priceResult = getElement('price-result');
    const locationResult = getElement('location-result');
    const imagesContainer = getElement('images-container');
    const errorContainer = getElement('error-container');
    const errorText = getElement('error-text');
    const retryButton = getElement('retry-button');
    const copyAllButton = getElement('copy-all-button');
    const newExtractionButton = getElement('new-extraction-button');
    const copyTitleButton = getElement('copy-title-button');
    const copyDescriptionButton = getElement('copy-description-button');
    const copyPriceButton = getElement('copy-price-button');
    const copyLocationButton = getElement('copy-location-button');
    const copyAllImagesButton = getElement('copy-all-images-button');
    const downloadAllImagesButton = getElement('download-all-images-button');
    const originalLink = getElement('original-link');
    const connectionStatus = getElement('connection-status');
    const cacheStatus = getElement('cache-status');
    const helpButton = getElement('help-button');
    const helpModal = getElement('help-modal');
    const closeHelpButton = getElement('close-help-button');
    const loadingTimeElement = getElement('loading-time');
    const offlineNotification = getElement('offline-notification');
    const statusBar = getElement('status-bar');
    
    // Globale Variablen für den Zustand der Anwendung
    let isProcessing = false;
    let lastProcessedUrl = '';
    let loadingStartTime = 0;
    let loadingTimer = null;
    let retryCount = 0;

    // Event-Listener für den Extract-Button mit Debounce
    let debounceTimer;
    extractButton.addEventListener('click', handleExtractButtonClick);
    
    // Funktion zum Verarbeiten des Extract-Button-Klicks
    function handleExtractButtonClick() {
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
            
            // Liste der Demo-Optionen
            const demoOptions = ['demo', 'iphone', 'sofa', 'mountainbike'];
            const isDemoOption = demoOptions.some(option => url.toLowerCase().includes(option)) || (!url.includes('.') && url.length < 30);
            
            // Prüfen, ob wir offline sind
            if (!navigator.onLine && !isDemoOption) {
                showError('Du bist offline. Bitte überprüfe deine Internetverbindung oder verwende den Demo-Modus.');
                updateConnectionStatus('Offline', 'error');
                return;
            }
            
            // Prüfen, ob die Daten im Cache sind und nicht explizit ein Demo angefordert wurde
            if (dataCache.has(url) && !isDemoOption) {
                const cachedData = dataCache.get(url);
                // Prüfen, ob die Cache-Daten noch gültig sind
                if (cachedData.timestamp && Date.now() - cachedData.timestamp < CONFIG.CACHE_EXPIRY) {
                    updateConnectionStatus('Aus Cache geladen', 'success');
                    displayData(cachedData);
                    return;
                }
            }
            
            // Verhindern, dass die gleiche URL mehrmals hintereinander verarbeitet wird
            if (url === lastProcessedUrl && !isDemoOption) {
                showError('Diese URL wurde bereits verarbeitet. Bitte gib eine andere URL ein oder klicke auf "Neue Extraktion".');
                return;
            }
            
            // Zurücksetzen des Retry-Zählers
            retryCount = 0;
            
            // Starte den Extraktionsprozess
            extractDataFromUrl(url);
            lastProcessedUrl = url;
        }, CONFIG.DEBOUNCE_TIME);
    }
    
    // Event-Listener für den Reset-Button
    newExtractionButton.addEventListener('click', function() {
        clearResults();
        hideResults();
        hideError();
        urlInput.value = '';
        urlInput.focus();
        lastProcessedUrl = '';
    });
    
    // Event-Listener für den Retry-Button
    retryButton.addEventListener('click', function() {
        if (urlInput.value.trim()) {
            extractButton.click();
        } else {
            showError('Bitte gib eine URL ein, bevor du es erneut versuchst.');
        }
    });

    // Event-Listener für Enter-Taste im Input-Feld
    urlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            extractButton.click();
        }
    });
    
    // Event-Listener für den Paste-Button
    pasteButton.addEventListener('click', async function() {
        try {
            const text = await navigator.clipboard.readText();
            urlInput.value = text.trim();
            urlInput.focus();
        } catch (error) {
            console.error('Fehler beim Einfügen aus der Zwischenablage:', error);
            showError('Zugriff auf die Zwischenablage nicht möglich. Bitte füge die URL manuell ein.');
        }
    });
    
    // Event-Listener für den Help-Button und Close-Help-Button
    helpButton.addEventListener('click', function() {
        helpModal.classList.add('visible');
    });
    
    closeHelpButton.addEventListener('click', function() {
        helpModal.classList.remove('visible');
    });
    
    // Event-Listener für Klicks außerhalb des Modals zum Schließen
    window.addEventListener('click', function(event) {
        if (event.target === helpModal) {
            helpModal.classList.remove('visible');
        }
    });
    
    // Event-Listener für Copy-All-Button
    copyAllButton.addEventListener('click', function() {
        const title = titleResult.textContent;
        const description = descriptionResult.textContent;
        const price = priceResult.textContent;
        const location = locationResult.textContent;
        
        const allText = `${title}\n\n${description}\n\nPreis: ${price}\nStandort: ${location}`;
        copyToClipboard(allText);
        
        // Feedback für den Benutzer
        const originalText = copyAllButton.textContent;
        copyAllButton.textContent = 'Alles kopiert!';
        setTimeout(() => {
            copyAllButton.textContent = originalText;
        }, 2000);
    });
    
    // Event-Listener für Copy-All-Images-Button
    copyAllImagesButton.addEventListener('click', function() {
        const imageButtons = document.querySelectorAll('.copy-image-button');
        if (imageButtons.length > 0) {
            // Kopiere das erste Bild
            const firstImageUrl = imageButtons[0].getAttribute('data-image-url');
            copyImageToClipboard(firstImageUrl);
            
            // Feedback für den Benutzer
            const originalText = copyAllImagesButton.textContent;
            copyAllImagesButton.textContent = 'Erstes Bild kopiert!';
            setTimeout(() => {
                copyAllImagesButton.textContent = originalText;
            }, 2000);
        } else {
            showError('Keine Bilder zum Kopieren vorhanden.');
        }
    });
    
    // Event-Listener für Download-All-Images-Button
    downloadAllImagesButton.addEventListener('click', function() {
        const imageButtons = document.querySelectorAll('.download-image-button');
        if (imageButtons.length > 0) {
            // Simuliere Klicks auf alle Download-Buttons mit Verzögerung
            imageButtons.forEach((button, index) => {
                setTimeout(() => {
                    button.click();
                }, index * 500); // 500ms Verzögerung zwischen Downloads
            });
            
            // Feedback für den Benutzer
            const originalText = downloadAllImagesButton.textContent;
            downloadAllImagesButton.textContent = `${imageButtons.length} Bilder werden heruntergeladen...`;
            setTimeout(() => {
                downloadAllImagesButton.textContent = originalText;
            }, 2000 + imageButtons.length * 500);
        } else {
            showError('Keine Bilder zum Herunterladen vorhanden.');
        }
    });

    // Verbesserte Event-Delegation für alle Buttons
    document.addEventListener('click', function(e) {
        // Prüfen, ob das geklickte Element oder eines seiner Elternelemente die Klasse 'copy-button' hat
        const copyButton = e.target.closest('.copy-button');
        if (copyButton) {
            const targetId = copyButton.getAttribute('data-target');
            const contentElement = document.getElementById(targetId);
            copyToClipboard(contentElement.textContent);
            
            // Feedback für den Benutzer
            const originalHTML = copyButton.innerHTML;
            copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg> Kopiert!';
            setTimeout(() => {
                copyButton.innerHTML = originalHTML;
            }, 2000);
        }
        
        // Prüfen, ob das geklickte Element oder eines seiner Elternelemente die Klasse 'copy-image-button' hat
        const copyImageButton = e.target.closest('.copy-image-button');
        if (copyImageButton) {
            const imageUrl = copyImageButton.getAttribute('data-image-url');
            copyImageToClipboard(imageUrl);
            
            // Feedback für den Benutzer
            const originalHTML = copyImageButton.innerHTML;
            copyImageButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
            setTimeout(() => {
                copyImageButton.innerHTML = originalHTML;
            }, 2000);
        }
        
        // Prüfen, ob das geklickte Element oder eines seiner Elternelemente die Klasse 'download-image-button' hat
        const downloadButton = e.target.closest('.download-image-button');
        if (downloadButton) {
            try {
                const imageUrl = downloadButton.getAttribute('data-image-url');
                const a = document.createElement('a');
                a.href = imageUrl;
                a.download = 'bild_' + new Date().getTime() + '.jpg';
                a.target = '_blank';
                a.click();
                
                // Visuelles Feedback
                const originalHTML = downloadButton.innerHTML;
                downloadButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
                
                setTimeout(() => {
                    downloadButton.innerHTML = originalHTML;
                }, 2000);
            } catch (error) {
                console.error('Fehler beim Herunterladen des Bildes:', error);
                alert('Das Bild konnte nicht heruntergeladen werden. Versuche es mit Rechtsklick -> Bild speichern unter...');
            }
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
            const hostname = parsedUrl.hostname;
            
            // Überprüfe, ob die Domain kleinanzeigen.de oder ebay-kleinanzeigen.de ist (mit oder ohne www)
            const isKleinanzeigenDomain = 
                hostname === 'www.kleinanzeigen.de' || 
                hostname === 'kleinanzeigen.de' || 
                hostname === 'm.kleinanzeigen.de' ||
                hostname === 'www.ebay-kleinanzeigen.de' ||
                hostname === 'ebay-kleinanzeigen.de' ||
                hostname === 'm.ebay-kleinanzeigen.de';
            
            // Überprüfe, ob der Pfad auf eine Anzeige hinweist
            const isAnzeigePath = 
                parsedUrl.pathname.includes('/s-anzeige/') || 
                parsedUrl.pathname.includes('/s-details/');
            
            // Akzeptiere nur HTTP(S) URLs mit gültiger Domain und bevorzugt Anzeigepfad
            // Wenn kein Anzeigepfad, akzeptiere trotzdem die Domain für flexiblere Handhabung
            return isKleinanzeigenDomain && parsedUrl.protocol.startsWith('http');
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
        
        // Titel anzeigen
        titleResult.textContent = data.title || 'Kein Titel gefunden';
        
        // Beschreibung anzeigen
        descriptionResult.textContent = data.description || 'Keine Beschreibung gefunden';
        
        // Preis anzeigen
        priceResult.textContent = data.price || 'Kein Preis angegeben';
        
        // Standort anzeigen
        locationResult.textContent = data.location || 'Kein Standort angegeben';
        
        // Bilder anzeigen mit Fehlerbehandlung
        imagesContainer.innerHTML = '';
        if (data.images && data.images.length > 0) {
            data.images.forEach(imageUrl => {
                if (imageUrl && typeof imageUrl === 'string') {
                    addImageToContainer(imageUrl);
                }
            });
        } else {
            const noImagesMessage = document.createElement('p');
            noImagesMessage.textContent = 'Keine Bilder gefunden.';
            noImagesMessage.className = 'no-images-message';
            imagesContainer.appendChild(noImagesMessage);
        }
        
        // Original-Link aktualisieren
        if (data.url) {
            originalLink.href = data.url;
            originalLink.textContent = data.url;
        } else if (urlInput.value && isValidKleinanzeigenUrl(urlInput.value)) {
            originalLink.href = urlInput.value;
            originalLink.textContent = urlInput.value;
        }
        
        // UI aktualisieren
        hideLoading();
        hideError();
        showResults();
    } catch (error) {
        console.error('Fehler beim Anzeigen der Daten:', error);
        showError('Fehler beim Anzeigen der Daten: ' + error.message);
        hideLoading();
    }
}
    
    // Verbesserte Funktion zum Extrahieren der Daten mit Timeout und Fehlerbehandlung
    function extractDataFromUrl(url) {
        // Zurücksetzen des Wiederholungszählers
        retryCount = 0;
        
        // Prüfen, ob der Benutzer offline ist
        if (!navigator.onLine) {
            showError('Du bist offline. Bitte überprüfe deine Internetverbindung und versuche es erneut.');
            updateConnectionStatus('Offline', 'error');
            return;
        }
        
        // UI-Status aktualisieren
        showLoading();
        hideError();
        clearResults();
        isProcessing = true;
        updateConnectionStatus('Verbindung wird hergestellt...', 'pending');
        
        // Starte den Ladezeit-Timer
        loadingStartTime = Date.now();
        updateLoadingTime();
        loadingSubtext.textContent = 'Verbinde mit Server...';
        
        // Timeout für die Anfrage setzen
        const timeoutId = setTimeout(() => {
            if (isProcessing) {
                showError('Die Anfrage dauert länger als erwartet. Bitte versuche es später erneut.');
                hideLoading();
                isProcessing = false;
                updateConnectionStatus('Zeitüberschreitung', 'error');
            }
        }, CONFIG.OVERALL_TIMEOUT); // Timeout aus Konfiguration
        
        try {
            // Prüfen, ob die URL im Cache ist
            if (dataCache.has(url)) {
                const cachedData = dataCache.get(url);
                // Prüfen, ob die Cache-Daten noch gültig sind
                if (cachedData.timestamp && Date.now() - cachedData.timestamp < CONFIG.CACHE_EXPIRY) {
                    // Zeige Cache-Status an
                    updateConnectionStatus('Aus Cache geladen', 'success');
                    loadingSubtext.textContent = 'Lade aus Cache...';
                    
                    // Kurze Verzögerung für bessere UX
                    setTimeout(() => {
                        displayData(cachedData);
                        clearTimeout(timeoutId);
                        isProcessing = false;
                    }, 500);
                    return;
                } else {
                    // Cache ist abgelaufen
                    updateConnectionStatus('Cache abgelaufen, lade neu...', 'pending');
                }
            } else {
                updateConnectionStatus('Neue Anfrage', 'pending');
            }
            
            // Wenn Demo-Modus aktiviert ist oder ein Stichwort eingegeben wurde
            const demoOptions = ['demo', 'iphone', 'sofa', 'mountainbike'];
            if (demoOptions.some(option => url.toLowerCase().includes(option)) || (!url.includes('.') && url.length < 30)) {
                loadingSubtext.textContent = 'Lade Demo-Daten...';
                
                // Simuliere Ladezeit für bessere Benutzererfahrung
                setTimeout(() => {
                    try {
                        // Zeige Demo-Daten an
                        showDemoData(url);
                        updateConnectionStatus('Demo-Modus', 'success');
                        clearTimeout(timeoutId);
                        isProcessing = false;
                    } catch (error) {
                        console.error('Fehler beim Anzeigen der Demo-Daten:', error);
                        showError('Fehler beim Anzeigen der Demo-Daten.');
                        hideLoading();
                        isProcessing = false;
                        updateConnectionStatus('Demo-Fehler', 'error');
                    }
                }, 1000);
                return;
            }
            
            // Wenn es eine echte Kleinanzeigen-URL ist
            if (isValidKleinanzeigenUrl(url)) {
                loadingSubtext.textContent = 'Verbinde mit Kleinanzeigen...';
                
                // API-Anfrage an den Backend-Server senden mit Fetch API und AbortController für Timeout
                const controller = new AbortController();
                const signal = controller.signal;
                
                // Setze einen Timeout für die Fetch-Anfrage
                const fetchTimeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);
                
                // Funktion für Wiederholungsversuche bei Fehlern mit exponentieller Backoff-Strategie
                function fetchWithRetry() {
                    if (retryCount >= CONFIG.MAX_RETRIES) {
                        throw new Error(`Maximale Anzahl an Wiederholungsversuchen (${CONFIG.MAX_RETRIES}) erreicht.`);
                    }
                    
                    // Neuen AbortController für jeden Versuch erstellen
                    const controller = new AbortController();
                    const signal = controller.signal;
                    const fetchTimeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);
                    
                    // Aktualisiere den Ladestatus
                    if (retryCount > 0) {
                        loadingSubtext.textContent = `Wiederholungsversuch ${retryCount} von ${CONFIG.MAX_RETRIES}...`;
                        updateConnectionStatus(`Wiederhole (${retryCount}/${CONFIG.MAX_RETRIES})`, 'pending');
                    }
                    
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
                            error.message.includes('fetch') || // Fetch-Fehler
                            error.message.includes('connection') || // Verbindungsfehler
                            (error.message.includes('HTTP-Fehler') && [429, 500, 502, 503, 504].includes(parseInt(error.message.match(/\d+/)?.[0] || '0'))) // Server-Fehler
                        ) {
                            retryCount++;
                            console.log(`Wiederholungsversuch ${retryCount} von ${CONFIG.MAX_RETRIES}...`);
                            
                            // Exponentielles Backoff mit Jitter (zufällige Variation)
                            const baseDelay = CONFIG.RETRY_DELAY * Math.pow(2, retryCount - 1);
                            const jitter = Math.random() * 0.4 - 0.2; // -20% bis +20%
                            const delay = Math.min(baseDelay * (1 + jitter), 15000); // Max 15 Sekunden
                            
                            // Warte mit exponentiell steigender Verzögerung vor dem nächsten Versuch
                            return new Promise(resolve => setTimeout(resolve, delay))
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
                        
                        // Speichere den Cache in localStorage
                        saveCacheToStorage();
                        
                        // Bereinige den Cache
                        cleanupCache();
                        
                        // Aktualisiere den Verbindungsstatus
                        updateConnectionStatus('Erfolgreich geladen', 'success');
                        updateCacheStatus(`${dataCache.size} Einträge im Cache`);
                        
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
                            updateConnectionStatus('Zeitüberschreitung', 'error');
                        } else if (error.message.includes('Maximale Anzahl')) {
                            errorMsg = error.message + ' Bitte versuche es später erneut.';
                            updateConnectionStatus('Zu viele Versuche', 'error');
                        } else if (error.message.includes('HTTP-Fehler: 404')) {
                            errorMsg = 'Die angegebene Kleinanzeigen-URL wurde nicht gefunden. Bitte überprüfe die URL und versuche es erneut.';
                            updateConnectionStatus('Seite nicht gefunden', 'error');
                        } else if (error.message.includes('HTTP-Fehler: 403')) {
                            errorMsg = 'Der Zugriff auf diese Kleinanzeigen-URL wurde verweigert. Bitte versuche es später erneut.';
                            updateConnectionStatus('Zugriff verweigert', 'error');
                        } else if (error.message) {
                            errorMsg += ' ' + error.message;
                            updateConnectionStatus('Fehler', 'error');
                        }
                        
                        // Speichere den Fehler im Cache, um wiederholte Fehler zu vermeiden
                        const errorData = { error: true, message: errorMsg, timestamp: Date.now() };
                        dataCache.set(url, errorData);
                        
                        // Speichere den aktualisierten Cache
                        saveCacheToStorage();
                        
                        showError(errorMsg);
                        hideLoading();
                        clearTimeout(timeoutId);
                        isProcessing = false;
                    });
                return;
            }
            
            // Wenn keine gültige URL eingegeben wurde
            showError('Bitte gib eine gültige Kleinanzeigen-URL oder ein Stichwort wie "demo", "iphone", "sofa" oder "mountainbike" ein.');
            hideLoading();
            clearTimeout(timeoutId);
            isProcessing = false;
            updateConnectionStatus('Ungültige URL', 'error');
        } catch (error) {
            console.error('Unerwarteter Fehler:', error);
            showError('Ein unerwarteter Fehler ist aufgetreten: ' + error.message);
            hideLoading();
            clearTimeout(timeoutId);
            isProcessing = false;
            updateConnectionStatus('Fehler', 'error');
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
            
            // Speichere den aktualisierten Cache
            saveCacheToStorage();
            
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
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';
            
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
                this.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect width="200" height="200" fill="%23f5f5f5"/%3E%3Cpath d="M100 75 L75 125 L125 125 Z" fill="%23ccc"/%3E%3Ccircle cx="100" cy="65" r="10" fill="%23ccc"/%3E%3Ctext x="100" y="150" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%23999"%3EBild nicht verfügbar%3C/text%3E%3C/svg%3E';
                this.alt = 'Bild nicht verfügbar';
                this.classList.add('error');
                console.warn('Bild konnte nicht geladen werden:', imageUrl);
            };
            
            // Erfolgsbehandlung für Bilder
            img.onload = function() {
                if (this.src !== this.dataset.src) return; // Ignoriere das Laden des Platzhalters
                this.classList.add('loaded');
            };
            
            imageContainer.appendChild(img);
            
            // Aktionsbuttons hinzufügen
            const imageButtons = document.createElement('div');
            imageButtons.className = 'image-buttons';
            
            // Kopier-Button
            const copyButton = document.createElement('button');
            copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
            copyButton.title = 'Bild kopieren';
            copyButton.className = 'copy-image-button';
            copyButton.setAttribute('data-image-url', imageUrl);
            
            // Download-Button
            const downloadButton = document.createElement('button');
            downloadButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
            downloadButton.title = 'Bild herunterladen';
            downloadButton.className = 'download-image-button';
            downloadButton.setAttribute('data-image-url', imageUrl);
            
            // Wir verwenden Event-Delegation für alle Download-Buttons, daher kein direkter Event-Listener hier
            
            imageButtons.appendChild(copyButton);
            imageButtons.appendChild(downloadButton);
            imageContainer.appendChild(imageButtons);
            
            imagesContainer.appendChild(imageContainer);
            
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
    
    // UI-Hilfsfunktionen
    function showLoading() {
        loadingIndicator.classList.remove('hidden');
        loadingTimeElement.textContent = '0s';
        loadingSubtext.textContent = 'Verbinde...';
    }

    function hideLoading() {
        loadingIndicator.classList.add('hidden');
        if (loadingTimer) {
            clearTimeout(loadingTimer);
            loadingTimer = null;
        }
    }

    function showResults() {
        resultsContainer.classList.remove('hidden');
    }

    function hideResults() {
        resultsContainer.classList.add('hidden');
    }

    function showError(message) {
        errorText.textContent = message;
        errorContainer.classList.remove('hidden');
    }

    function hideError() {
        errorContainer.classList.add('hidden');
    }

    function clearResults() {
        titleResult.textContent = '';
        descriptionResult.textContent = '';
        priceResult.textContent = '';
        locationResult.textContent = '';
        imagesContainer.innerHTML = '';
        hideResults();
    }
    
    function resetUI() {
        // Ergebnisse zurücksetzen
        clearResults();
        
        // UI-Elemente zurücksetzen
        hideResults();
        hideError();
        hideLoading();
        updateConnectionStatus('Bereit', 'idle');
    }
    
    // Funktion zum Aktualisieren des Verbindungsstatus
    function updateConnectionStatus(message, status) {
        connectionStatus.textContent = message;
        
        // Entferne alle Status-Klassen
        connectionStatus.classList.remove('status-idle', 'status-pending', 'status-success', 'status-error');
        
        // Füge die entsprechende Klasse hinzu
        connectionStatus.classList.add('status-' + status);
    }
    
    // Funktion zum Aktualisieren des Cache-Status
    function updateCacheStatus(message) {
        cacheStatus.textContent = message;
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
        // Erstelle ein temporäres Canvas-Element
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        // Setze einen Timeout für den Fall, dass das Bild nicht geladen werden kann
        const timeout = setTimeout(() => {
            img.src = ''; // Abbrechen des Ladevorgangs
            copyToClipboard(imageUrl);
            console.log('Zeitüberschreitung beim Laden des Bildes, URL kopiert');
        }, 5000); // 5 Sekunden Timeout
        
        img.onload = function() {
            clearTimeout(timeout);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            // Versuche, das Bild als Blob zu kopieren
            canvas.toBlob(function(blob) {
                try {
                    // Moderne Methode mit Clipboard API
                    const item = new ClipboardItem({ 'image/png': blob });
                    navigator.clipboard.write([item])
                        .then(() => {
                            console.log('Bild wurde in die Zwischenablage kopiert');
                        })
                        .catch(err => {
                            console.error('Fehler beim Kopieren des Bildes:', err);
                            // Fallback: Kopiere die URL
                            copyToClipboard(imageUrl);
                        });
                } catch (error) {
                    console.error('ClipboardItem wird nicht unterstützt:', error);
                    // Fallback: Kopiere die URL
                    copyToClipboard(imageUrl);
                }
            }, 'image/png');
        };
        
        img.onerror = function() {
            clearTimeout(timeout);
            console.error('Fehler beim Laden des Bildes für die Zwischenablage');
            // Fallback: Kopiere die URL
            copyToClipboard(imageUrl);
        };
        
        img.src = imageUrl;
    }
});