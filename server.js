import express from 'express';
import cors from 'cors';
import { pipeline } from 'stream';
import { fileTypeFromStream } from 'file-type'; // optional, not used by default

const app = express();

// Allow all origins for demo. In production, lock this down.
app.use(cors({ origin: true }));

// Simple health
app.get('/', (req, res) => res.send('Pages Proxy Server is running.'));

// OPTIONS preflight handling for browsers
app.options('*', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.sendStatus(200);
});

// GET /fetch?url=<encoded>
app.get('/fetch', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing ?url= parameter');

  try {
    // Basic validation
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (e) {
      return res.status(400).send('Invalid URL');
    }

    // Fetch remote resource, following redirects
    const fetched = await fetch(targetUrl.href, { redirect: 'follow' });

    // Forward status
    res.status(fetched.status);

    // Copy headers except CSP/X-Frame-Options and other security headers
    const skip = new Set([
      'content-security-policy',
      'content-security-policy-report-only',
      'x-frame-options',
      'x-xss-protection',
      'x-content-type-options',
      'referrer-policy'
    ]);
    fetched.headers.forEach((value, key) => {
      if (skip.has(key.toLowerCase())) return;
      // Let browser decide content-type or forward it
      res.setHeader(key, value);
    });

    // Always allow CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,HEAD');

    // For HTML responses, it's useful to return text so frontend can rewrite.
    // Stream body to client
    const body = fetched.body;
    if (!body) {
      res.end();
      return;
    }
    // pipe the body stream to response
    pipeline(body, res, (err) => {
      if (err) {
        console.error('Stream pipeline error', err);
      }
    });
  } catch (err) {
    console.error('Proxy error', err);
    res.status(502).send('Error fetching target: ' + String(err));
  }
});

// Simple catch-all for other methods (optional)
app.all('/fetch', (req, res) => {
  res.status(405).send('Use GET /fetch?url=');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Pages proxy server listening on port ${port}`);
});
