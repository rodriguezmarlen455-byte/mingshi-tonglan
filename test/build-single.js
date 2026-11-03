/* 把站点打成单文件 HTML（内联 css / data.js / app.js），便于离线拷贝 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let html = read('明朝那些事儿.html');
const css = read('assets/style.css');
const data = read('assets/data.js');
const app = read('assets/app.js');

/* 必读章原文（9 份分册文件依次合并进 window.MING_TEXT） */
let texts = '';
for (let i = 1; i <= 9; i++) {
  const f = 'assets/text/t' + i + '.js';
  if (fs.existsSync(path.join(ROOT, f))) texts += '\n' + read(f);
}

html = html.replace('<link rel="stylesheet" href="assets/style.css">', '<style>\n' + css + '\n</style>');
html = html.replace(
  /<script src="assets\/data\.js"><\/script>\s*<script src="assets\/app\.js"><\/script>/,
  '<script>\n' + data + '\n</script>\n<script>' + texts + '</script>\n<script>\n' + app + '\n</script>'
);
if (html.indexOf('<style>') < 0 || html.indexOf('window.MING') < 0 || html.indexOf('MING_TEXT') < 0) {
  console.error('内联失败：检查 HTML 里的 link/script 标签是否还是原样');
  process.exit(1);
}
const out = path.join(ROOT, '明朝那些事儿-单文件.html');
fs.writeFileSync(out, html, 'utf8');
console.log('写出 ' + out + '  ' + (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KB');
