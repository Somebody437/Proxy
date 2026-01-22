// Pages Proxy Browser - frontend
// Edit DEFAULT_PROXY to point to your deployed proxy server when ready.
const DEFAULT_PROXY = 'https://api.allorigins.win/raw?url='; // change to your proxy: e.g. 'https://your-proxy.example.com/fetch?url='

const $ = sel => document.querySelector(sel);
const urlInput = $('#url');
const goBtn = $('#go');
const proxyInput = $('#proxy');
const status = $('#status');
const viewer = $('#viewer');
const clearBtn = $('#clear');

proxyInput.value = DEFAULT_PROXY;
urlInput.value = '';

goBtn.addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (!url) return setStatus('Enter a url (must include protocol, e.g. https://).');
  navigateTo(url);
});

clearBtn.addEventListener('click', () => {
  urlInput.value = '';
  setStatus('');
  viewer.srcdoc = '';
  history.replaceState({}, document.title, location.pathname);
});

// allow Enter key
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') goBtn.click(); });
proxyInput.addEventListener('keydown', e => { if (e.key === 'Enter') goBtn.click(); });

function setStatus(msg) { status.textContent = msg || ''; }

function getProxyBase() {
  const v = proxyInput.value.trim();
  return v || DEFAULT_PROXY;
}
function buildProxyUrl(target) {
  const base = getProxyBase();
  return base + encodeURIComponent(target);
}

async function navigateTo(rawUrl) {
  try {
    rawUrl = rawUrl.trim();
    if (!/^https?:\/\//i.test(rawUrl)) rawUrl = 'https://' + rawUrl;
    new URL(rawUrl);
  } catch (err) {
    setStatus('Invalid URL');
    return;
  }

  setStatus('Fetching page via proxy...');
  const proxyUrl = buildProxyUrl(rawUrl);
  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Proxy fetch failed (${res.status})`);
    const text = await res.text();
    setStatus('Fetched. Processing HTML…');
    const transformed = transformHtml(text, rawUrl);
    setStatus('Rendering in iframe. Scripts are sandboxed.');
    history.pushState({ url: rawUrl }, '', '#'+encodeURIComponent(rawUrl));
    urlInput.value = rawUrl;
    viewer.srcdoc = transformed;
    setStatus(`Loaded: ${rawUrl}`);
  } catch (err) {
    console.error(err);
    setStatus('Error fetching page: ' + err.message + '. Try a different proxy or host your own.');
  }
}

window.addEventListener('popstate', ev => {
  const state = ev.state;
  if (state && state.url) navigateTo(state.url);
  else if (location.hash) {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h) navigateTo(h);
  }
});

window.addEventListener('message', ev => {
  const data = ev.data || {};
  if (data && data.type === 'navigate' && data.url) {
    navigateTo(data.url);
  } else if (data && data.type === 'form' && data.action) {
    if ((data.method || 'GET').toUpperCase() === 'GET') {
      const u = new URL(data.action);
      if (data.formData) {
        Object.entries(data.formData).forEach(([k,v]) => u.searchParams.append(k, v));
      }
      navigateTo(u.href);
    } else {
      setStatus('POST forms are not proxied by this demo. Use GET forms or implement server-side handling.');
    }
  }
});

// transform HTML: rewrite resource URLs to go through the proxy and inject a bridge script
function transformHtml(htmlText, baseUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  // remove meta CSP and base tags
  doc.querySelectorAll('meta[http-equiv],meta[name]').forEach(m => {
    const he = (m.getAttribute('http-equiv') || '').toLowerCase();
    const nm = (m.getAttribute('name') || '').toLowerCase();
    if (he === 'content-security-policy' || he === 'x-frame-options' || nm === 'content-security-policy') {
      m.remove();
    }
  });
  doc.querySelectorAll('base').forEach(b => b.remove());

  function absUrl(url) {
    try { return new URL(url, baseUrl).href; } catch (e) { return url; }
  }
  const proxyBase = getProxyBase();

  function proxify(url) {
    try {
      if (!url) return url;
      if (/^(data|blob|about|mailto|tel):/i.test(url)) return url;
      const a = absUrl(url);
      return proxyBase + encodeURIComponent(a);
    } catch (e) { return url; }
  }

  const ATTR_MAP = [
    {sel: 'img[src]', attr: 'src'},
    {sel: 'script[src]', attr: 'src'},
    {sel: 'iframe[src]', attr: 'src'},
    {sel: 'link[rel="stylesheet"][href]', attr: 'href'},
    {sel: 'link[href]:not([rel="stylesheet"])', attr: 'href'},
    {sel: 'source[src]', attr: 'src'},
    {sel: 'video[src]', attr: 'src'},
    {sel: 'audio[src]', attr: 'src'},
    {sel: 'embed[src]', attr: 'src'},
    {sel: 'object[data]', attr: 'data'},
  ];
  ATTR_MAP.forEach(entry => {
    doc.querySelectorAll(entry.sel).forEach(el => {
      const a = el.getAttribute(entry.attr);
      if (!a) return;
      el.setAttribute(entry.attr, proxify(a));
    });
  });

  doc.querySelectorAll('[srcset]').forEach(el => {
    const val = el.getAttribute('srcset');
    if (!val) return;
    const parts = val.split(',');
    const newParts = parts.map(p => {
      const [urlPart, size] = p.trim().split(/\s+/, 2);
      const newUrl = proxify(urlPart);
      return size ? `${newUrl} ${size}` : `${newUrl}`;
    });
    el.setAttribute('srcset', newParts.join(', '));
  });

  function rewriteCssUrls(cssText) {
    return cssText.replace(/url\\(([^)]+)\\)/g, (m, u) => {
      const raw = u.trim().replace(/^["']|["']$/g, '');
      if (/^(data|blob|about|mailto|tel):/i.test(raw)) return `url(${raw})`;
      return `url("${proxify(raw)}")`;
    });
  }
  doc.querySelectorAll('style').forEach(s => {
    s.textContent = rewriteCssUrls(s.textContent);
  });
  doc.querySelectorAll('[style]').forEach(el => {
    el.setAttribute('style', rewriteCssUrls(el.getAttribute('style')));
  });

  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    const absolute = absUrl(href);
    a.setAttribute('data-orig-href', absolute);
    a.setAttribute('href', 'javascript:void(0)');
    a.setAttribute('rel', 'noreferrer noopener');
  });

  doc.querySelectorAll('form').forEach(f => {
    const action = f.getAttribute('action') || baseUrl;
    const absolute = absUrl(action);
    f.setAttribute('data-orig-action', absolute);
    f.removeAttribute('action');
  });

  const bridge = doc.createElement('script');
  bridge.type = 'text/javascript';
  bridge.textContent = \`
    (function(){
      document.addEventListener('click', function(ev){
        const a = ev.target.closest && ev.target.closest('a[data-orig-href]');
        if (a) {
          ev.preventDefault();
          const u = a.getAttribute('data-orig-href');
          window.parent.postMessage({type:'navigate', url: u}, '*');
        }
      }, true);

      document.addEventListener('submit', function(ev){
        const f = ev.target;
        if (!f) return;
        ev.preventDefault();
        const action = f.getAttribute('data-orig-action') || location.href;
        const method = (f.getAttribute('method') || 'GET').toUpperCase();
        const fd = new FormData(f);
        const obj = {};
        for (const [k,v] of fd.entries()) { obj[k] = v; }
        window.parent.postMessage({type:'form', action: action, method: method, formData: obj}, '*');
      }, true);

      location.assign = function(u){ window.parent.postMessage({type:'navigate', url: u+''}, '*'); };
      location.replace = function(u){ window.parent.postMessage({type:'navigate', url: u+''}, '*'); };
    })();
  \`;
  doc.body.appendChild(bridge);

  const doctype = '<!doctype html>';
  const docHtml = doc.documentElement.outerHTML;
  return doctype + '\\n' + docHtml;
}
