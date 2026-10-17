import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAddress } from '../public/address.js';

test('opens complete HTTP(S) URLs and normalizes bare domains', () => {
  assert.equal(resolveAddress('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(resolveAddress('example.com/docs'), 'https://example.com/docs');
  assert.equal(resolveAddress('http://example.com'), 'http://example.com/');
});
test('treats normal words as a search and ignores empty input', () => {
  assert.equal(resolveAddress('hello world'), 'https://duckduckgo.com/?q=hello%20world');
  assert.equal(resolveAddress('  '), null);
});
test('refuses unsupported schemes and URLs with embedded credentials', () => {
  assert.throws(() => resolveAddress('javascript:alert(1)'), /HTTP and HTTPS/);
  assert.throws(() => resolveAddress('ftp://example.com'), /HTTP and HTTPS/);
  assert.throws(() => resolveAddress('https://user:pass@example.com'), /credentials/);
});
