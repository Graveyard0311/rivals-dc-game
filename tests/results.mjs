import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

assert.match(source, /function finishMatch\(winner, reason = ''\)/, 'finishMatch result flow required');
assert.match(source, /id="matchResults"/, 'results overlay markup required');
assert.match(source, /id="resultsMvp"/, 'MVP presentation required');
assert.match(source, /id="resultsBlue"/, 'Alliance result table required');
assert.match(source, /id="resultsRed"/, 'Legion result table required');
assert.match(source, /resultsReturnBtn/, 'explicit return action required');
assert.ok(!source.includes("setTimeout(() => location.reload(), 5200);"), 'automatic post-match reload must not return');

const finishCalls = [...source.matchAll(/finishMatch\(([^\n]+)\)/g)].length;
assert.ok(finishCalls >= 7, 'all match victory paths should route through finishMatch');

console.log('post-match results contract: PASS');
