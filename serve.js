/* 极简静态文件服务器（零依赖，Node 内置模块）
 * 用法：node serve.js [端口]
 * 局域网内其它电脑用 http://<本机IP>:<端口>/ 即可访问
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = parseInt(process.argv[2], 10) || 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, must-revalidate'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  } catch (e) {
    return send(res, 400, 'Bad URL');
  }
  if (rel.endsWith('/')) rel += '明朝那些事儿.html';   /* 站点首页 */
  const file = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden');

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      return send(res, 404, '404 未找到：' + rel, 'text/plain; charset=utf-8');
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Cache-Control': 'no-store, must-revalidate'
    });
    fs.createReadStream(file).pipe(res);
    console.log(new Date().toLocaleTimeString('zh-CN'), req.method, rel, '→', 200);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const urls = ['http://localhost:' + PORT + '/'];
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((name) => {
    (nets[name] || []).forEach((ni) => {
      if (ni.family === 'IPv4' && !ni.internal) urls.push('http://' + ni.address + ':' + PORT + '/');
    });
  });
  console.log('\n明朝那些事儿 · 九册通览 静态站点已启动');
  console.log('根目录：' + ROOT);
  console.log('访问地址：');
  urls.forEach((u) => console.log('   ' + u));
  console.log('\n其它电脑请用上面「192.168.x.x」那条；按 Ctrl+C 停止。\n');
});
