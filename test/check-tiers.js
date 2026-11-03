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
const IDS = new Set(HTML.split('id="').slice(1).map((x) => x.split('"')[0]));
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

const g = store['empGrid'].innerHTML;
const n = (re) => (g.match(re) || []).length;
console.log('皇帝卡', n(/class="emp /g));
console.log('残留 nhp', n(/class="nhp"/g));
console.log('tier pill', n(/class="tier">T\d/g));
console.log('badge 样例', (g.match(/class="badge"[^>]*>[^<]*/g) || []).slice(0, 3).join(' | '));
console.log('分级按钮', store['empTierGroup'].innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const fg = store['figGrid'].innerHTML;
console.log('人物卡', (fg.match(/class="fig t\d"/g) || []).length,
  '| 人物分级按钮', store['figTierGroup'].innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
