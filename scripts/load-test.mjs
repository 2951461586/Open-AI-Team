import http from 'node:http';

const HOST = '127.0.0.1';
const PORT = 19090;
const ENDPOINTS = [
  '/health',
  '/state/team',
  '/state/team/nodes',
  '/state/team/agents',
  '/state/team/contracts',
  '/state/team/artifacts',
];

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: data,
          duration: Date.now() - startTime,
        });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 0, error: err.message, duration: Date.now() - startTime });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runLoadTest(endpoint, concurrency = 10, totalRequests = 100) {
  const latencies = [];
  let completed = 0;
  let succeeded = 0;
  let failed = 0;

  const startTime = Date.now();

  const promises = [];
  for (let i = 0; i < totalRequests; i++) {
    const p = makeRequest(endpoint).then((result) => {
      completed++;
      if (result.status >= 200 && result.status < 400) {
        succeeded++;
      } else {
        failed++;
      }
      latencies.push(result.duration);
    });
    promises.push(p);

    if (promises.length >= concurrency) {
      await Promise.all(promises.splice(0, concurrency));
    }
  }

  await Promise.all(promises);

  const totalDuration = Date.now() - startTime;
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const sortedLatencies = latencies.sort((a, b) => a - b);
  const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
  const p99Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;
  const rps = (totalRequests / totalDuration) * 1000;

  return { succeeded, failed, rps, avgLatency, minLatency, maxLatency, p95Latency, p99Latency, totalDuration };
}

async function runStressTest() {
  console.log('\n' + '='.repeat(70));
  console.log('API Server 压测报告');
  console.log(`时间: ${new Date().toISOString()}`);
  console.log(`目标: http://${HOST}:${PORT}`);
  console.log('='.repeat(70));

  const results = [];

  for (const endpoint of ENDPOINTS) {
    console.log(`\n正在压测: ${endpoint} ...`);
    try {
      const result = await runLoadTest(endpoint, 10, 100);
      results.push({ endpoint, ...result });
    } catch (err) {
      console.error(`压测失败:`, err.message);
      results.push({ endpoint, error: err.message });
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('压测汇总');
  console.log('='.repeat(70));
  console.log(`${'端点'.padEnd(35)} ${'成功率'.padEnd(10)} ${'RPS'.padEnd(12)} ${'Avg'.padEnd(8)} ${'P95'.padEnd(8)} ${'P99'.padEnd(8)}`);
  console.log('-'.repeat(85));

  for (const r of results) {
    if (r.error) {
      console.log(`${r.endpoint.padEnd(35)} ERROR: ${r.error}`);
    } else {
      const successRate = `${((r.succeeded / (r.succeeded + r.failed)) * 100).toFixed(1)}%`;
      console.log(
        `${r.endpoint.padEnd(35)} ${successRate.padEnd(10)} ${r.rps.toFixed(2).padEnd(12)} ` +
        `${r.avgLatency.toFixed(1).padEnd(8)} ${r.p95Latency.toFixed(0).padEnd(8)} ${r.p99Latency.toFixed(0).padEnd(8)}`
      );
    }
  }

  console.log('='.repeat(70));
  console.log('\n压测完成\n');
  return results;
}

runStressTest().catch(console.error);
