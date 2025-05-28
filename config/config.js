// config/config.js
// config/config.js
import dotenv from "dotenv";
dotenv.config();

export const config = {
  server: {
    baseUrl: process.env.SERVER_BASE_URL || "http://localhost:5050",
  },
  app: {
    deepLinkScheme: process.env.DEEP_LINK_SCHEME || "sehaty",
  },
  paymob: {
    apiKey: process.env.PAYMOB_API_KEY || "your_paymob_api_key",
    iframeId: process.env.PAYMOB_IFRAME_ID || "your_iframe_id",
    integrationId: process.env.PAYMOB_INTEGRATION_ID || "your_integration_id",
    hmacSecret: process.env.PAYMOB_HMAC_SECRET || "your_hmac_secret",
    // Environment mode (test or production)
    mode: process.env.PAYMOB_MODE || "test",
    // Test mode configuration
    test: {
      apiKey: process.env.PAYMOB_TEST_API_KEY || "test_api_key",
      iframeId: process.env.PAYMOB_TEST_IFRAME_ID || "test_iframe_id",
      integrationId:
        process.env.PAYMOB_TEST_INTEGRATION_ID || "test_integration_id",
      hmacSecret: process.env.PAYMOB_TEST_HMAC_SECRET || "test_hmac_secret",
    },
    // Production mode configuration
    production: {
      apiKey: process.env.PAYMOB_PRODUCTION_API_KEY,
      iframeId: process.env.PAYMOB_PRODUCTION_IFRAME_ID,
      integrationId: process.env.PAYMOB_PRODUCTION_INTEGRATION_ID,
      hmacSecret: process.env.PAYMOB_PRODUCTION_HMAC_SECRET,
    },
  },

  // Database configuration
  database: {
    uri: process.env.MONGODB_URI || "mongodb+srv://youssefehab1222:4XXZn0r9gEIZiTfI@sehaty.uffzgjj.mongodb.net/?retryWrites=true&w=majority&appName=sehaty",
  },
};
