/* =========================================================
   WYTE VAULT — OneSignal Web SDK wrapper
   Every direct OneSignal SDK call lives in this file. Nothing
   else in the app should reference `OneSignal` or
   `OneSignalDeferred` directly — go through WyteOneSignal.*.

   Scope note: this is the WEB SDK (browser push). For the
   Median.co-wrapped APK, native push is configured separately
   in Median's dashboard using the same App ID — see config.js.
   ========================================================= */
window.WyteOneSignal = (function () {
  "use strict";

  let ready = false;
  let readyCallbacks = [];

  function isConfigured() {
    const id = (window.WYTE_CONFIG || {}).ONESIGNAL_APP_ID;
    return !!id;
  }

  function init() {
    if (!isConfigured()) return; // no App ID set — stay inert
    if (!window.OneSignalDeferred) window.OneSignalDeferred = [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      await OneSignal.init({
        appId: window.WYTE_CONFIG.ONESIGNAL_APP_ID,
        // Scoped away from site root so this doesn't fight with our own
        // sw.js (offline caching) over the same scope.
        serviceWorkerPath: "assets/onesignal/OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/assets/onesignal/" }
      });
      ready = true;
      readyCallbacks.forEach((cb) => cb(OneSignal));
      readyCallbacks = [];
    });
  }

  function withSDK(callback) {
    if (!isConfigured()) return;
    if (!window.OneSignalDeferred) window.OneSignalDeferred = [];
    window.OneSignalDeferred.push(callback);
  }

  function requestPermission() {
    return new Promise((resolve) => {
      withSDK(async (OneSignal) => {
        try {
          const granted = await OneSignal.Notifications.requestPermission();
          resolve(!!granted);
        } catch (e) {
          resolve(false);
        }
      });
    });
  }

  function getPermissionStatus() {
    return new Promise((resolve) => {
      withSDK((OneSignal) => {
        try {
          resolve(OneSignal.Notifications.permission ? "granted" : "default");
        } catch (e) {
          resolve("unknown");
        }
      });
    });
  }

  // Optional: tie a OneSignal subscription to this vault if you ever add
  // real accounts. Not called anywhere yet — available for future use.
  function login(externalId) {
    withSDK((OneSignal) => OneSignal.login(externalId));
  }
  function logout() {
    withSDK((OneSignal) => OneSignal.logout());
  }

  return { init, isConfigured, requestPermission, getPermissionStatus, login, logout };
})();
