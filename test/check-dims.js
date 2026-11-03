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
    clientWidth: 900, clientHeight: 500, scrollWidth: 900, scrollHeight: 500, scrollLeft: 0, scrollTop: 0, click() {} };
}
const store = {};
const HTML = fs.readFileSync(path.join(SITE, '明朝那些事儿.html'), 'utf8');
const IDS = new Set((HTML.match(/id="[^"]+"/g) || []).map((x) => x.slice(4, -1)));
global.document = {
  readyState: 'complete',
  getElementById(id) {
    if (!IDS.has(id) && !/^tk-/.test(id)) return null;
    store[id] = store[id] || mkEl(id); return store[id];
  },
  createElement() { return mkEl('a'); },
  querySelector(s) { store[s] = store[s] || mkEl(s); return store[s]; },
  querySelectorAll(s) {
    if (s === '[data-zoom]' || s === '[data-empsort]') return [Object.assign(mkEl('b'), { dataset: {} })];
    return [];
  },
  addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {} }
};
global.window = global; global.addEventListener = () => {};
global.innerWidth = 1400; global.innerHeight = 900; global.scrollTo = () => {};
global.Blob = class {}; global.URL = { createObjectURL: () => 'b', revokeObjectURL() {} };
global.MING_TEXT = {};
for (let i = 1; i <= 9; i++) eval(fs.readFileSync(path.join(SITE, 'assets/text/t' + i + '.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(SITE, 'assets/data.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(SITE, 'assets/app.js'), 'utf8'));

const strip = (s) => String(s || '').replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').trim();
console.log('图例:', strip(store['figDimLegend'].innerHTML));
const titles = (store['figGrid'].innerHTML.match(/title="[^"]*\/5）[^"]*"/g) || []);
console.log('悬停样例:', titles.slice(0, 3).join('  ;  '));
console.log('带注释的维度条数:', titles.length);
const m=(store['figGrid'].innerHTML.match(/<span class="dims">[\\s\\S]{0,260}?<\\/span>/)||[])[0]||'';
console.log('首卡维度条:', m.replace(/<b[^>]*><\\/b>/g,'').replace(/title="[^\"]*"/g,''));
