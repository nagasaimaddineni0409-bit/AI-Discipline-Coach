/**
 * Dynamic Expo config so EAS Build can inject google-services.json
 * via the GOOGLE_SERVICES_JSON file environment variable (gitignored locally).
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile ?? './google-services.json',
  },
});
