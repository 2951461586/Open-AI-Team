import assert from 'node:assert/strict';
import path from 'node:path';
import { createTraceCollector } from '../../src/observability/trace-span.mjs';
import { FileTraceExporter } from '../../src/observability/trace-exporter.mjs';
import { withTempDir } from '../helpers/test-helpers.mjs';

test('TraceCollector creates nested spans and exports tree', async () => {
  await withTempDir(async (dir) => {
    const collector = createTraceCollector({
      exporter: new FileTraceExporter(path.join(dir, 'traces.jsonl')),
      maxBufferSize: 100,
    });

    await collector.withSpan('root', async () => {
      await collector.withSpan('child', async () => {
        collector.annotateCurrentSpan('checkpoint', { step: 1 });
      });
    });
    await collector.flush();

    const recent = await collector.listRecent(10);
    assert.equal(recent.ok, true);
    assert.equal(recent.traces.length, 1);
    assert.equal(recent.traces[0].tree.length, 1);
    assert.equal(recent.traces[0].tree[0].operationName, 'root');
    assert.equal(recent.traces[0].tree[0].children[0].operationName, 'child');

    const traceId = recent.traces[0].traceId;
    const detail = await collector.queryByTraceId(traceId);
    assert.equal(detail.ok, true);
    assert.equal(detail.traceId, traceId);
    assert.equal(detail.tree[0].children.length, 1);
  });
});

test('TraceCollector marks errors on failing span', async () => {
  await withTempDir(async (dir) => {
    const collector = createTraceCollector({
      exporter: new FileTraceExporter(path.join(dir, 'traces.jsonl')),
      maxBufferSize: 100,
    });

    await assert.rejects(async () => {
      await collector.withSpan('root', async () => {
        throw new Error('boom');
      });
    }, /boom/);

    await collector.flush();
    const recent = await collector.listRecent(10);
    assert.equal(recent.traces[0].status, 'error');
    assert.equal(recent.traces[0].tree[0].status, 'error');
  });
});
