#!/usr/bin/env node
/*
 * Collector sink.
 *
 *   node sink.mjs <output.json> [--port 8900] [--keep]
 *
 * Starts a tiny local server, waits for the collector to POST the page's
 * rendered state, writes it to <output.json>, and exits.
 *
 * Why this exists: a real page hits the collector's 1200 element cap, and
 * returning that through the model's context to be re-typed into a file is both
 * enormous and lossy. The data should go from the browser to disk without a
 * round trip through anything that can paraphrase it.
 *
 * Localhost only, single write, then gone.
 */

import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--'));
if (!out) {
  console.error('usage: sink.mjs <output.json> [--port 8900] [--keep]');
  process.exit(2);
}
const pi = args.indexOf('--port');
const port = pi > -1 ? Number(args[pi + 1]) : 8900;
const keep = args.includes('--keep');

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('post the collector output'); return; }

  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let parsed;
    try { parsed = JSON.parse(body); }
    catch (e) {
      res.writeHead(400); res.end('bad json');
      console.error(`sink: received ${body.length} bytes that were not JSON (${e.message})`);
      return;
    }
    if (!parsed || parsed.collector !== 'mikedesign/1') {
      res.writeHead(400); res.end('not collector output');
      console.error('sink: payload is not mikedesign collector output. Nothing written.');
      return;
    }
    writeFileSync(out, JSON.stringify(parsed, null, 2));
    res.writeHead(200); res.end('ok');
    const n = (parsed.elements || []).length;
    console.log(`sink: wrote ${n} elements to ${out}`);
    if (!keep) { server.close(); process.exit(0); }
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`sink: listening on http://127.0.0.1:${port}, writing to ${out}`);
});

// Never hang a session forever waiting for a page that is not coming.
setTimeout(() => {
  console.error('sink: timed out after 120s with no collector POST. Nothing written.');
  process.exit(1);
}, 120_000);
