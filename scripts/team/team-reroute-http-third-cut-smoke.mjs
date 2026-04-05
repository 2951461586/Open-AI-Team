import http from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT || '19090');
const token = String(process.env.ORCH_KICK_TOKEN || '');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body || {}));
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(data.length),
        ...(token ? { 'x-orch-token': token } : {}),
      },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, body: JSON.parse(buf || '{}') });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const out = await post('/internal/team/reroute/consume', {
  taskId: `task:missing:${randomUUID()}`,
  rerouteRequestId: `msg:missing:${randomUUID()}`,
  actor: 'operator',
});

console.log(JSON.stringify(out, null, 2));
