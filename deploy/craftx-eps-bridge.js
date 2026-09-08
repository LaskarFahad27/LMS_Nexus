/**
 * If CraftX is a Node/Express app, mount this once in its server file:
 *
 *   import { craftxEpsBridge } from './craftx-eps-bridge.js';
 *   app.use('/api/payment/eps', craftxEpsBridge);
 *
 * EPS hits craftx.corecraftsolutions.com; this forwards to the LMS backend.
 */
const NEXUS_BACKEND = process.env.NEXUS_BACKEND_URL || 'https://nexus-back.corecraftsolutions.com';

export async function craftxEpsBridge(req, res) {
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const suffix = req.path === '/' ? '' : req.path;
  const target = `${NEXUS_BACKEND}/api/payment/eps${suffix}${qs}`;

  const headers = { ...req.headers, host: new URL(NEXUS_BACKEND).host };
  delete headers['content-length'];

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
    redirect: 'manual',
    duplex: 'half',
  });

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (!['transfer-encoding', 'content-encoding'].includes(key)) {
      res.setHeader(key, value);
    }
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}
