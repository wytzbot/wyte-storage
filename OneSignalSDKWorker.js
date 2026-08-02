// Required by OneSignal for web push delivery — must stay at this path,
// publicly accessible, served as application/javascript.
// Kept in its own subdirectory (not site root) on purpose: this app already
// has its own service worker (../../sw.js) for offline caching, and OneSignal
// recommends separate scopes over merging unless a single-file setup is required.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
