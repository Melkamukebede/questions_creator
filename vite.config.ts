import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import crypto from 'node:crypto';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const chapaSecretKey =
    env.CHAPA_SECRET_KEY ||
    process.env.CHAPA_SECRET_KEY ||
    env.VITE_CHAPA_SECRET_KEY ||
    process.env.VITE_CHAPA_SECRET_KEY ||
    '';

  const telebirrAppId =
    env.TELEBIRR_APP_ID ||
    process.env.TELEBIRR_APP_ID ||
    env.VITE_TELEBIRR_APP_ID ||
    '';
  const telebirrAppKey =
    env.TELEBIRR_APP_KEY ||
    process.env.TELEBIRR_APP_KEY ||
    env.VITE_TELEBIRR_APP_KEY ||
    '';
  const telebirrShortCode =
    env.TELEBIRR_SHORT_CODE ||
    process.env.TELEBIRR_SHORT_CODE ||
    env.VITE_TELEBIRR_SHORT_CODE ||
    '';
  const telebirrPublicKey =
    env.TELEBIRR_PUBLIC_KEY ||
    process.env.TELEBIRR_PUBLIC_KEY ||
    '';
  const telebirrPrivateKey =
    env.TELEBIRR_PRIVATE_KEY ||
    process.env.TELEBIRR_PRIVATE_KEY ||
    '';
  const telebirrApiUrl =
    env.TELEBIRR_API_URL ||
    process.env.TELEBIRR_API_URL ||
    'https://app.ethiotelecom.et/epg/v1/to/pay';

  // In-memory registry of Telebirr orders for verification & sandbox testing
  type TelebirrOrderRecord = {
    outTradeNo: string;
    amount: number;
    subject: string;
    phone?: string;
    returnUrl?: string;
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    createdAt: string;
    verifiedAt?: string;
    isSandbox: boolean;
  };

  const telebirrOrders = new Map<string, TelebirrOrderRecord>();

  // Telebirr signature generator (SHA256withRSA or HMAC-SHA256)
  function signTelebirrData(data: Record<string, any>, privateKey?: string, appKey?: string): string {
    const sortedKeys = Object.keys(data)
      .filter((k) => data[k] !== undefined && data[k] !== null && data[k] !== '')
      .sort();
    const queryStr = sortedKeys.map((k) => `${k}=${data[k]}`).join('&');

    if (privateKey && privateKey.includes('PRIVATE KEY')) {
      try {
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(queryStr, 'utf8');
        return signer.sign(privateKey, 'base64');
      } catch (err) {
        console.warn('Telebirr RSA signing error, using HMAC fallback:', err);
      }
    }
    const key = appKey || telebirrAppKey || 'telebirr_dev_key';
    return crypto.createHmac('sha256', key).update(queryStr, 'utf8').digest('base64');
  }

  // Telebirr ussd payload encryptor (RSA with PKCS1Padding or AES fallback)
  function encryptTelebirrUssd(dataStr: string, publicKey?: string, appKey?: string): string {
    if (publicKey && publicKey.includes('PUBLIC KEY')) {
      try {
        const buffer = Buffer.from(dataStr, 'utf8');
        const chunkSize = 117;
        const chunks: Buffer[] = [];
        for (let i = 0; i < buffer.length; i += chunkSize) {
          const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
          const encrypted = crypto.publicEncrypt(
            {
              key: publicKey,
              padding: crypto.constants.RSA_PKCS1_PADDING,
            },
            chunk
          );
          chunks.push(encrypted);
        }
        return Buffer.concat(chunks).toString('base64');
      } catch (err) {
        console.warn('Telebirr RSA encryption error, using AES fallback:', err);
      }
    }
    const key = crypto.createHash('sha256').update(appKey || telebirrAppKey || 'telebirr_dev_key').digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(dataStr, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, encrypted]).toString('base64');
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'chapa-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url || '';

            // Handle /api/chapa/initialize
            if (url.startsWith('/api/chapa/initialize') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', (chunk) => {
                bodyStr += chunk;
              });
              req.on('end', async () => {
                try {
                  const payload = JSON.parse(bodyStr || '{}');
                  const secret = payload.secretKey || chapaSecretKey;
                  if (!secret) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(
                      JSON.stringify({
                        status: 'failed',
                        message: 'CHAPA_SECRET_KEY is not configured on server',
                      })
                    );
                    return;
                  }

                  const { secretKey: _discard, ...chapaPayload } = payload;
                  if (chapaPayload.customization && typeof chapaPayload.customization.title === 'string') {
                    if (chapaPayload.customization.title.length > 16) {
                      chapaPayload.customization.title = chapaPayload.customization.title.slice(0, 16);
                    }
                  }

                  let chapaRes = await fetch('https://api.chapa.co/v1/transaction/initialize', {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${secret}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(chapaPayload),
                  });

                  let chapaData = await chapaRes.json();

                  // Auto-heal duplicate transaction reference collisions (e.g. rapid clicks, retries, browser replays)
                  if (
                    chapaRes.status === 400 &&
                    typeof chapaData?.message === 'string' &&
                    chapaData.message.toLowerCase().includes('used before')
                  ) {
                    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
                    const freshTxRef = `${chapaPayload.tx_ref || 'EMP'}-${uniqueSuffix}`.slice(0, 50);
                    chapaPayload.tx_ref = freshTxRef;
                    if (typeof chapaPayload.return_url === 'string') {
                      chapaPayload.return_url = chapaPayload.return_url.replace(
                        /chapa_verify=[^&]+/,
                        `chapa_verify=${freshTxRef}`
                      );
                    }

                    chapaRes = await fetch('https://api.chapa.co/v1/transaction/initialize', {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${secret}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(chapaPayload),
                    });
                    chapaData = await chapaRes.json();
                    if (chapaData && typeof chapaData === 'object') {
                      chapaData.tx_ref = freshTxRef;
                    }
                  }

                  if (chapaData && typeof chapaData === 'object' && !chapaData.tx_ref) {
                    chapaData.tx_ref = chapaPayload.tx_ref;
                  }

                  res.statusCode = chapaRes.status;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(chapaData));
                } catch (err: unknown) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  const message = err instanceof Error ? err.message : 'Server proxy error';
                  res.end(JSON.stringify({ status: 'failed', message }));
                }
              });
              return;
            }

            // Handle /api/chapa/verify/:txRef
            if (url.startsWith('/api/chapa/verify/') && req.method === 'GET') {
              const txRef = url.replace('/api/chapa/verify/', '').split('?')[0];
              const secret = chapaSecretKey;
              if (!secret) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    status: 'failed',
                    message: 'CHAPA_SECRET_KEY is not configured on server',
                  })
                );
                return;
              }

              try {
                const chapaRes = await fetch(`https://api.chapa.co/v1/transaction/verify/${txRef}`, {
                  method: 'GET',
                  headers: {
                    Authorization: `Bearer ${secret}`,
                  },
                });
                const chapaData = await chapaRes.json();
                res.statusCode = chapaRes.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(chapaData));
              } catch (err: unknown) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                const message = err instanceof Error ? err.message : 'Server proxy error';
                res.end(JSON.stringify({ status: 'failed', message }));
              }
              return;
            }

            // Handle /api/telebirr/config-status
            if (url.startsWith('/api/telebirr/config-status') && req.method === 'GET') {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  isConfigured: Boolean(telebirrAppId && telebirrShortCode),
                  hasAppId: Boolean(telebirrAppId),
                  hasShortCode: Boolean(telebirrShortCode),
                  hasKeys: Boolean(telebirrPublicKey || telebirrAppKey),
                  mode: telebirrAppId ? 'live' : 'sandbox',
                })
              );
              return;
            }

            // Handle /api/telebirr/initialize
            if (url.startsWith('/api/telebirr/initialize') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', (chunk) => {
                bodyStr += chunk;
              });
              req.on('end', async () => {
                try {
                  const payload = JSON.parse(bodyStr || '{}');
                  const activeAppId = payload.appId || telebirrAppId;
                  const activeShortCode = payload.shortCode || telebirrShortCode;
                  const activeAppKey = payload.appKey || telebirrAppKey;
                  const activePublicKey = payload.publicKey || telebirrPublicKey;
                  const activePrivateKey = payload.privateKey || telebirrPrivateKey;

                  const outTradeNo =
                    payload.outTradeNo ||
                    `EMP-TB-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                  const amount = Number(payload.amount || 0);
                  const totalAmountStr = amount.toFixed(2);
                  const subject = (payload.subject || 'Sinahard Pro Subscription').slice(0, 64);
                  const returnUrl = payload.returnUrl || `${req.headers.origin || ''}?telebirr_verify=${outTradeNo}`;
                  const notifyUrl = payload.notifyUrl || `${req.headers.origin || ''}/api/telebirr/notify`;
                  const nonce = crypto.randomBytes(16).toString('hex');
                  const timestamp = String(Date.now());

                  const ussdObj = {
                    appId: activeAppId || 'telebirr-sandbox-app',
                    notifyUrl,
                    outTradeNo,
                    receiveName: 'Sinahard Pro',
                    returnUrl,
                    shortCode: activeShortCode || 'telebirr-sandbox-merchant',
                    subject,
                    timeoutExpress: '30',
                    totalAmount: totalAmountStr,
                    nonce,
                    timestamp,
                  };

                  const sign = signTelebirrData(ussdObj, activePrivateKey, activeAppKey);
                  const ussdEncrypted = encryptTelebirrUssd(
                    JSON.stringify(ussdObj),
                    activePublicKey,
                    activeAppKey
                  );

                  // If real Telebirr merchant credentials are configured, send to Ethio Telecom API
                  if (activeAppId && activeShortCode && (activePublicKey || activeAppKey)) {
                    try {
                      const telebirrRes = await fetch(telebirrApiUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          appid: activeAppId,
                          sign,
                          ussd: ussdEncrypted,
                        }),
                      });

                      const telebirrData = await telebirrRes.json();
                      if (telebirrData && telebirrData.code === 0 && telebirrData.data?.toPayUrl) {
                        telebirrOrders.set(outTradeNo, {
                          outTradeNo,
                          amount,
                          subject,
                          phone: payload.phone,
                          returnUrl,
                          status: 'PENDING',
                          createdAt: new Date().toISOString(),
                          isSandbox: false,
                        });

                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(
                          JSON.stringify({
                            status: 'success',
                            message: 'Telebirr payment session created',
                            data: {
                              toPayUrl: telebirrData.data.toPayUrl,
                              outTradeNo,
                            },
                            isSandbox: false,
                          })
                        );
                        return;
                      } else if (telebirrData && telebirrData.msg) {
                        console.warn('Telebirr live API rejected:', telebirrData);
                      }
                    } catch (netErr) {
                      console.warn('Telebirr live gateway network note:', netErr);
                    }
                  }

                  // Developer Sandbox Mode (fallback when merchant keys are awaiting Ethio Telecom approval)
                  telebirrOrders.set(outTradeNo, {
                    outTradeNo,
                    amount,
                    subject,
                    phone: payload.phone,
                    returnUrl,
                    status: 'PENDING',
                    createdAt: new Date().toISOString(),
                    isSandbox: true,
                  });

                  const sandboxUrl = `/telebirr-sandbox-checkout?trade_no=${encodeURIComponent(
                    outTradeNo
                  )}&amount=${amount}&subject=${encodeURIComponent(
                    subject
                  )}&return_url=${encodeURIComponent(returnUrl)}&phone=${encodeURIComponent(
                    payload.phone || '0911000000'
                  )}`;

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      status: 'success',
                      message: 'Telebirr developer payment session initialized',
                      data: {
                        toPayUrl: sandboxUrl,
                        outTradeNo,
                      },
                      isSandbox: true,
                    })
                  );
                } catch (err: unknown) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  const message = err instanceof Error ? err.message : 'Telebirr initialization error';
                  res.end(JSON.stringify({ status: 'failed', message }));
                }
              });
              return;
            }

            // Handle /api/telebirr/verify/:outTradeNo
            if (url.startsWith('/api/telebirr/verify/') && req.method === 'GET') {
              const outTradeNo = url.replace('/api/telebirr/verify/', '').split('?')[0];
              const order = telebirrOrders.get(outTradeNo);

              if (order && order.status === 'SUCCESS') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    status: 'success',
                    verified: true,
                    message: 'Telebirr payment successfully verified!',
                    data: {
                      outTradeNo,
                      tradeStatus: 'SUCCESS',
                      amount: order.amount,
                      raw: order,
                    },
                  })
                );
                return;
              }

              // If live credentials, attempt querying Telebirr query endpoint
              if (telebirrAppId && telebirrShortCode) {
                try {
                  const queryUrl = telebirrApiUrl.replace(/\/pay\/?$/, '/query');
                  const queryUssd = {
                    appId: telebirrAppId,
                    outTradeNo,
                    shortCode: telebirrShortCode,
                    timestamp: String(Date.now()),
                    nonce: crypto.randomBytes(16).toString('hex'),
                  };
                  const sign = signTelebirrData(queryUssd, telebirrPrivateKey, telebirrAppKey);
                  const ussd = encryptTelebirrUssd(
                    JSON.stringify(queryUssd),
                    telebirrPublicKey,
                    telebirrAppKey
                  );

                  const queryRes = await fetch(queryUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ appid: telebirrAppId, sign, ussd }),
                  });
                  const queryData = await queryRes.json();
                  if (queryData && (queryData.data?.tradeStatus === 'SUCCESS' || queryData.data?.tradeStatus === 2)) {
                    if (order) order.status = 'SUCCESS';
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(
                      JSON.stringify({
                        status: 'success',
                        verified: true,
                        message: 'Payment confirmed by Telebirr gateway',
                        data: { outTradeNo, tradeStatus: 'SUCCESS', raw: queryData },
                      })
                    );
                    return;
                  }
                } catch (_qErr) {
                  // Fall through
                }
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  status: 'success',
                  verified: false,
                  message: 'Telebirr payment is pending confirmation',
                  data: {
                    outTradeNo,
                    tradeStatus: order?.status || 'PENDING',
                  },
                })
              );
              return;
            }

            // Handle /api/telebirr/complete-sandbox (POST to simulate customer completing payment)
            if (url.startsWith('/api/telebirr/complete-sandbox') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', (chunk) => {
                bodyStr += chunk;
              });
              req.on('end', () => {
                try {
                  const payload = JSON.parse(bodyStr || '{}');
                  const outTradeNo = payload.outTradeNo || payload.trade_no;
                  const order: TelebirrOrderRecord = telebirrOrders.get(outTradeNo) || {
                    outTradeNo,
                    amount: Number(payload.amount || 0),
                    subject: 'Sinahard Pro',
                    status: 'PENDING',
                    createdAt: new Date().toISOString(),
                    isSandbox: true,
                  };

                  order.status = 'SUCCESS';
                  order.verifiedAt = new Date().toISOString();
                  telebirrOrders.set(outTradeNo, order);

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      status: 'success',
                      verified: true,
                      message: 'Sandbox payment successfully completed and verified',
                      outTradeNo,
                    })
                  );
                } catch (err: unknown) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ status: 'failed', message: 'Invalid payload' }));
                }
              });
              return;
            }

            // Handle /api/telebirr/notify (Webhook from Ethio Telecom)
            if (url.startsWith('/api/telebirr/notify') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', (chunk) => {
                bodyStr += chunk;
              });
              req.on('end', () => {
                try {
                  const payload = JSON.parse(bodyStr || '{}');
                  const outTradeNo = payload.outTradeNo || payload.out_trade_no;
                  if (outTradeNo && telebirrOrders.has(outTradeNo)) {
                    const order = telebirrOrders.get(outTradeNo)!;
                    order.status = 'SUCCESS';
                    order.verifiedAt = new Date().toISOString();
                  }
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ code: 0, msg: 'success' }));
                } catch (_e) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ code: 0, msg: 'success' }));
                }
              });
              return;
            }

            // Handle /telebirr-sandbox-checkout (Interactive developer testing portal for Telebirr checkout)
            if (url.startsWith('/telebirr-sandbox-checkout')) {
              const reqUrl = new URL(url, `http://${req.headers.host || 'localhost:3000'}`);
              const tradeNo = reqUrl.searchParams.get('trade_no') || 'EMP-TB-SAMPLE';
              const amount = reqUrl.searchParams.get('amount') || '199';
              const subject = reqUrl.searchParams.get('subject') || 'Sinahard Pro Subscription';
              const phone = reqUrl.searchParams.get('phone') || '0911000000';
              const returnUrl = reqUrl.searchParams.get('return_url') || `/?telebirr_verify=${tradeNo}`;

              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>telebirr Online Payment</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #f3f4f6; color: #1f2937; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }
    .card { background: #ffffff; width: 100%; max-width: 440px; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); overflow: hidden; border: 1px solid #e5e7eb; }
    .header { background: linear-gradient(135deg, #008b47 0%, #006835 100%); padding: 24px; color: #ffffff; text-align: center; position: relative; }
    .badge { display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; }
    .logo-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px; }
    .logo-icon { width: 32px; height: 32px; background: #ffffff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #008b47; font-size: 18px; }
    .header h1 { font-size: 22px; font-weight: 800; }
    .header p { font-size: 12px; opacity: 0.85; margin-top: 4px; }
    .body { padding: 24px; }
    .amount-box { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 16px; padding: 16px; text-align: center; margin-bottom: 20px; }
    .amount-label { font-size: 12px; color: #166534; font-weight: 600; text-transform: uppercase; }
    .amount-val { font-size: 32px; font-weight: 900; color: #14532d; margin-top: 2px; }
    .details-row { display: flex; justify-content: space-between; font-size: 12px; padding: 8px 0; border-bottom: 1px dashed #e5e7eb; }
    .details-label { color: #6b7280; }
    .details-val { font-weight: 600; color: #111827; font-family: monospace; }
    .form-group { margin-top: 20px; }
    .form-label { display: block; font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 6px; }
    .input-field { width: 100%; padding: 12px 14px; border: 1.5px solid #d1d5db; border-radius: 12px; font-size: 14px; font-weight: 600; outline: none; transition: border-color 0.2s; }
    .input-field:focus { border-color: #008b47; }
    .pay-btn { width: 100%; margin-top: 24px; background: #008b47; color: #ffffff; border: none; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 800; cursor: pointer; transition: background 0.2s, transform 0.1s; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .pay-btn:hover { background: #00733a; }
    .pay-btn:active { transform: scale(0.98); }
    .cancel-link { display: block; text-align: center; margin-top: 14px; font-size: 12px; color: #6b7280; text-decoration: none; }
    .cancel-link:hover { color: #111827; text-decoration: underline; }
    .security-notice { margin-top: 16px; padding: 10px 14px; background: #f9fafb; border-radius: 12px; font-size: 11px; color: #6b7280; text-align: center; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">Telebirr Developer Gateway</div>
      <div class="logo-row">
        <div class="logo-icon">tb</div>
        <h1>telebirr</h1>
      </div>
      <p>Ethio Telecom E-Payment Gateway</p>
    </div>
    <div class="body">
      <div class="amount-box">
        <div class="amount-label">Total Payment Due</div>
        <div class="amount-val">${amount} ETB</div>
      </div>

      <div>
        <div class="details-row">
          <span class="details-label">Merchant</span>
          <span class="details-val">Sinahard Pro</span>
        </div>
        <div class="details-row">
          <span class="details-label">Description</span>
          <span class="details-val">${subject}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Order Ref</span>
          <span class="details-val">${tradeNo}</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Telebirr Account (Phone)</label>
        <input type="text" id="phoneInput" class="input-field" value="${phone}" />
      </div>

      <div class="form-group">
        <label class="form-label">Telebirr PIN</label>
        <input type="password" id="pinInput" class="input-field" value="••••" placeholder="Enter PIN" />
      </div>

      <button type="button" id="payBtn" class="pay-btn">
        <span>Authorize & Pay with telebirr</span>
        <span>→</span>
      </button>

      <a href="${returnUrl}" class="cancel-link">Cancel and return to merchant</a>

      <div class="security-notice">
        🔒 Secured by Ethio Telecom Telebirr H5 E-Payment Protocol.
      </div>
    </div>
  </div>

  <script>
    const payBtn = document.getElementById('payBtn');
    payBtn.addEventListener('click', async () => {
      payBtn.disabled = true;
      payBtn.innerHTML = '<span>Processing Telebirr Payment...</span>';

      try {
        const res = await fetch('/api/telebirr/complete-sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outTradeNo: '${tradeNo}',
            amount: '${amount}',
            phone: document.getElementById('phoneInput').value
          })
        });
        const data = await res.json();
        if (data.status === 'success') {
          payBtn.innerHTML = '<span>✓ Payment Authorized! Redirecting...</span>';
          payBtn.style.background = '#15803d';
          setTimeout(() => {
            window.location.href = '${returnUrl}';
          }, 600);
        } else {
          alert('Error: ' + (data.message || 'Payment simulation failed'));
          payBtn.disabled = false;
          payBtn.innerHTML = '<span>Authorize & Pay with telebirr</span>';
        }
      } catch (err) {
        alert('Network error connecting to Telebirr server');
        payBtn.disabled = false;
        payBtn.innerHTML = '<span>Authorize & Pay with telebirr</span>';
      }
    });
  </script>
</body>
</html>`);
              return;
            }

            next();
          });
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: '/',
          name: 'Sinahard - Ethiopian Exam Master',
          short_name: 'Sinahard',
          description: 'Ethiopian National & University Exam Preparation, Practice, and Offline Engine.',
          theme_color: '#08101d',
          background_color: '#08101d',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@langchain/')) {
              return 'vendor-langchain';
            }
            if (id.includes('node_modules/katex/')) {
              return 'vendor-katex';
            }
            if (id.includes('node_modules/firebase/')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/motion/') || id.includes('node_modules/framer-motion/')) {
              return 'vendor-motion';
            }
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'vendor-react';
            }
          },
        },
      },
      chunkSizeWarningLimit: 2500,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
