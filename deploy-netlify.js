/* 一键部署到 Netlify（无需安装依赖）
 * 用法：  node deploy-netlify.js <你的 Personal Access Token> [站点名前缀]
 * 或：    set NETLIFY_TOKEN=xxx && node deploy-netlify.js
 *
 * 做的事：
 *   1) POST /api/v1/sites                     创建（或复用同名）站点
 *   2) POST /api/v1/sites/<id>/deploys  zip   上传整站压缩包
 *   3) GET  /api/v1/deploys/<deploy_id>       轮询到 ready，打印 https 地址
 *
 * 本机只经 127.0.0.1:8800 代理出网，所以所有请求走 HTTP CONNECT。
 */
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const TOKEN = process.argv[2] || process.env.NETLIFY_TOKEN || '';
const ZIP = process.env.DEPLOY_ZIP || 'D:/AI/five-dynasties-deploy.zip';
const PREFIX = process.argv[3] || 'wudaishiguo';

if (!TOKEN) {
  console.log('缺少 token。用法：node deploy-netlify.js <Personal Access Token> [站点名前缀]');
  process.exit(1);
}
if (!fs.existsSync(ZIP)) {
  console.log('找不到发布包：' + ZIP + '\n请先运行：Compress-Archive -Path "D:\\AI\\five-dynasties-deploy\\*" -DestinationPath "D:\\AI\\five-dynasties-deploy.zip" -Force');
  process.exit(1);
}

/* ---- 经代理的 HTTPS 请求 ---- */
function api(method, urlPath, body, contentType) {
  return new Promise((resolve, reject) => {
    const u = new URL('https://api.netlify.com' + urlPath);
    const conn = http.request({ host: '127.0.0.1', port: 8800, method: 'CONNECT', path: u.hostname + ':443', timeout: 300000 });
    conn.on('connect', (_res, socket) => {
      const headers = {
        Host: u.hostname,
        Authorization: 'Bearer ' + TOKEN,
        'User-Agent': 'dsh-deploy/1.0'
      };
      if (body) {
        headers['Content-Type'] = contentType || 'application/json';
        headers['Content-Length'] = Buffer.byteLength(body);
      }
      const q = https.request({ host: u.hostname, port: 443, path: u.pathname + u.search, method, socket, agent: false, headers }, (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => {
          let json = null;
          try { json = JSON.parse(d); } catch (e) {}
          resolve({ code: r.statusCode, raw: d, json });
        });
      });
      q.on('error', reject);
      if (body) q.write(body);
      q.end();
    });
    conn.on('timeout', () => { conn.destroy(); reject(new Error('timeout')); });
    conn.on('error', reject);
    conn.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('1/3 校验 token ...');
  const me = await api('GET', '/api/v1/user');
  if (me.code !== 200) {
    console.log('   ✘ token 无效（HTTP ' + me.code + '）：' + (me.raw || '').slice(0, 200));
    process.exit(1);
  }
  console.log('   ✔ 账号：' + (me.json.full_name || me.json.email || me.json.id));

  const siteName = PREFIX + '-' + Math.random().toString(36).slice(2, 7);
  console.log('2/3 创建站点 ' + siteName + ' ...');
  const site = await api('POST', '/api/v1/sites', JSON.stringify({ name: siteName }));
  if (site.code !== 200 && site.code !== 201) {
    console.log('   ✘ 创建失败（HTTP ' + site.code + '）：' + (site.raw || '').slice(0, 300));
    process.exit(1);
  }
  const siteId = site.json.id;
  console.log('   ✔ site_id = ' + siteId);

  const zip = fs.readFileSync(ZIP);
  console.log('3/3 上传 ' + path.basename(ZIP) + '（' + (zip.length / 1024 / 1024).toFixed(2) + ' MB）...');
  const dep = await api('POST', '/api/v1/sites/' + siteId + '/deploys', zip, 'application/zip');
  if (dep.code !== 200 && dep.code !== 201) {
    console.log('   ✘ 上传失败（HTTP ' + dep.code + '）：' + (dep.raw || '').slice(0, 300));
    process.exit(1);
  }
  const deployId = dep.json.id;
  console.log('   ✔ deploy_id = ' + deployId);

  for (let i = 0; i < 40; i++) {
    const st = await api('GET', '/api/v1/deploys/' + deployId);
    const state = (st.json && st.json.state) || 'unknown';
    if (state === 'ready') {
      console.log('\n部署完成：');
      console.log('   ' + (st.json.ssl_url || st.json.deploy_ssl_url || site.json.ssl_url || site.json.url));
      process.exit(0);
    }
    if (state === 'error') {
      console.log('   ✘ 部署出错：' + JSON.stringify(st.json.error_message || '').slice(0, 300));
      process.exit(1);
    }
    await sleep(3000);
  }
  console.log('超时：请到 Netlify 后台查看部署状态（site_id=' + siteId + '）');
})();
