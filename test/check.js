/* Node DOM 桩：跑通整页 init()，导出 SVG 并做数值体检 */
const fs = require('fs');
const path = require('path');
const SITE = 'D:/AI/ming-dynasty';
function mkEl(id) {
  return {
    id: id || '', innerHTML: '', textContent: '', value: '', dataset: {}, children: [],
    style: new Proxy({}, { get: (t, k) => t[k] || '', set: (t, k, v) => { t[k] = v; return true; } }),
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, setAttribute() {},
    getAttribute() { return null; }, insertAdjacentHTML() {}, scrollIntoView() {},
    querySelector() { return mkEl('s'); }, querySelectorAll() { return []; },
    closest() { return null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1400, height: 500 }; },
    clientWidth: 1000, clientHeight: 500, scrollWidth: 1000, scrollHeight: 500,
    scrollLeft: 0, scrollTop: 0, click() {}, focus() {}
  };
}
const store = {};
const STATIC_QSA = {
  '[data-zoom]': [{ dataset: { zoom: 'out' } }, { dataset: { zoom: 'in' } }, { dataset: { zoom: 'fit' } }],
  '[data-empsort]': [{ dataset: { empsort: 'time' } }, { dataset: { empsort: 'dur' } }, { dataset: { empsort: 'short' } }]
};
/* 只放行页面上真实存在的 id：桩先扫 HTML 的 id 清单，未知 id 一律返回 null，
   与浏览器一致——这样「删了区块却还去取旧 id」会被立刻抓到，而不是静默造一个空元素 */
const HTML_SRC = fs.readFileSync(path.join(SITE, '明朝那些事儿.html'), 'utf8');
const REAL_IDS = new Set([...HTML_SRC.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const missingIds = [];
global.document = {
  readyState: 'complete',
  getElementById(id) {
    /* tk-* 是 JS 用 innerHTML 动态生成的原文容器，静态 HTML 里没有 */
    if (!REAL_IDS.has(id) && !/^tk-/.test(id)) {
      if (missingIds.indexOf(id) < 0) missingIds.push(id);
      return null;
    }
    store[id] = store[id] || mkEl(id);
    return store[id];
  },
  createElement() { return mkEl('a'); },
  querySelector(s) { store[s] = store[s] || mkEl(s); return store[s]; },
  querySelectorAll(s) {
    if (STATIC_QSA[s]) return STATIC_QSA[s].map((o) => Object.assign(mkEl('b'), o));
    return [];
  },
  addEventListener(e, f) { if (e === 'DOMContentLoaded') global.__ready = f; },
  head: { appendChild() {} },
  body: { appendChild() {} }
};
global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.innerWidth = 1400; global.innerHeight = 900;
global.scrollTo = () => {};
global.Blob = class { constructor(a) { this.a = a; } };
global.URL = { createObjectURL: () => 'blob:', revokeObjectURL() {} };
/* 原文分册文件：直接读入内存，避免桩里真的去注入 <script> */
global.MING_TEXT = {};
for (let i = 1; i <= 9; i++) {
  const f = path.join(SITE, 'assets/text/t' + i + '.js');
  if (fs.existsSync(f)) eval(fs.readFileSync(f, 'utf8'));
}
const errors = [];
try {
  (0, eval)(fs.readFileSync(path.join(SITE, 'assets/data.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(SITE, 'assets/app.js'), 'utf8'));
} catch (e) { errors.push('init 抛错: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]); }
const H = (id) => (store[id] && store[id].innerHTML) || '';
function ck0(name, cond, extra) {
  console.log((cond ? '  ok ' : '  x  ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) errors.push(name);
}
console.log('=== 1. 初始化 ===');
if (missingIds.length) console.log('  x 取用了页面上不存在的 id: ' + missingIds.join(', '));
if (errors.length) errors.forEach((e) => console.log('  x ' + e));
else console.log('  ok init() 跑通，无异常');
ck0('没有取用不存在的 id', missingIds.length === 0, missingIds.join(','));
const chart = H('chart'), detail = H('detail');
fs.writeFileSync('D:/AI/work/chart.svg', chart, 'utf8');
fs.writeFileSync('D:/AI/work/detail.html', '<meta charset="utf-8">' + detail, 'utf8');
console.log('\n=== 2. 结构断言 ===');
function ck(name, cond, extra) {
  console.log((cond ? '  ok ' : '  x  ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) errors.push(name);
}
const cnt = (s, re) => (s.match(re) || []).length;
ck('年表 SVG 已生成', chart.length > 2000, chart.length + ' 字节');
ck('在位条 = 17 段 + 元末车道 1 条', cnt(chart, /height="14" rx="2"/g) === 18, cnt(chart, /height="14" rx="2"/g) + '');
ck('九册色带 = 9 条', cnt(chart, /height="20" fill="#(?:8c5a4a|9a5b3f|a8763c|7f7a3e|4f7a5c|467a8c|4a6a9a|6f5a92|8c4a52)"/g) === 9,
  cnt(chart, /height="20" fill="#(?:8c5a4a|9a5b3f|a8763c|7f7a3e|4f7a5c|467a8c|4a6a9a|6f5a92|8c4a52)"/g) + '');
ck('大事刻 = 62 个', cnt(chart, /width="3" height="10"/g) === 62, cnt(chart, /width="3" height="10"/g) + '');
ck('左侧标签列 = 17 行', cnt(H('chartLabels'), /text-anchor="start" fill=/g) >= 17, cnt(H('chartLabels'), /text-anchor="start" fill=/g) + '');
ck('详情面板有内容', detail.length > 400, detail.length + ' 字节');
ck('皇帝表 17 行(含表头)', cnt(H('tblEmp'), /<tr>/g) === 17, cnt(H('tblEmp'), /<tr>/g) + '');
ck('附录表行数 = 条数+1', cnt(H('tblApx'), /<tr>/g) === global.MING.appendix.length + 1,
  cnt(H('tblApx'), /<tr>/g) + ' / ' + (global.MING.appendix.length + 1));
ck('人物卡 78 张', cnt(H('figGrid'), /class="fig(?: t[123])?"/g) === 78, cnt(H('figGrid'), /class="fig(?: t[123])?"/g) + '');
ck('皇帝卡 16 张', cnt(H('empGrid'), /class="emp/g) === 16, cnt(H('empGrid'), /class="emp/g) + '');
ck('战役卡 62 张', cnt(H('warGrid'), /class="war(?: t[123])?"/g) === 62, cnt(H('warGrid'), /class="war(?: t[123])?"/g) + '');
ck('三条主线 3 条', cnt(H('rdSpine'), /class="rd-sp"/g) === 3, cnt(H('rdSpine'), /class="rd-sp"/g) + '');
ck('四幕 4 块', cnt(H('rdActs'), /class="rd-act"/g) === 4, cnt(H('rdActs'), /class="rd-act"/g) + '');
ck('分册路线图 9 块', cnt(H('rdPlan'), /class="rp"/g) === 9, cnt(H('rdPlan'), /class="rp"/g) + '');
const mustCnt = cnt(H('rdPlan'), /class="rp-cn"/g);
ck('必读章合计 56', mustCnt === 56, mustCnt + '');
ck('题记 56 段（每章都有）', cnt(H('rdPlan'), /class="rp-tiji"/g) === 56, cnt(H('rdPlan'), /class="rp-tiji"/g) + '');
ck('原文按钮 56 个', cnt(H('rdPlan'), /class="rp-tg"/g) === 56, cnt(H('rdPlan'), /class="rp-tg"/g) + '');
/* 原文：逐章展开，检查段落数与字数 */
if (global.__MING_DEBUG) {
  let ok = 0, bad = [], totalChars = 0;
  global.MING.reading.plan && Object.keys(global.MING.reading.plan).forEach((code) => {
    global.MING.reading.plan[code].must.forEach((c) => {
      global.__MING_DEBUG.openText(c.tk, null);
      const box = store['tk-' + c.tk];
      const html = (box && box.innerHTML) || '';
      const ps = (html.match(/<p[ >]/g) || []).length;
      const chars = html.replace(/<[^>]+>/g, '').length;
      totalChars += chars;
      if (ps >= 5 && chars > 1200) ok++; else bad.push(c.tk + '(段' + ps + '字' + chars + ')');
    });
  });
  ck('56 章原文均可展开且有 5+ 段', ok === 56, 'ok=' + ok + (bad.length ? ' 异常:' + bad.slice(0, 3).join(',') : ''));
  console.log('  原文总渲染字数 ≈ ' + totalChars + '（应为 60 万量级）');
  ck('原文总量 > 55 万字', totalChars > 550000, totalChars + '');
} else {
  ck('调试钩子可用', false, '__MING_DEBUG 缺失');
}
console.log('\n=== 3. 文字相撞体检 ===');
const texts = [...chart.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"([^>]*)>([^<]*)<\/text>/g)].map((m) => {
  const t = m[4].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  const fsz = +((m[3].match(/font-size="([\d.]+)"/) || [, 10])[1]);
  let w = 0; for (const ch of t) w += /[\x00-\x7f]/.test(ch) ? 0.55 : 1;
  return { x: +m[1], y: +m[2], attr: m[3], t, fs: fsz, w: w * fsz };
});
const rows = {};
texts.forEach((o) => { (rows[o.y.toFixed(0)] = rows[o.y.toFixed(0)] || []).push(o); });
let bad = 0, checked = 0;
Object.keys(rows).forEach((k) => {
  const a = rows[k].sort((p, q) => p.x - q.x);
  for (let i = 1; i < a.length; i++) {
    const A = a[i - 1], B = a[i];
    if (!/text-anchor="middle"/.test(A.attr) || !/text-anchor="middle"/.test(B.attr)) continue;
    checked++;
    const gap = (B.x - B.w / 2) - (A.x + A.w / 2);
    if (gap < -0.5) { bad++; console.log('  x 同行相撞 y=' + k + ': ' + A.t + ' / ' + B.t + ' 重叠 ' + (-gap).toFixed(1) + 'px'); }
  }
});
console.log('  居中式同行对照 ' + checked + ' 对，相撞 ' + bad);
const VW = +chart.match(/viewBox="0 0 ([\d.]+)/)[1];
let out = 0;
texts.forEach((o) => {
  if (!/text-anchor="middle"/.test(o.attr)) return;
  if (o.x - o.w / 2 < 1 || o.x + o.w / 2 > VW - 1) {
    out++;
    if (out <= 6) console.log('  x 越界: ' + o.t + ' @x=' + o.x.toFixed(1) + ' w=' + o.w.toFixed(1) + ' y=' + o.y);
  }
});
console.log('  居中式文字越界 ' + out + ' 处（viewBox 宽 ' + VW + '）');
if (bad) errors.push('文字相撞 ' + bad);
if (out) errors.push('文字越界 ' + out);
console.log('\n=== 4. 数据不变式 ===');
const M = global.MING;
const mi = (y, m) => y * 12 + m;
let gaps = 0;
for (let i = 1; i < M.segs.length; i++) {
  const a = M.segs[i - 1], b = M.segs[i];
  if (a.emp === 'yingzong' && b.emp === 'yingzong') continue;
  if (mi(a.ey, a.em) !== mi(b.sy, b.sm)) { gaps++; console.log('  x 时间缝隙: ' + a.emp + ' -> ' + b.emp); }
}
ck('17 段首尾相接（缝隙 0）', gaps === 0);
const tot = M.emps.reduce((s, e) => s + e.months, 0);
ck('总月数 3314 = 1368.1 到 1644.3', tot === 3314, tot + '');
const noOwner = [];
for (let y = 1368; y <= 1644; y++) if (!M.owner[y]) noOwner.push(y);
ck('277 年每年都有皇帝', noOwner.length === 0, noOwner.length ? noOwner.join(',') : '');
ck('十六帝 / 十七年号', M.emps.length === 16 && M.nianhao.length === 17);
ck('附录大事记 >= 200 条', M.appendix.length >= 200, M.appendix.length + '');
const apxBad = M.appendix.filter((a) => !a.text || a.year < 1328 || a.year > 1644);
ck('附录条目文本与年份合法', apxBad.length === 0, apxBad.length + ' 条异常');
const dupApx = M.appendix.filter((a, i) => M.appendix.findIndex((b) => b.emp === a.emp && b.year === a.year && b.text === a.text) !== i);
ck('附录无重复条目', dupApx.length === 0, dupApx.length + ' 条重复');
console.log('\n=== 5. 归年抽查 ===');
const spot = [[1457, 'yingzong', '正月夺门，此后十一月天顺'], [1620, 'shenzong', '万历四十八年七月崩'],
  [1449, 'yingzong', '土木堡在八月'], [1398, 'taizu', '洪武三十一年闰五月'],
  [1521, 'wuzong', '正德十六年三月崩'], [1402, 'huidi', '建文四年六月'],
  [1425, 'renzong', '洪熙元年五月崩'], [1644, 'sizong', '崇祯十七年三月']];
spot.forEach((sp) => ck('归年 ' + sp[0] + ' -> ' + sp[1] + '（' + sp[2] + '）', M.owner[sp[0]] === sp[1], '实际 ' + M.owner[sp[0]]));
console.log('\n=== 6. 动态文案（数据一致性） ===');
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '');
console.log('  读法汇总：' + strip(H('rdSum')));
console.log('  必读章示例：' + strip(H('rdPlan')).slice(0, 200));
const dynBad = /NaN|undefined|Infinity/.test(
  strip(H('rdSum')) + strip(H('rdPlan')) + strip(H('rdQa')) + strip(H('noteBar')) + strip(H('detail')));
ck('动态文案无 NaN/undefined/Infinity', !dynBad);
console.log('\n=== 结论 ===');
console.log(errors.length ? '  x ' + errors.length + ' 项未通过' : '  ok 全部通过');
process.exit(errors.length ? 1 : 0);
