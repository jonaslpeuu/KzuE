document.addEventListener('DOMContentLoaded', function() {
    // DOM-Elemente
    const urlInput = document.getElementById('kleinanzeigen-url');
    const extractButton = document.getElementById('extract-button');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsContainer = document.getElementById('results-container');
    const titleContent = document.getElementById('title-content');
    const descriptionContent = document.getElementById('description-content');
    const imagesContainer = document.getElementById('images-container');
    const errorMessage = document.getElementById('error-message');

    // Event-Listener für den Extract-Button
    extractButton.addEventListener('click', function() {
        const url = urlInput.value.trim();
        
        // Überprüfen, ob die URL gültig ist
        if (!url || !isValidKleinanzeigenUrl(url)) {
            showError('Bitte gib eine gültige Kleinanzeigen-URL ein.');
            return;
        }
        
        // Starte den Extraktionsprozess
        extractDataFromUrl(url);
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

    // Funktion zur Überprüfung der URL
    function isValidKleinanzeigenUrl(url) {
        return url.includes('kleinanzeigen.de');
    }

    // Funktion zum Extrahieren der Daten
    function extractDataFromUrl(url) {
        // UI-Status aktualisieren
        showLoading();
        hideError();
        clearResults();
        
        // Wenn Demo-Modus aktiviert ist
        if (url.includes('demo')) {
            // Simuliere Ladezeit für bessere Benutzererfahrung
            setTimeout(() => {
                // Zeige Demo-Daten an
                showDemoData(url);
            }, 1000);
            return;
        }
        
        // Wenn es eine echte Kleinanzeigen-URL ist
        if (url.includes('kleinanzeigen.de')) {
            // API-Anfrage an den Backend-Server senden
            fetch(`/api/extract?url=${encodeURIComponent(url)}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Netzwerkantwort war nicht ok');
                    }
                    return response.json();
                })
                .then(data => {
                    // Daten in der UI anzeigen
                    titleContent.textContent = data.title;
                    descriptionContent.textContent = data.description;
                    
                    // Bilder anzeigen
                    if (data.images && data.images.length > 0) {
                        data.images.forEach(imageUrl => {
                            addImageToContainer(imageUrl);
                        });
                    }
                    
                    hideLoading();
                    showResults();
                })
                .catch(error => {
                    console.error('Fehler beim Abrufen der Daten:', error);
                    showError('Fehler beim Abrufen der Daten. Bitte überprüfe die URL und stelle sicher, dass der Server läuft.');
                    hideLoading();
                });
            return;
        }
        
        // Wenn keine gültige URL eingegeben wurde
        showError('Bitte gib eine gültige Kleinanzeigen-URL oder "demo" ein.');
        hideLoading();
    }

    // Funktion zum Anzeigen von Demo-Daten (für Testzwecke)
    function showDemoData(url) {
        // Hinweis anzeigen, dass Demo-Daten angezeigt werden
        const demoNotice = document.createElement('div');
        demoNotice.className = 'demo-notice';
        demoNotice.innerHTML = '<strong>Hinweis:</strong> Du siehst gerade Demo-Daten. ' +
            'Für echte Daten gib bitte eine vollständige Kleinanzeigen-URL ein.';
        
        // Demo-Daten basierend auf der URL
        let title, description, demoImages;
        
        // Verschiedene Demo-Daten je nach URL
        if (url.includes('iphone') || url.includes('smartphone')) {
            title = 'iPhone 13 Pro Max - 256GB - Graphit - Wie neu';
            description = 'Verkaufe mein iPhone 13 Pro Max mit 256GB in der Farbe Graphit. ' +
                'Das Gerät ist in einem sehr guten Zustand, ohne Kratzer oder Dellen. ' +
                'Originalverpackung, Ladekabel und Originalrechnung sind vorhanden. ' +
                'Akku-Gesundheit liegt bei 92%. ' +
                'Versand möglich oder Abholung in München.';
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
            demoImages = [
                'https://i.ebayimg.com/00/s/MTYwMFgxMjAw/z/DL8AAOSwLwBkpCpb/$_59.JPG',
                'https://i.ebayimg.com/00/s/MTYwMFgxMjAw/z/DL8AAOSwLwBkpCpb/$_59.JPG'
            ];
        }
        
        // Daten in der UI anzeigen
        titleContent.textContent = title;
        descriptionContent.textContent = description;
        
        // Demo-Hinweis vor den Ergebnissen einfügen
        resultsContainer.insertBefore(demoNotice, resultsContainer.firstChild);
        
        // Bilder anzeigen
        demoImages.forEach(imageUrl => {
            addImageToContainer(imageUrl);
        });
        
        hideLoading();
        showResults();
    }

    // Funktion zum Hinzufügen eines Bildes zum Container
    function addImageToContainer(imageUrl) {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Produktbild';
        
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-image-button';
        copyButton.textContent = 'Kopieren';
        copyButton.setAttribute('data-image-url', imageUrl);
        
        imageItem.appendChild(img);
        imageItem.appendChild(copyButton);
        imagesContainer.appendChild(imageItem);
    }

    // Hilfsfunktionen für die UI
    function showLoading() {
        loadingIndicator.style.display = 'block';
    }

    function hideLoading() {
        loadingIndicator.style.display = 'none';
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

    // Funktion zum Kopieren von Text in die Zwischenablage
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
            .catch(err => {
                console.error('Fehler beim Kopieren in die Zwischenablage:', err);
            });
    }

    // Funktion zum Kopieren eines Bildes in die Zwischenablage
    // Hinweis: Das direkte Kopieren von Bildern in die Zwischenablage ist komplex
    // und nicht in allen Browsern einheitlich unterstützt
    function copyImageToClipboard(imageUrl) {
        // Für eine einfache Implementierung kopieren wir nur die Bild-URL
        navigator.clipboard.writeText(imageUrl)
            .catch(err => {
                console.error('Fehler beim Kopieren der Bild-URL:', err);
            });
        
        // Eine fortgeschrittenere Implementierung könnte das Bild herunterladen
        // und als Blob in die Zwischenablage kopieren, was jedoch komplexer ist
    }
});