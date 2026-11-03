/* 生成规范的 zip（正斜杠路径、store 存储）—— 供 Netlify 等静态托管使用
 * 用法：node zipit.js <源目录> <输出.zip>
 * 说明：Windows PowerShell 的 Compress-Archive / ZipFile.CreateFromDirectory 可能写入反斜杠，
 *       导致 Netlify 解压后目录层级丢失（assets 变字面文件名），故这里自己写 zip。
 */
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) { console.log('用法：node zipit.js <源目录> <输出.zip>'); process.exit(1); }

/* CRC32 */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function walk(dir, base) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full, rel));
    else out.push({ full, rel, size: st.size });
  }
  return out;
}

const files = walk(SRC, '');
const chunks = [];
const central = [];
let offset = 0;

function dosTime(d) {
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  return { date, time };
}
const now = dosTime(new Date());

files.forEach((f) => {
  const data = fs.readFileSync(f.full);
  const crc = crc32(data);
  const nameBuf = Buffer.from(f.rel, 'utf8');

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);       // local file header signature
  lh.writeUInt16LE(20, 4);               // version needed
  lh.writeUInt16LE(0x0800, 6);           // flags: UTF-8 names
  lh.writeUInt16LE(0, 8);                // method: store
  lh.writeUInt16LE(now.time, 10);
  lh.writeUInt16LE(now.date, 12);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(data.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(nameBuf.length, 26);
  lh.writeUInt16LE(0, 28);
  chunks.push(lh, nameBuf, data);

  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4);               // version made by
  ch.writeUInt16LE(20, 6);               // version needed
  ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(0, 10);
  ch.writeUInt16LE(now.time, 12);
  ch.writeUInt16LE(now.date, 14);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(data.length, 20);
  ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(nameBuf.length, 28);
  ch.writeUInt16LE(0, 30);               // extra
  ch.writeUInt16LE(0, 32);               // comment
  ch.writeUInt16LE(0, 34);               // disk
  ch.writeUInt16LE(0, 36);               // internal attrs
  ch.writeUInt32LE(0, 38);               // external attrs
  ch.writeUInt32LE(offset, 42);          // local header offset
  central.push(Buffer.concat([ch, nameBuf]));

  offset += lh.length + nameBuf.length + data.length;
});

const centralBuf = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(centralBuf.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

fs.writeFileSync(OUT, Buffer.concat([...chunks, centralBuf, eocd]));
const mb = fs.statSync(OUT).size / 1024 / 1024;
console.log('已生成 ' + OUT + '  ' + mb.toFixed(2) + ' MB，条目 ' + files.length);
console.log('示例条目: ' + files.slice(0, 5).map((f) => f.rel).join(', '));
