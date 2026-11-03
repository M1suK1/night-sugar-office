import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/storyLines.ts';
let s = readFileSync(f, 'utf8');
s = s.replace("  const slots = Math.max(1, paragraphs + 1);\n", "");
writeFileSync(f, s);

// EventDialog：渲染时按交织结果排布
let ed = readFileSync('src/components/EventDialog.tsx', 'utf8').replace(/\r\n/g, '\n');
const before = ed;
ed = ed.replace(
  `                <section key={turn.id} className="story-narrator-turn">
                  {turn.text.split(/\\n+/).filter(Boolean).map((paragraph, index) => <p key={index} className="battle-note-narration">{paragraph}</p>)}
                  {(turn.lines ?? []).length > 0 && <div className="battle-note-lines">
                    {(turn.lines ?? []).map((line, index) => {`,
  `                <section key={turn.id} className="story-narrator-turn">
                  {(() => {
                    // 旁白与台词按 after 交织：以前台词全堆在正文后面，读起来像先读小说再看对白。
                    const paragraphs = turn.text.split(/\\n+/).filter(Boolean);
                    const lines = turn.lines ?? [];
                    return interleaveTurn(paragraphs, lines).map(segment => segment.kind === 'narration'
                      ? <p key={\`p-\${segment.index}\`} className="battle-note-narration">{paragraphs[segment.index]}</p>
                      : renderLine(lines[segment.index]!, segment.index));
                  })()}
                  {false && <div className="battle-note-lines">
                    {(turn.lines ?? []).map((line, index) => {`,
);
if (ed === before) throw new Error('render anchor missing');
writeFileSync('src/components/EventDialog.tsx', ed);
console.log('patched partially');
