import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('JufaStore - Strict Zero-Emoji Integrity Test (AGENTS.md Rule 4)', () => {
  it('memastikan tidak ada emoji apa pun di seluruh codebase src/', () => {
    // Regex komprehensif mencakup Extended_Pictographic, Emoticons, Symbols, Pictographs
    const emojiRegex = /(\p{Extended_Pictographic}|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2300}-\u{23FF}])/u;

    function walkDirectory(dir: string): string[] {
      let results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(walkDirectory(fullPath));
        } else if (/\.(tsx?|jsx?|html|css|json)$/.test(entry.name)) {
          // Abaikan file tes ini sendiri agar regex pattern di atas tidak memicu deteksi diri
          if (!fullPath.endsWith('no_emojis.test.ts')) {
            results.push(fullPath);
          }
        }
      }
      return results;
    }

    const srcDir = path.resolve(__dirname, '..');
    const files = walkDirectory(srcDir);
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        if (emojiRegex.test(lineText)) {
          violations.push({
            file: path.relative(srcDir, file),
            line: idx + 1,
            text: lineText.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Ditemukan ${violations.length} emoji di src/: ${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });
});
