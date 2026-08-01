/* =========================================================
   WYTE VAULT — centralized config
   Pricing lives here so it's never hardcoded elsewhere.
   Swap PRICING.region to add USD/GBP/etc later.
   ========================================================= */
window.WYTE_CONFIG = {
  PRICING: {
    region: "NG",
    currency: "NGN",
    currencySymbol: "₦",
    plan: "PRO_MONTHLY",
    monthlyPrice: 3500
  },

  // Firebase — client config is not secret (secured via Firebase Security
  // Rules, not by hiding this object). Currently only used if you wire up
  // analytics or cloud sync later; nothing in the core app calls this yet.
  FIREBASE: {
    apiKey: "AIzaSyBRp0jAxGaV8KbhXSLtDUi7LSspfJ9t-MM",
    authDomain: "tolunote-f74de.firebaseapp.com",
    projectId: "tolunote-f74de",
    storageBucket: "tolunote-f74de.firebasestorage.app",
    messagingSenderId: "124918638921",
    appId: "1:124918638921:web:281b10374b6c557d0b5298",
    measurementId: "G-77E59E2LT9"
  },

  // Where your payment provider should POST subscription/payment events.
  // Verify signatures server-side before trusting any event from this URL.
  PAYMENT_WEBHOOK_URL: "https://labguru-five.vercel.app/payments-webhook",

  // Fill in once you create a OneSignal app and wrap this PWA with Median.co.
  // Until then, notifications only work as in-browser Web Notifications
  // while the app/tab is open — not as real device push.
  ONESIGNAL_APP_ID: ""
};
