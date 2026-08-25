import {
  API_BASE_URL as ENV_API_BASE_URL,
  STRIPE_PUBLISHABLE_KEY as ENV_STRIPE_PUBLISHABLE_KEY,
} from '@env';

const FALLBACK_API_BASE_URL =
  'https://phpstack-1542257-6177868.cloudwaysapps.com/api';

export const API_BASE_URL = ENV_API_BASE_URL || FALLBACK_API_BASE_URL;

export const STRIPE_PUBLISHABLE_KEY = ENV_STRIPE_PUBLISHABLE_KEY || '';

export const BASE_URL = String(API_BASE_URL).replace(/\/api\/?$/, '');
