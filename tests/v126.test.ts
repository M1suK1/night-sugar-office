import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

/** 立绘的像素一个都不许改：调色滤镜会让用户的原图看起来偏色，已经踩过一次。 */
test('v126 立绘相关样式不再用调色滤镜', () => {
  const dir = 'src';
  const files = [...readdirSync(dir).filter(name => name.endsWith('.css')).map(name => `${dir}/${name}`),
    ...readdirSync(`${dir}/views`).filter(name => name.endsWith('.css')).map(name => `${dir}/views/${name}`)];
  const offenders: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
    lines.forEach((line, index) => {
      if (!line.includes('.girl-portrait')) return;
      if (/filter:[^;}]*\b(hue-rotate|sepia|saturate|brightness|contrast|grayscale)\(/.test(line)) {
        offenders.push(`${file}:${index + 1} ${line.trim().slice(0, 80)}`);
      }
    });
  }
  assert.deepEqual(offenders, [], '立绘上出现了调色滤镜，会造成色差');
});
