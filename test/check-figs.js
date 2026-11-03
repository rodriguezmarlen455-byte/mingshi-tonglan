/* 校验人物谱：影响力分排序 + 官职/关系标签 */
const fs = require('fs');
const path = require('path');
const SITE = 'D:/AI/ming-dynasty';
function mkEl(id) {
  return { id: id || '', innerHTML: '', textContent: '', value: '', dataset: {},
    style: new Proxy({}, { get: (t, k) => t[k] || '', set: (t, k, v) => { t[k] = v; return true; } }),
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, setAttribute() {}, getAttribute() { return null; },
    insertAdjacentHTML() {}, scrollIntoView() {}, querySelector() { return mkEl('s'); },
    querySelectorAll() { return []; }, closest() { return null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1400, height: 500 }; },
    clientWidth: 900, clientHeight: 500, scrollWidth: 900, scrollHeight: 500,
    scrollLeft: 0, scrollTop: 0, click() {} };
}
const store = {};
const HTML = fs.readFileSync(path.join(SITE, '明朝那些事儿.html'), 'utf8');
const IDS = new Set([...HTML.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
global.document = {
  readyState: 'complete',
  getElementById(id) {
    if (!IDS.has(id) && !/^tk-/.test(id)) return null;
    store[id] = store[id] || mkEl(id);
    return store[id];
  },
  createElement() { return mkEl('a'); },
  querySelector(s) { store[s] = store[s] || mkEl(s); return store[s]; },
  querySelectorAll(s) {
    if (s === '[data-zoom]') return [Object.assign(mkEl('b'), { dataset: { zoom: 'fit' } })];
    if (s === '[data-empsort]') return [Object.assign(mkEl('b'), { dataset: { empsort: 'time' } })];
    return [];
  },
  addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {} }
};
global.window = global;
global.addEventListener = () => {};
global.innerWidth = 1400; global.innerHeight = 900; global.scrollTo = () => {};
global.Blob = class {}; global.URL = { createObjectURL: () => 'b', revokeObjectURL() {} };
global.MING_TEXT = {};
for (let i = 1; i <= 9; i++) eval(fs.readFileSync(path.join(SITE, 'assets/text/t' + i + '.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(SITE, 'assets/data.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(SITE, 'assets/app.js'), 'utf8'));

const g = store['figGrid'].innerHTML;
const cards = (g.match(/class="fig"/g) || []).length;
const metas = (g.match(/class="fmeta"/g) || []).length;
const scores = [...g.matchAll(/class="ff">([\d.]+)</g)].map((m) => +m[1]);
const desc = scores.every((v, i) => i === 0 || scores[i - 1] >= v);
const top = [...g.matchAll(/class="fmeta"><i>([^<]*)<\/i><i>([^<]*)<\/i>[\s\S]{0,40}?class="fr">([^<]*)</g)]
  .slice(0, 5).map((m) => m[1] + '/' + m[2]);
console.log('cards', cards, '| meta', metas, '| score desc', desc);
console.log('前 8 分:', scores.slice(0, 8).join(', '));
console.log('前 5 维度:', top.join(' | '));
const M = global.MING;
const byRank = {};
M.figs.forEach((f) => { byRank[M.rankNames[f.rank]] = (byRank[M.rankNames[f.rank]] || 0) + 1; });
const byRel = {};
M.figs.forEach((f) => { byRel[M.relNames[f.rel]] = (byRel[M.relNames[f.rel]] || 0) + 1; });
console.log('官职分布:', JSON.stringify(byRank, null, 0));
console.log('关系分布:', JSON.stringify(byRel, null, 0));
