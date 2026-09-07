import crypto from 'crypto';
import { env } from './loadEnv.js';

const BASE_URL = env('EPS_BASE_URL', 'https://pgapi.eps.com.bd/v1').replace(/\/+$/, '');
const USERNAME = env('EPS_USERNAME', '');
const PASSWORD = env('EPS_PASSWORD', '');
const HASH_KEY = env('EPS_HASH_KEY', '');
const MERCHANT_ID = env('EPS_MERCHANT_ID', '');
const STORE_ID = env('EPS_STORE_ID', '');
const TRANSACTION_TYPE_ID = Number(env('EPS_TRANSACTION_TYPE_ID', '1'));
const IPN_SECRET_KEY = env('EPS_IPN_SECRET_KEY', '');

const PLACEHOLDERS = [
  'your_eps_merchant_username',
  'your_eps_merchant_password',
  'your_eps_hash_key_base64',
  'your-merchant-uuid',
  'your-store-uuid',
];

export function isConfigured() {
  return [USERNAME, PASSWORD, HASH_KEY, MERCHANT_ID, STORE_ID].every(
    (v) => v && !PLACEHOLDERS.includes(v)
  );
}

export function makeHash(message) {
  return crypto.createHmac('sha512', HASH_KEY).update(String(message), 'utf8').digest('base64');
}

let tokenCache = { token: null, exp: 0 };
let tokenPromise = null;

function invalidateToken() {
  tokenCache = { token: null, exp: 0 };
}

async function fetchToken() {
  const now = Date.now();
  const res = await fetch(`${BASE_URL}/Auth/GetToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hash': makeHash(USERNAME) },
    body: JSON.stringify({ userName: USERNAME, password: PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    throw new Error(`EPS GetToken failed: ${data.errorMessage || `HTTP ${res.status}`}`);
  }
  const raw = String(data.expireDate || '');
  const iso = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`;
  const parsedExp = raw ? new Date(iso).getTime() : NaN;
  const exp = Math.min(
    Number.isFinite(parsedExp) ? parsedExp : now + 10 * 60_000,
    now + 30 * 60_000
  );
  tokenCache = { token: data.token, exp };
  return tokenCache.token;
}

export async function getToken({ force = false } = {}) {
  const now = Date.now();
  if (!force && tokenCache.token && now < tokenCache.exp - 60_000) return tokenCache.token;
  if (!tokenPromise) tokenPromise = fetchToken().finally(() => { tokenPromise = null; });
  return tokenPromise;
}

async function authedRequest(makeRequest) {
  let res = await makeRequest(await getToken());
  if ([401, 403, 404].includes(res.status)) {
    invalidateToken();
    res = await makeRequest(await getToken({ force: true }));
  }
  return res;
}

function epsErrorMessage(data, status) {
  if (!data || typeof data !== 'object') return `HTTP ${status}`;
  if (data.ErrorMessage) return data.ErrorMessage;
  if (data.errorMessage) return data.errorMessage;
  if (data.Message) return data.Message;
  if (data.title && data.errors) {
    const details = Object.entries(data.errors)
      .map(([field, msgs]) => `${field}: ${[].concat(msgs).join(', ')}`)
      .join('; ');
    return details || data.title;
  }
  if (data.title) return data.title;
  return `HTTP ${status}`;
}

export async function initializePayment(params) {
  const amount = Number(Number(params.totalAmount).toFixed(2));
  const ip = sanitizeIp(params.ipAddress);
  const body = {
    merchantId: MERCHANT_ID,
    storeId: STORE_ID,
    CustomerOrderId: String(params.customerOrderId).slice(0, 40),
    merchantTransactionId: String(params.merchantTransactionId),
    transactionTypeId: TRANSACTION_TYPE_ID,
    financialEntityId: 0,
    transitionStatusId: 0,
    totalAmount: amount,
    version: '1',
    ipAddress: ip,
    successUrl: params.successUrl,
    failUrl: params.failUrl,
    cancelUrl: params.cancelUrl,
    customerName: params.customerName || 'Student',
    customerEmail: params.customerEmail || 'student@example.com',
    CustomerAddress: params.customerAddress || 'N/A',
    CustomerAddress2: '',
    CustomerCity: params.customerCity || 'Dhaka',
    CustomerState: params.customerState || 'Dhaka',
    CustomerPostcode: params.customerPostcode || '1200',
    CustomerCountry: params.customerCountry || 'BD',
    CustomerPhone: sanitizePhone(params.customerPhone),
    ShippingMethod: 'NO',
    NoOfItem: '1',
    ProductName: String(params.productName || 'Course purchase').slice(0, 80),
    ProductProfile: 'general',
    ProductCategory: 'general',
    ProductList: [],
  };

  const res = await authedRequest((token) =>
    fetch(`${BASE_URL}/EPSEngine/InitializeEPS`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hash': makeHash(params.merchantTransactionId),
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.RedirectURL) {
    const detail = epsErrorMessage(data, res.status);
    console.error('[EPS] InitializeEPS rejected:', res.status, JSON.stringify(data));
    throw new Error(`EPS InitializeEPS failed: ${detail}`);
  }
  return { transactionId: data.TransactionId, redirectUrl: data.RedirectURL };
}

function sanitizeIp(value) {
  let ip = String(value || '').trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (!ip || ip === '::1' || ip.includes(':')) return '0.0.0.0';
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return '0.0.0.0';
  return ip;
}

function sanitizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^01\d{9}$/.test(digits)) return digits;
  if (/^8801\d{9}$/.test(digits)) return digits.slice(2);
  return '01700000000';
}

export async function verifyTransaction({ merchantTransactionId, epsTransactionId } = {}) {
  const qs = new URLSearchParams();
  if (merchantTransactionId) qs.set('merchantTransactionId', merchantTransactionId);
  if (epsTransactionId) qs.set('EPSTransactionId', epsTransactionId);
  const hashMsg = merchantTransactionId || epsTransactionId;

  const res = await authedRequest((token) =>
    fetch(`${BASE_URL}/EPSEngine/CheckMerchantTransactionStatus?${qs.toString()}`, {
      method: 'GET',
      headers: { 'x-hash': makeHash(hashMsg), Authorization: `Bearer ${token}` },
    })
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`EPS verify failed: ${data.ErrorMessage || `HTTP ${res.status}`}`);
  return data;
}

function normalizeKey(key) {
  let kb = Buffer.from(String(key), 'utf8');
  if (kb.length > 32) kb = kb.subarray(0, 32);
  else if (kb.length < 32) kb = Buffer.concat([kb, Buffer.alloc(32 - kb.length)]);
  return kb;
}

export function isIpnConfigured() {
  return Boolean(IPN_SECRET_KEY && IPN_SECRET_KEY !== 'your_eps_ipn_secret_key');
}

export function decryptIpn(data) {
  const parts = String(data).split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted data format');
  const iv = Buffer.from(parts[0], 'base64');
  const cipherText = Buffer.from(parts[1], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', normalizeKey(IPN_SECRET_KEY), iv);
  decipher.setAutoPadding(true);
  return decipher.update(cipherText, undefined, 'utf8') + decipher.final('utf8');
}

export { TRANSACTION_TYPE_ID };
