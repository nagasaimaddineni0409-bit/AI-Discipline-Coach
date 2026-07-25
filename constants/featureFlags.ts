import type { FeatureFlags } from '../types';

/** Version 1: premium & billing architected but disabled */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  aiInsights: true,
  adminPanel: true,
  premiumBilling: false,
  crashReporting: true,
};

export const PREMIUM_FEATURE_DEFAULTS = {
  subscriptionActive: false,
  features: {
    advancedAi: false,
    exportPdf: false,
    wearables: false,
  },
};
