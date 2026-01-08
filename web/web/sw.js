const CACHE_NAME = 'pallicalc-smart-v14-manual';

// 1. CRITICAL FILES 
const CRITICAL_FILES = [
  './app.html', 
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 2. SECONDARY FILES 
const SECONDARY_FILES = [
  // Calculators
  './Opioid-calculator.html',
  './Infusion-dose-calculator.html', 
  './infusion-volume-calculator.html',

  // Guides & Resources
  './all-calculators.html',
  './healthcare-guidelines.html',
  './patient-education.html',
  './opioid-conversion-guide.html',
  './prn-calculation.html',
  './infusion-dose-guide.html',
  
  // Multi-language & PDFs
  './opioids-chinese.html',   
  './opioids-chinese.pdf',    
  './opioids-english.html',   
  './opioids-english.pdf',    
  './opioids-malay.html',     
  './opioids-malay.pdf',

  // External
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// 3. EXCLUSION LIST
const DO_NOT_CACHE = [
  'index.html', 'register.html', 'forgot-password.html', '/'
];

// --- HELPER: CLOUDFLARE CLEAN FETCH ---
// Used ONLY during installation to ensure files cache correctly
async function fetchClean(url) {
    if (url.endsWith('.html')) {
        try {
            const cleanUrl = url.slice(0, -5); 
            const cleanResponse = await fetch(cleanUrl);
            if (cleanResponse.ok) return cleanResponse;
        } catch (e) { /* Ignore */ }
    }
    return fetch(url);
}

// INSTALL
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('🚀 [SW] V14 Installing...');
      
      // Critical Files
      for (const file of CRITICAL_FILES) {
        try {
            const response = await fetchClean(file);
            if (!response.ok) throw new Error(`Status ${response.status}`);
            await cache.put(file, response);
        } catch (e) { 
            console.error(`❌ FATAL: ${file} failed.`);
            throw e; 
        }
      }

      // Secondary Files
      const downloadPromises = SECONDARY_FILES.map(async (file) => {
          try {
              const response = await fetchClean(file);
              if (response.ok) await cache.put(file, response);
          } catch (e) { console.warn('⚠️ Skipped:', file); }
      });
      await Promise.allSettled(downloadPromises);
      console.log('🎉 V14 Ready!');
    })
  );
  self.skipWaiting();
});

// ACTIVATE
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
    })))
  );
  self.clients.claim();
});

// FETCH (The Fix)
self.addEventListener('fetch', (event) => {
  // Ignore Google/Firebase
  if (event.request.url.includes('googleapis') || event.request.url.includes('firebase')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const url = new URL(event.request.url);

      // --- 1. EXCLUSION CHECK (index.html, register.html, etc.) ---
      // We want these to hit the network normally.
      const isExcluded = DO_NOT_CACHE.some(x => url.pathname.endsWith(x));

      if (isExcluded) {
          try {
              // THE FIX: We use redirect: 'manual'.
              // If Cloudflare sends a 308/301 Redirect, we pass it to the browser.
              // The browser handles it (Online behavior preserved).
              return await fetch(event.request, { redirect: 'manual' });
          } catch (error) {
              // OFFLINE FALLBACK
              // If the network fails entirely, we redirect to the App Dashboard.
              if (event.request.mode === 'navigate') {
                  // Loop Breaker check
                  if (url.searchParams.get('offline_mode')) return cache.match('./app.html');
                  
                  const appUrl = new URL('./app.html?offline_mode=true', self.location).href;
                  return Response.redirect(appUrl, 302);
              }
              return null;
          }
      }

      // --- 2. CACHED APP FILES ---
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) return cachedResponse;

      // --- 3. NETWORK FALLBACK (For non-excluded files) ---
      try {
        const networkResponse = await fetchClean(event.request.url);
        if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // Offline Fallback
        if (event.request.mode === 'navigate') {
             if (url.searchParams.get('offline_mode')) return cache.match('./app.html');
             const appUrl = new URL('./app.html?offline_mode=true', self.location).href;
             return Response.redirect(appUrl, 302);
        }
        return null;
      }
    })()
  );
});