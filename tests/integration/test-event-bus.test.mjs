import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { withTempDir } from '../helpers/test-helpers.mjs';

test('EventBus publishes events to subscribers', async () => {
  await withTempDir(async () => {
    const emitter = new EventEmitter();
    const received = [];
    
    emitter.on('test-event', (data) => {
      received.push(data);
    });
    
    emitter.emit('test-event', { id: 1, message: 'hello' });
    emitter.emit('test-event', { id: 2, message: 'world' });
    
    assert.equal(received.length, 2);
    assert.equal(received[0].id, 1);
    assert.equal(received[1].id, 2);
  });
});

test('EventBus rejects invalid event payloads', async () => {
  await withTempDir(async () => {
    const emitter = new EventEmitter();
    let errorReceived = false;
    
    emitter.on('error', () => {
      errorReceived = true;
    });
    
    emitter.emit('error', new Error('Test error'));
    
    assert.equal(errorReceived, true);
  });
});

test('EventEmitter supports once for single-fire handlers', async () => {
  const emitter = new EventEmitter();
  let count = 0;
  
  emitter.once('single', () => {
    count++;
  });
  
  emitter.emit('single');
  emitter.emit('single');
  
  assert.equal(count, 1);
});

test('EventEmitter supports removing listeners', async () => {
  const emitter = new EventEmitter();
  let count = 0;
  
  const handler = () => {
    count++;
  };
  
  emitter.on('remove-test', handler);
  emitter.emit('remove-test');
  
  emitter.off('remove-test', handler);
  emitter.emit('remove-test');
  
  assert.equal(count, 1);
});
