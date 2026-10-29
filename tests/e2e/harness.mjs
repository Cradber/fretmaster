// Arnés mínimo para pruebas de interfaz: servidor estático + Chrome headless controlado por CDP.
// Sin dependencias: usa solo node (fetch y WebSocket integrados) y un Chrome instalado.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png'
};

export function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

export function startServer(root) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, path.normalize(p));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('no encontrado'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
  }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchBrowser() {
  const bin = chromePath();
  if (!bin) throw new Error('No se encontró Chrome. Define CHROME_PATH.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-e2e-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(bin, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.some((t) => t.type === 'page')) break; } catch { /* aún arrancando */ }
    await sleep(250);
  }
  if (!targets) throw new Error('Chrome no arrancó');

  async function newPage(width = 1280, height = 800, colorScheme) {
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => { ws.onopen = r; });
    let id = 0;
    const pending = new Map();
    const errors = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
    };
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    if (colorScheme) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: colorScheme }] });

    const page = {
      errors,
      send,
      async goto(url) {
        await send('Page.navigate', { url });
        await this.waitFor('document.readyState === "complete"');
        await sleep(150);
      },
      async eval(expr) {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result.exceptionDetails) throw new Error('eval falló: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text) + '\n' + expr);
        return r.result.result.value;
      },
      async waitFor(expr, timeout = 5000) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
          try { if (await this.eval(expr)) return true; } catch { /* la página aún navega */ }
          await sleep(60);
        }
        throw new Error('Tiempo agotado esperando: ' + expr);
      },
      async click(sel) { return this.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('no existe ' + ${JSON.stringify(sel)}); e.click(); return true; })()`); },
      /** Clic con el ratón de verdad (activación de usuario), necesario para el audio, que un element.click() no da. */
      async realClick(sel) {
        const r = await this.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('no existe ' + ${JSON.stringify(sel)}); e.scrollIntoView({block:'center'}); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
      },
      async key(key) {
        const code = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40 }[key];
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key, windowsVirtualKeyCode: code });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode: code });
      },
      async screenshot(file) {
        const r = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      },
      async close() { ws.close(); await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); }
    };
    return page;
  }

  return {
    newPage,
    async close() { proc.kill(); await sleep(200); fs.rmSync(profile, { recursive: true, force: true }); }
  };
}
