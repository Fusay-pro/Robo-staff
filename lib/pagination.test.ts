import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageWindow } from './pagination.ts';

test('no gaps when every page fits', () => {
  assert.deepEqual(pageWindow(3, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageWindow(1, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test('near the start: first five, gap, last', () => {
  assert.deepEqual(pageWindow(1, 12), [1, 2, 3, 4, 5, 'gap', 12]);
  assert.deepEqual(pageWindow(4, 12), [1, 2, 3, 4, 5, 'gap', 12]);
});

test('in the middle: first, gap, neighbours, gap, last', () => {
  assert.deepEqual(pageWindow(5, 12), [1, 'gap', 4, 5, 6, 'gap', 12]);
  assert.deepEqual(pageWindow(8, 12), [1, 'gap', 7, 8, 9, 'gap', 12]);
});

test('near the end: first, gap, last five', () => {
  assert.deepEqual(pageWindow(9, 12), [1, 'gap', 8, 9, 10, 11, 12]);
  assert.deepEqual(pageWindow(12, 12), [1, 'gap', 8, 9, 10, 11, 12]);
});

test('width stays steady at seven slots', () => {
  for (const c of [1, 2, 5, 7, 8, 11, 12]) {
    assert.equal(pageWindow(c, 12).length, 7, `current=${c}`);
  }
});

test('degenerate totals', () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 0), []);
  assert.deepEqual(pageWindow(1, -3), []);
});

test('current outside the range is clamped, not trusted', () => {
  assert.deepEqual(pageWindow(99, 12), [1, 'gap', 8, 9, 10, 11, 12]);
  assert.deepEqual(pageWindow(0, 12), [1, 2, 3, 4, 5, 'gap', 12]);
});
