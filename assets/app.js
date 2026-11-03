/* ============================================================
   《明朝那些事儿》九册通览 —— 图表与联动
   纯原生 JS，无依赖，file:// 可开
   ============================================================ */
(function () {
  'use strict';
  const M = window.MING;
  const Y0 = M.meta.ch0, Y1 = M.meta.y1, NY = Y1 - Y0 + 1;   /* 图表轴：1352—1644 */
  const DY0 = M.meta.y0;                                      /* 王朝纪年：1368 */
  const CAT = M.cats;
  const CATC = { 战: '#a8322c', 政: '#7b4fa8', 制: '#8a6a3b', 外: '#2f7cb6', 文: '#3f8f6f', 灾: '#c07a1e' };

  const $ = (id) => document.getElementById(id);
  const E = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mi = (y, m) => y * 12 + m;
  const cw = (ch) => (/[\x00-\x7f]/.test(ch) ? 0.55 : 1);       // 字宽系数
  const tw = (s, fs) => { let w = 0; for (const c of String(s)) w += cw(c); return w * fs; };
  function fit(s, maxW, start, min) {
    let fs = start;
    while (fs > min && tw(s, fs) > maxW) fs -= 0.5;
    return fs;
  }
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
  const ym = (y, m) => y + '.' + pad2(m);
  function dur(m) { return (m >= 12 ? Math.floor(m / 12) + '年' : '') + (m % 12 ? (m % 12) + '个月' : (m >= 12 ? '' : m + '个月')); }

  /* 一维挤位：items = [{x,w,slack,target}]，x 为中心 */
  function spread(items, lo, hi, pad) {
    if (items.length < 2) return items;
    items.sort((a, b) => a.x - b.x);
    for (let it = 0; it < 240; it++) {
      let moved = false;
      for (let i = 1; i < items.length; i++) {
        const A = items[i - 1], B = items[i];
        const need = (A.w + B.w) / 2 + pad;
        const gap = B.x - A.x;
        if (gap < need - 0.05) {
          const d = (need - gap);
          const sa = A.slack === 999 ? 1 : Math.min(1, A.slack / d * 1.0);
          const sb = B.slack === 999 ? 1 : Math.min(1, B.slack / d * 1.0);
          const k = (sa + sb) || 1;
          const da = d * (sa / k), db = d * (sb / k);
          A.x -= da / 2 * 2 * 0.5; B.x += db / 2 * 2 * 0.5;
          moved = true;
        }
      }
      items.forEach((o) => { o.x = Math.max(lo + o.w / 2, Math.min(hi - o.w / 2, o.x)); });
      if (!moved) break;
    }
    /* 回中 */
    for (let it = 0; it < 40; it++) {
      let moved = false;
      for (const o of items) {
        const d = o.target - o.x;
        if (Math.abs(d) > 0.4) {
          const nx = o.x + Math.sign(d) * Math.min(1.5, Math.abs(d));
          const idx = items.indexOf(o);
          const prev = items[idx - 1], next = items[idx + 1];
          const okL = !prev || nx - o.w / 2 > prev.x + prev.w / 2 + pad - 0.6;
          const okR = !next || nx + o.w / 2 < next.x - next.w / 2 - pad + 0.6;
          if (okL && okR) { o.x = nx; moved = true; }
        }
      }
      if (!moved) break;
    }
    return items;
  }

  /* ============================================================
     01 年表（原生像素：不做整体缩放，靠「每年多少像素」+ 横向拖动）
     ============================================================ */
  const LABW = 258, RPAD = 26, ROWTOP = 76, NROW = M.emps.length + 1;
  let ROWH = 26;                       /* 行高随可视高度自适应：默认把卡片高度撑满 */
  function geo(p) {
    const W = (Y1 - Y0 + 1) * p + RPAD;
    const DENSY = ROWTOP + NROW * ROWH + 12;
    return { W, H: DENSY + 38, LABW, X0: 0, X1: W - RPAD, PX: p, ROWTOP, ROWH, N: NROW, DENSY };
  }
  let pxy = 7.2;                 /* 每年多少像素（默认；可 3—16） */
  let GEO = geo(pxy);
  const xf = (fy) => GEO.X0 + (fy - Y0) * GEO.PX;

  let curYear = 1449, curEmp = null;

  const empByKey = {};
  M.emps.forEach((e) => { empByKey[e.key] = e; });
  /* 行顺序＝即位顺序；第 0 行是「元末」前朝车道（1368 年之前不参与归年） */
  const PRE = { key: '__pre', pre: true, miao: '元末', name: '建国前', nh: '元',
    sy: Y0, sm: 1, ey: DY0, em: 1, months: 0, ping: '', end: '', ling: '—', vol: '壹',
    y1: 1328, y2: 1398, nhList: [], segs: [] };
  const rows = [PRE].concat(M.emps.slice().sort((a, b) => mi(a.sy, a.sm) - mi(b.sy, b.sm)));
  const rowOf = {};
  rows.forEach((e, i) => { rowOf[e.key] = i; });

  const evByYear = {};
  M.events.forEach((ev) => {
    const [y, m, c, t, d, v] = ev;
    (evByYear[y] = evByYear[y] || []).push({ y, m, c, t, d, v });
  });
  const apxByYear = {};
  M.appendix.forEach((a) => { (apxByYear[a.year] = apxByYear[a.year] || []).push(a); });

  /* 左侧固定列：庙号·姓名 / 年号 / 在位时长（跟着时间轴的行高对齐，不随横向拖动跑掉） */
  function renderLabels() {
    const g = GEO, out = [];
    out.push('<svg width="' + LABW + '" height="' + g.H + '" viewBox="0 0 ' + LABW + ' ' + g.H + '" ' +
      'font-family="\'PingFang SC\',\'Microsoft YaHei\',sans-serif">');
    out.push('<rect x="0" y="0" width="' + LABW + '" height="' + g.H + '" fill="#fffdfb"/>');
    out.push('<text x="12" y="21" font-size="12.5" fill="#9c9c9c" text-anchor="start" ' +
      'style="letter-spacing:.1em">九 册</text>');
    out.push('<line x1="0" y1="40" x2="' + LABW + '" y2="40" stroke="#dcd8d2"/>');
    out.push('<text x="12" y="68" font-size="11.5" fill="#9a948c" text-anchor="start">皇帝</text>');
    out.push('<text x="' + (LABW - 96) + '" y="68" font-size="11.5" fill="#9a948c" text-anchor="start">年号</text>');
    out.push('<text x="' + (LABW - 10) + '" y="68" font-size="11.5" fill="#9a948c" text-anchor="end">在位</text>');
    rows.forEach((e, i) => {
      const cy = g.ROWTOP + i * g.ROWH + g.ROWH / 2;
      const sel = curEmp === e.key;
      if (sel) out.push('<rect x="2" y="' + (cy - g.ROWH / 2 + 1) + '" width="' + (LABW - 2) + '" height="' +
        (g.ROWH - 2) + '" fill="#f8eceb" rx="2"/>');
      out.push('<text x="12" y="' + (cy + 5.2) + '" font-size="15.5" text-anchor="start" ' +
        'fill="' + (e.pre ? '#9c9188' : sel ? '#9e2b25' : '#3b3b3b') + '" font-weight="' + (sel ? '600' : '400') +
        '" style="font-family:\'Songti SC\',\'SimSun\',serif;letter-spacing:.02em">' +
        E(e.pre ? '元末 群雄' : (e.miao + ' ' + e.name)) + '</text>');
      out.push('<text x="' + (LABW - 96) + '" y="' + (cy + 4) + '" font-size="10.5" fill="#b0aaa2" ' +
        'text-anchor="start" style="letter-spacing:.03em">' + E(e.pre ? '' : e.nh.split(' / ')[0]) + '</text>');
      out.push('<text x="' + (LABW - 10) + '" y="' + (cy + 4) + '" font-size="11" fill="#a8a29a" text-anchor="end" ' +
        'style="font-variant-numeric:tabular-nums">' + E(e.pre ? '' : dur(e.months)) + '</text>');
      out.push('<line x1="0" y1="' + (cy + g.ROWH / 2 - 0.5) + '" x2="' + LABW + '" y2="' +
        (cy + g.ROWH / 2 - 0.5) + '" stroke="#f6f3ef"/>');
    });
    out.push('</svg>');
    $('chartLabels').innerHTML = out.join('');
  }

  function renderChart() {
    const g = (GEO = geo(pxy));
    renderLabels();
    const out = [], labelBuf = [];
    out.push('<svg width="' + g.W + '" height="' + g.H + '" viewBox="0 0 ' + g.W + ' ' + g.H + '" ' +
      'xmlns="http://www.w3.org/2000/svg" font-family="\'PingFang SC\',\'Microsoft YaHei\',sans-serif" id="chartSvg">');
    out.push('<rect x="0" y="0" width="' + g.W + '" height="' + g.H + '" fill="#fffdfb"/>');

    /* --- 九册色带 --- */
    const vhue = ['#8c5a4a', '#9a5b3f', '#a8763c', '#7f7a3e', '#4f7a5c', '#467a8c', '#4a6a9a', '#6f5a92', '#8c4a52'];
    M.vols.forEach((v, i) => {
      const xa = xf(Math.max(v.y1, Y0)), xb = xf(Math.min(v.y2 + 1, Y1 + 1));
      out.push('<rect x="' + xa.toFixed(1) + '" y="6" width="' + (xb - xa).toFixed(1) + '" height="20" fill="' +
        vhue[i] + '" opacity="' + (curVolSel === v.code ? 0.98 : 0.74) + '" rx="2"/>');
      const lbl = '第' + v.code + '册', fs = fit(lbl, xb - xa - 8, 13, 8.5);
      if (tw(lbl, fs) <= xb - xa - 6) {
        out.push('<text x="' + ((xa + xb) / 2).toFixed(1) + '" y="20.5" font-size="' + fs + '" fill="#fff" ' +
          'text-anchor="middle" style="letter-spacing:.06em">' + E(lbl) + '</text>');
      }
    });

    /* --- 年份轴（颗粒度：宽时每 5 年一个标签，窄时每 10 年） --- */
    out.push('<line x1="' + g.X0 + '" y1="40" x2="' + g.X1 + '" y2="40" stroke="#dcd8d2"/>');
    const AXSTEP = pxy >= 6.5 ? 5 : 10;
    const axisItems = [];
    for (let y = 1360; y <= Y1; y += AXSTEP) {
      const x = xf(y), big = y % 20 === 0;
      out.push('<line x1="' + x.toFixed(1) + '" y1="40" x2="' + x.toFixed(1) + '" y2="' + (big ? 50 : 46) +
        '" stroke="' + (big ? '#b9b2a8' : '#d5cfc6') + '"/>');
      axisItems.push({ x: x, w: tw(String(y), 12.5), target: x, slack: 999, t: String(y), big: big });
    }
    spread(axisItems, g.X0, g.X1, 4);
    axisItems.forEach((a) => {
      out.push('<text x="' + a.x.toFixed(1) + '" y="68" font-size="' + (a.big ? 13 : 11.5) + '" fill="' +
        (a.big ? '#6f6a63' : '#9a948c') + '" text-anchor="middle" ' +
        'style="font-variant-numeric:tabular-nums">' + a.t + '</text>');
    });

    /* --- 每年一根刻线：1 / 5 / 10 年三级 --- */
    for (let y = Y0; y <= Y1; y++) {
      const x = xf(y), y10 = y % 10 === 0, y5 = y % 5 === 0;
      out.push('<line x1="' + x.toFixed(1) + '" y1="74" x2="' + x.toFixed(1) + '" y2="' + (g.DENSY - 4) +
        '" stroke="' + (y10 ? '#e6e0d7' : y5 ? '#efeae2' : '#f8f5f0') + '"/>');
    }
    out.push('<line x1="' + xf(DY0).toFixed(1) + '" y1="74" x2="' + xf(DY0).toFixed(1) + '" y2="' + (g.DENSY - 4) +
      '" stroke="#cdbca8" stroke-width="1.5" stroke-dasharray="5 4"/>');
    out.push('<text x="' + (xf(DY0) + 4).toFixed(1) + '" y="79" font-size="10.5" fill="#b09a86">1368 建国</text>');

    /* --- 行 --- */
    rows.forEach((e, i) => {
      const cy = g.ROWTOP + i * g.ROWH + g.ROWH / 2;
      const sel = curEmp === e.key;
      if (sel) {
        out.push('<rect x="0" y="' + (cy - g.ROWH / 2 + 1) + '" width="' + g.W + '" height="' + (g.ROWH - 2) +
          '" fill="#f8eceb" rx="2"/>');
      }
      if (e.pre) {
        const xa = xf(Y0), xb = xf(DY0);
        out.push('<rect x="' + xa.toFixed(1) + '" y="' + (cy - 7) + '" width="' + (xb - xa).toFixed(1) +
          '" height="14" rx="2" fill="#ece7df"/>');
        labelBuf.push('<text x="' + ((xa + xb) / 2).toFixed(1) + '" y="' + (cy + 4.2) +
          '" font-size="11" text-anchor="middle" fill="#a89c8e" style="letter-spacing:.08em">元末群雄</text>');
        out.push('<line x1="0" y1="' + (cy + g.ROWH / 2 - 0.5) + '" x2="' + g.W + '" y2="' +
          (cy + g.ROWH / 2 - 0.5) + '" stroke="#f6f3ef"/>');
        return;
      }
      M.segs.filter((s) => s.emp === e.key).forEach((s) => {
        const fa = s.sy + (s.sm - 1) / 12, fb = s.ey + (s.em - 1) / 12;
        const xa = xf(fa), xb = xf(fb), bw = Math.max(3, xb - xa);
        out.push('<rect x="' + xa.toFixed(1) + '" y="' + (cy - 7) + '" width="' + bw.toFixed(1) +
          '" height="14" rx="2" fill="' + (sel ? '#c0483f' : '#e2bcb6') + '"/>');
        const w = tw(s.n, 13), inside = w + 4 <= bw;
        if (inside) {
          labelBuf.push('<text x="' + ((xa + xb) / 2).toFixed(1) + '" y="' + (cy + 4.4) + '" font-size="13" ' +
            'text-anchor="middle" fill="' + (sel ? '#fff' : '#7d3c36') + '" style="letter-spacing:.06em">' + E(s.n) + '</text>');
        } else {
          let lx = xb + 7, anchor = 'start';
          if (lx + w > g.X1) { lx = xa - 7; anchor = 'end'; }
          out.push('<line x1="' + xb.toFixed(1) + '" y1="' + cy + '" x2="' + (anchor === 'start' ? lx - 2 : lx + 2).toFixed(1) +
            '" y2="' + cy + '" stroke="#c9a49f" stroke-width="1"/>');
          labelBuf.push('<text x="' + lx.toFixed(1) + '" y="' + (cy + 4.4) + '" font-size="13" text-anchor="' + anchor +
            '" fill="#9e2b25" style="letter-spacing:.06em">' + E(s.n) + '</text>');
        }
      });
      out.push('<line x1="0" y1="' + (cy + g.ROWH / 2 - 0.5) + '" x2="' + g.W + '" y2="' +
        (cy + g.ROWH / 2 - 0.5) + '" stroke="#f6f3ef"/>');
    });

    /* --- 大事刻（先刻后字） --- */
    const marks = [];
    M.events.forEach((ev) => {
      const y = ev[0], m = ev[1], c = ev[2], t = ev[3];
      const key = y < DY0 ? '__pre' : M.owner[y];
      const rk = rowOf[key];
      if (rk === undefined) return;
      const cy = g.ROWTOP + rk * g.ROWH + g.ROWH / 2;
      const x = m ? xf(y + (m - 1) / 12) : xf(y + 0.5);
      marks.push('<rect x="' + (x - 1.5).toFixed(1) + '" y="' + (cy - 17) + '" width="3" height="10" ' +
        'fill="' + CATC[c] + '" opacity=".9"><title>' + E(y + (m ? '.' + pad2(m) : '') + ' · ' + CAT[c] + ' · ' + t) +
        '</title></rect>');
    });
    out.push(marks.join(''));
    out.push(labelBuf.join(''));

    /* --- 底部：附录大事记年度密度 --- */
    const maxd = Math.max.apply(null, Object.values(M.evByYear));
    const base = g.H - 16;
    out.push('<line x1="' + g.X0 + '" y1="' + base + '" x2="' + g.X1 + '" y2="' + base + '" stroke="#e5e2dd"/>');
    for (let y = Y0; y <= Y1; y++) {
      const n = M.evByYear[y] || 0;
      if (!n) continue;
      const h = Math.max(2.5, (n / maxd) * 24);
      out.push('<rect x="' + (xf(y) + 1).toFixed(1) + '" y="' + (base - h).toFixed(1) + '" width="' +
        Math.max(2, g.PX - 2).toFixed(1) + '" height="' + h.toFixed(1) + '" fill="#cabda4" opacity=".92">' +
        '<title>' + E(y + ' 年：' + n + ' 条大事记') + '</title></rect>');
    }
    /* --- 选中年份竖线 --- */
    const sx = xf(curYear + 0.5);
    out.push('<line x1="' + sx.toFixed(1) + '" y1="40" x2="' + sx.toFixed(1) + '" y2="' + (base + 4) +
      '" stroke="#9e2b25" stroke-width="1.4" stroke-dasharray="4 3" opacity=".85"/>');
    out.push('<circle cx="' + sx.toFixed(1) + '" cy="' + base + '" r="3.4" fill="#9e2b25"/>');
    out.push('<text x="' + sx.toFixed(1) + '" y="' + (base + 14) + '" font-size="12.5" fill="#9e2b25" ' +
      'text-anchor="middle" font-weight="600" style="font-variant-numeric:tabular-nums">' + curYear + '</text>');

    out.push('</svg>');
    $('chart').innerHTML = out.join('');
    applyZoom();
  }

  let curVolSel = null;

  /* 图例 */
  function renderLegend() {
    const items = Object.keys(CATC).map((k) =>
      '<span><i style="background:' + CATC[k] + '"></i>' + CAT[k] + '</span>').join('');
    $('chartLegend').innerHTML = items +
      '<span><u style="background:#e0b6b0"></u>在位区间</span>' +
      '<span><u style="background:#c9bda8"></u>附录大事记年份密度</span>' +
      '<span style="color:#9e2b25">虚线＝当前选中年份</span>';
  }

  /* 说明条（固定高度，防止切换时上下跳动） */
  function renderNote(y) {
    const ow = M.owner[y];
    const e = ow ? empByKey[ow] : null;
    const nh = e ? nhOf(e, y) : '';
    const evs = evByYear[y] || [], apx = apxByYear[y] || [];
    let s = '<b>' + y + ' 年</b>' + (nh ? '（' + nh + '）' : '') +
      (e ? ' · 在位：<b>' + E(e.miao + e.name) + '</b>' : '') +
      ' · 本年大事 <b>' + evs.length + '</b> 条、原书附录 <b>' + apx.length + '</b> 条';
    if (evs.length) s += '。<span style="color:#8a8a8a">' + evs.slice(0, 2).map((x) => x.t).join(' / ') + '</span>';
    else if (apx.length) s += '。<span style="color:#8a8a8a">' + E(apx[0].text.slice(0, 34)) + '…</span>';
    else s += '。<span style="color:#8a8a8a">这一年原书没有单独的附录条目——大事记的疏密本身也是史料。</span>';
    $('noteBar').innerHTML = s;
  }
  function nhOf(e, y) {
    if (!e) return '';
    for (const n of e.nhList) if (y >= n.y1 && y <= n.y2) {
      return n.n + (y - n.y1 + 1) + '年';
    }
    return e.nh.split(' / ')[0] + '年间';
  }

  /* ---------- 年份详情 ---------- */
  function renderDetail() {
    const y = curYear, ow = M.owner[y], e = ow ? empByKey[ow] : null;
    const evs = (evByYear[y] || []).slice().sort((a, b) => (a.m || 13) - (b.m || 13));
    const apx = (apxByYear[y] || []).slice();
    const vol = M.vols.filter((v) => y >= v.y1 && y <= v.y2);
    const h = [];
    h.push('<div class="dt-year"><div class="yh"><span class="big">' + y + '</span>' +
      '<span class="nh">' + (e ? E(nhOf(e, y)) : (y < DY0 ? '元末' : '')) + '</span></div>');
    if (e) {
      h.push('<div class="who">在位：<b>' + E(e.miao + ' ' + e.name) + '</b>　第' + (e.ord || '') + '任　' + E(e.nh) +
        '　' + E(e.segTxt) + '（' + dur(e.months) + '）</div>');
      if (vol.length) h.push('<div class="who">所属：' + vol.map((v) =>
        '<b>第' + v.code + '册</b>《' + E(v.title) + '》').join('　') + '</div>');
    } else {
      h.push('<div class="who">明尚未建立——本年属于元末群雄并起的阶段，朱元璋尚未称帝。</div>');
      if (vol.length) h.push('<div class="who">叙事所属：' + vol.map((v) =>
        '<b>第' + v.code + '册</b>《' + E(v.title) + '》').join('　') + '</div>');
    }
    h.push('</div>');

    if (evs.length) {
      h.push('<ul class="ev-list">');
      evs.forEach((x) => {
        h.push('<li><span class="tag" style="background:' + CATC[x.c] + '">' + CAT[x.c] + '</span>' +
          '<span class="tx"><b>' + E(x.t) + '</b>' + (x.m ? '　<span style="color:#9c9c9c;font-size:11px">' + x.m + '月</span>' : '') +
          '<br><span style="color:#5b5b5b">' + E(x.d) + '</span>' +
          '<span style="color:#b0aaa2;font-size:11px">　第' + x.v + '册</span></span></li>');
      });
      h.push('</ul>');
    }
    if (apx.length) {
      h.push('<ul class="ev-list">');
      apx.forEach((a) => {
        h.push('<li><span class="tag raw">附录</span><span class="tx">' + E(a.text) + '</span></li>');
      });
      h.push('</ul>');
    }
    if (!evs.length && !apx.length) {
      h.push('<div class="dt-year" style="color:#8a8a8a;font-size:12.5px">' +
        '这一年原书没有单列大事条目。可以看看相邻年份，或者点下方按钮跳到最近的节点。</div>');
    }
    /* 最近节点 */
    const near = M.events.filter((v) => v[0] >= y - 3 && v[0] <= y + 3 && v[0] !== y);
    if (near.length) {
      h.push('<div class="timeline-line"><div style="font-size:11px;letter-spacing:.12em;color:#b0aaa2;margin-bottom:4px">前后三年</div>');
      near.slice(0, 8).forEach((v) => {
        h.push('<div class="tl-row"><span class="t">' + v[0] + (v[1] ? '.' + pad2(v[1]) : '') + '</span>' +
          '<span class="x">' + E(v[3]) + ' <span class="d">' + E(v[4].slice(0, 30)) + '</span></span></div>');
      });
      h.push('</div>');
    }
    /* 该帝简介 */
    if (e) {
      h.push('<div class="timeline-line" style="border-top:1px solid #f1efeb">' +
        '<div style="font-size:11px;letter-spacing:.12em;color:#b0aaa2;margin-bottom:5px">在位者</div>' +
        '<div style="font-size:12.5px;line-height:1.85;color:#3b3b3b">' + E(e.ping) + '</div>' +
        '<div style="font-size:11.5px;color:#8a8a8a;margin-top:7px">结局：' + E(e.end) + '　葬：' + E(e.ling) +
        '　生卒：' + e.y1 + '—' + (e.y2 || '?') + '</div></div>');
    }
    $('detail').innerHTML = h.join('');
    $('detailTitle').textContent = '详情';
    $('detail').scrollTop = 0;
    $('detailNav').innerHTML =
      '<button class="btn sm" data-step="-10">−10</button>' +
      '<button class="btn sm" data-step="-1">←</button>' +
      '<input id="yearInput" type="number" min="' + Y0 + '" max="' + Y1 + '" value="' + y + '" ' +
      'style="width:62px;text-align:center;font-variant-numeric:tabular-nums" title="输入年份后回车">' +
      '<button class="btn sm" data-step="1">→</button>' +
      '<button class="btn sm" data-step="10">+10</button>';
  }

  function selectYear(y, fromUser) {
    curYear = Math.max(Y0, Math.min(Y1, y | 0));
    curEmp = M.owner[curYear] || null;
    renderChart(); renderNote(curYear); renderDetail();
    const rg = $('yearRange');
    if (rg && +rg.value !== curYear) rg.value = curYear;
    $('yearNow').textContent = curYear;
    if (fromUser) {
      const st = $('chartStage');
      if (st && st.scrollWidth > st.clientWidth + 4) {
        const target = xf(curYear + 0.5) - st.clientWidth / 2;
        st.scrollLeft = Math.max(0, Math.min(st.scrollWidth - st.clientWidth, target));
      }
    }
  }

  /* ---------- 缩放与拖动：原生像素尺寸，宽度可溢出，横向拖动 ---------- */
  const PXY_MIN = 1.8, PXY_MAX = 16;
  function setPxy(p, keepYear) {
    pxy = Math.max(PXY_MIN, Math.min(PXY_MAX, p));
    renderChart();
    if (keepYear !== false) centerOn(curYear);
  }
  function centerOn(y) {
    const st = $('chartStage');
    if (!st) return;
    const target = xf(y + 0.5) - st.clientWidth / 2;
    st.scrollLeft = Math.max(0, Math.min(st.scrollWidth - st.clientWidth, target));
  }
  function fitPxy() {
    const st = $('chartStage');
    if (!st) return PXY_MIN;
    return Math.max(PXY_MIN, (st.clientWidth - 12 - RPAD) / (Y1 - Y0 + 1));
  }
  /* 适配＝把可视区铺满：宽度定每年像素，高度定行高（两者独立，因此不会被压小） */
  function fitAll() {
    const st = $('chartStage');
    if (!st) { renderChart(); return; }
    const availW = st.clientWidth, availH = st.clientHeight;
    if (availW > 80) pxy = fitPxy();
    if (availH > 160) {
      ROWH = Math.max(20, Math.min(36, Math.floor((availH - ROWTOP - 44) / NROW)));
    }
    renderChart();
    centerOn(curYear);
  }
  /* 默认视图：高度撑满 + 每年至少 6.8px（默认就是最大可读尺寸，全览交给「适配」） */
  function initView() { fitAll(); }
  function initViewSoon() {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(initView));
    else setTimeout(initView, 60);
  }
  /* 首次适配要等布局稳定 */
  function fitAllSoon() {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(fitAll));
    else setTimeout(fitAll, 60);
  }
  function applyZoom() {
    const stage = $('chartStage'), box = $('chart');
    if (!stage || !box) return;
    const svg = box.querySelector('svg');
    if (!svg) return;
    const w = GEO.W, h = GEO.H;
    if (svg.setAttribute) {
      svg.setAttribute('width', w);
      svg.setAttribute('height', h);
    }
    svg.style.width = w + 'px';
    svg.style.height = h + 'px';
    box.style.width = w + 'px';
    box.style.height = h + 'px';
    stage.style.justifyContent = 'flex-start';
    $('zoomVal').textContent = pxy.toFixed(1) + ' px/年';
  }

  /* ============================================================
     02 读法 · 检视阅读路线图
     ============================================================ */
  /* 题记排版：○ 分行（原书用全角空格分行，已保留为空格） */
  function tijiFmt(s) {
    return String(s)
      .replace(/\n/g, '\n')
      .replace(/○ /g, '○ ')
      .replace(/——题记/g, '')
      .trim();
  }
  /* 必读章原文：按册懒加载（<script> 注入，file:// 下同样可用） */
  const textState = {};
  function ensureText(code, cb) {
    if (window.MING_TEXT && hasText(code)) return cb();
    if (textState[code]) { textState[code].push(cb); return; }
    textState[code] = [cb];
    const url = (M.reading.textFiles || {})[code];
    if (!url) { textState[code] = null; return cb(); }
    const s = document.createElement('script');
    s.src = url;
    s.onload = s.onerror = function () {
      const q = textState[code] || [];
      textState[code] = null;
      q.forEach((f) => f());
    };
    (document.head || document.body).appendChild(s);
  }
  function hasText(code) {
    const T = window.MING_TEXT || {};
    for (const k in T) if (k.indexOf(code + '-') === 0) return true;
    return false;
  }
  function openText(tk, btn) {
    const box = $('tk-' + tk);
    if (!box) return;
    const code = tk.split('-')[0];
    ensureText(code, function () {
      const d = (window.MING_TEXT || {})[tk];
      if (!d) {
        box.innerHTML = '<div class="rt-m">原文未随本站分发（缺失 ' + E(tk) + '），可对照 PDF 第 ' +
          tk.split('-')[1] + ' 页起阅读。</div>';
        box.hidden = false;
        return;
      }
      const parts = d.paras.map((p) =>
        (/^[◆★]|^参考消息|^书内地图/.test(p) ? '<p class="sub-h">' + E(p) + '</p>'
          : '<p>' + E(p) + '</p>')).join('');
      box.innerHTML = '<div class="rt-m">原文照录 · ' + E(d.n) + '　p' + d.p1 + '—' + d.p2 +
        '　共 ' + d.paras.length + ' 段 · ' +
        d.paras.reduce((s, x) => s + x.length, 0) + ' 字（段落按原书断行还原，未改一字）</div>' + parts;
      box.hidden = !box.hidden;
      if (btn) btn.classList.toggle('on', !box.hidden);
    });
  }

  function renderReading() {
    const R = M.reading;
    /* 三条主线 */
    $('rdSpine').innerHTML = R.spine.map((s) =>
      '<div class="rd-sp"><b>' + E(s.t) + '</b><span>' + E(s.d) + '</span></div>').join('');
    /* 四幕 */
    $('rdActs').innerHTML = R.acts.map((a) =>
      '<div class="rd-act"><div class="ah"><span class="an">' + E(a.t.split(' · ')[1]) + '</span>' +
      '<span class="ay">' + E(a.y) + '</span><span class="av">' + E(a.vol) + '</span></div>' +
      '<div class="ad">' + E(a.d) + '</div></div>').join('');
    /* 九册路线图（必读章附：题记 + 原文，按册懒加载） */
    let mustN = 0, hMust = 0, hSkim = 0, mustC = 0;
    $('rdPlan').innerHTML = M.vols.map((v) => {
      const p = R.plan[v.code];
      mustN += p.must.length; hMust += p.hMust; hSkim += p.hSkim; mustC += p.mustChars;
      return '<section class="rp">' +
        '<div class="rp-h"><span class="rp-n">' + v.code + '</span>' +
        '<span class="rp-t2">' + E(v.title) + '</span>' +
        '<span class="rp-y">' + v.y1 + '—' + v.y2 + '　·　p' + v.p1 + '—' + v.p2 + '</span>' +
        '<span class="rp-time">必读 <b>' + p.must.length + '</b> 章（占本册 ' + p.mustPct + '%）　精读 <b>' +
        p.hMust.toFixed(1) + ' h</b>　其余略读 ' + p.hSkim.toFixed(1) + ' h</span></div>' +
        '<div class="rp-bar"><u style="width:' + p.mustPct + '%"></u></div>' +
        '<div class="rp-b"><ol class="rp-must">' +
        p.must.map((c) => '<li class="rp-item">' +
          '<div class="rp-line"><span class="rp-p">p' + c.p + '—' + c.p2 + '</span>' +
          '<span class="rp-cn">' + E(c.n) + '</span>' +
          '<span class="rp-w">' + E(c.why) + '</span>' +
          '<button class="rp-tg" data-tk="' + c.tk + '">原文</button></div>' +
          (c.tiji ? '<div class="rp-tiji">' + E(tijiFmt(c.tiji)) + '</div>' : '') +
          '<div class="rp-text" id="tk-' + c.tk + '" hidden></div></li>').join('') +
        '</ol><div class="rp-skim"><em>可略读</em>' + E(p.skim) + '</div></div></section>';
    }).join('');
  }

  /* ============================================================
     03 皇帝谱
     ============================================================ */
  let empSort = 'time';
  let figTier = 'all';
  let empTier = 'all';
  function renderEmps() {
    const tierOf = (e) => (M.empTier || {})[e.key] || 'T2';
    const cnt = { all: M.emps.length, T1: 0, T2: 0, T3: 0 };
    M.emps.forEach((e) => { const t = tierOf(e); cnt[t] = (cnt[t] || 0) + 1; });
    tierButtons('empTierGroup', empTier, cnt, 'data-etier');
    const eNote = $('empTierNote');
    if (eNote) eNote.innerHTML = '<b>T1</b> 结构改变 + 长时段（改制度／迁都／转格局，后果跨朝）' +
      '<b>T2</b> 重大事件，但影响限于本朝或可逆　<b>T3</b> 在位短、或政策不由己（悬停徽标看单条理由）';
    let list = M.emps.filter((e) => empTier === 'all' || tierOf(e) === empTier);
    if (empSort === 'dur') list.sort((a, b) => b.months - a.months);
    else if (empSort === 'short') list.sort((a, b) => a.months - b.months);
    else list.sort((a, b) => mi(a.sy, a.sm) - mi(b.sy, b.sm));
    const maxm = Math.max.apply(null, M.emps.map((e) => e.months));
    $('empGrid').innerHTML = list.map((e) => {
      const on = curEmp === e.key;
      const nhs = e.nhList.map((n) => n.n + '（' + n.y1 + (n.y2 !== n.y1 ? '—' + n.y2 : '') + '）').join('　');
      const tier = tierOf(e);
      return '<article class="emp ' + tier.toLowerCase() + (on ? ' on' : '') + '" data-emp="' + e.key + '">' +
        '<div class="n1"><span class="tier" title="' + E((M.empTierWhy || {})[e.key] || '') + '">' + tier + '</span>' +
        '<span class="miao">' + E(e.miao) + '</span><span class="nm">' + E(e.name) + '</span>' +
        '</div>' +
        '<div class="rng">' + E(e.segTxt) + '　·　在位 ' + dur(e.months) + '</div>' +
        '<div class="pbar"><u style="width:' + (e.months / maxm * 100).toFixed(1) + '%"></u></div>' +
        '<div class="ping">' + E(e.ping) + '</div>' +
        '<div class="end"><b>结局</b>：' + E(e.end) + '<br><b>葬</b>：' + E(e.ling) +
        '　<b>生卒</b>：' + e.y1 + '—' + (e.y2 || '?') + '<br><b>年号</b>：' + E(nhs) + '</div>' +
        '</article>';
    }).join('');
    const his = M.emps.reduce((s, e) => s + e.months, 0);
    $('empStat').innerHTML = '合计在位 <b>' + dur(his) + '</b>　平均 <b>' + (his / M.emps.length / 12).toFixed(1) + ' 年</b>';
  }

  /* ============================================================
     04 人物
     ============================================================ */
  /* 分级按钮组（T1 n / T2 n / T3 n），与节点区样式一致 */
  function tierButtons(boxId, cur, counts, attr) {
    const box = $(boxId);
    if (!box) return;
    const ks = ['all', 'T1', 'T2', 'T3'];
    box.innerHTML = ks.map((k) =>
      '<button class="btn sm' + (cur === k ? ' on' : '') + '" ' + attr + '="' + k + '">' +
      (k === 'all' ? '全部' : k) + ' <b style="font-weight:600">' + (counts[k] || 0) + '</b></button>').join('');
  }

  const RANK_ORDER = { nei: 1, bu: 2, feng: 3, jiang: 4, huan: 5, huang: 6, yan: 7, wen: 8, min: 9, wai: 10 };
  const TIER_CLS = { T1: 't1', T2: 't2', T3: 't3' };
  const DIM_TIP = {
    制度: '留下规则，而不只是办成事——废丞相、一条鞭法、考成法、隆庆开关、俺答封贡',
    军事: '改变格局的战役或建军——鄱阳湖、北京保卫战、戚家军、宁远、关宁锦防线',
    思想: '观念、学派、典籍、新知——心学、永乐大典、西学东渐',
    象征: '成为后来者的榜样与舆论武器——方孝孺、于谦、杨继盛、杨涟、海瑞',
    网络: '师承、举荐、门生、结党——徐阶→张居正、戚继光—张居正、东林书院'
  };
  function dimBars(d) {
    return '<span class="dims">' + (M.dimNames || ['制度', '军事', '思想', '象征', '网络']).map((n, k) =>
      '<i title="' + n + '（' + d[k] + '/5）：' + (DIM_TIP[n] || '') + '">' +
      '<b style="width:' + (d[k] * 20) + '%"></b><u>' + n + '</u></i>').join('') + '</span>';
  }
  function renderDimLegend() {
    const box = $('figDimLegend');
    if (!box) return;
    box.innerHTML = (M.dimNames || []).map((n, k) =>
      '<span class="dl" title="' + (DIM_TIP[n] || '') + '"><i>' + '①②③④⑤'[k] + '</i><b>' + n +
      '</b><u>' + (DIM_TIP[n] || '').split('——')[0] + '</u></span>').join('') +
      '<span class="dl dl-note">每维 0—5 分，圆点条越长越高；合计 ×4 折百</span>';
  }
  function renderFigs() {
    const q = ($('figSearch').value || '').trim();
    const vf = $('figVol').value || 'all';
    const rf = $('figRank').value || 'all';
    const lf = $('figRel').value || 'all';
    const tf = figTier;
    const sf = $('figSort').value || 'score';
    const pass = (f) => (vf === 'all' || f.vol === vf) && (rf === 'all' || f.rank === rf) &&
      (lf === 'all' || f.rel === lf) && (!q || (f.name + f.alt + f.role + f.one).indexOf(q) >= 0);
    const base = M.figs.filter(pass);
    const cnt = { all: base.length, T1: 0, T2: 0, T3: 0 };
    base.forEach((f) => { cnt[f.tier] = (cnt[f.tier] || 0) + 1; });
    tierButtons('figTierGroup', figTier, cnt, 'data-ftier');
    let list = base.filter((f) => tf === 'all' || f.tier === tf);
    if (sf === 'freq') list = list.slice().sort((x, y) => y.freq - x.freq);
    else if (sf === 'rank') list = list.slice().sort((x, y) => (RANK_ORDER[x.rank] - RANK_ORDER[y.rank]) || (y.score - x.score));
    else list = list.slice().sort((x, y) => y.score - x.score);
    $('figCount').textContent = list.length;
    renderDimLegend();
    const RN = M.rankNames, LN = M.relNames;
    $('figGrid').innerHTML = list.map((f) => {
      const e = empByKey[f.emp];
      return '<article class="fig ' + TIER_CLS[f.tier] + '">' +
        '<div class="fh"><span class="tier">' + f.tier + '</span><span class="fn">' + E(f.name) + '</span>' +
        (f.alt ? '<span class="fa">' + E(f.alt) + '</span>' : '') +
        '<span class="ff' + (f.neg ? ' neg' : '') + '">' + f.score + '</span></div>' +
        '<div class="fmeta"><i>' + E(RN[f.rank] || '') + '</i><i>' + E(LN[f.rel] || '') + '</i>' +
        '<u>' + (f.neg ? '负向' : '正向') + '</u></div>' +
        dimBars(f.dims) +
        '<div class="fo">' + E(f.one) + '</div>' +
        '<div class="fy">' + (f.y1 ? f.y1 + '—' + (f.y2 || '?') : '生卒不详') +
        '　·　' + (e ? E(e.miao + e.name) + '朝' : '') + '　第' + f.vol + '册</div>' +
        '</article>';
    }).join('');
  }

  /* ============================================================
     05 战役
     ============================================================ */
  let warCat = 'all';
  function renderWars() {
    const cats = ['all'].concat(Object.keys(CAT)).concat(['T1', 'T2', 'T3']);
    $('warFilter').innerHTML = cats.map((c) => {
      const isTier = c === 'T1' || c === 'T2' || c === 'T3';
      const n = c === 'all' ? M.events.length
        : isTier ? M.events.filter((e) => (M.evTier || {})[e[3]] === c).length
          : M.events.filter((e) => e[2] === c).length;
      return '<button class="btn sm' + (warCat === c ? ' on' : '') + '" data-cat="' + c + '">' +
        (c === 'all' ? '全部' : isTier ? c : CAT[c]) + ' ' + n + '</button>';
    }).join('');
    const isTier = warCat === 'T1' || warCat === 'T2' || warCat === 'T3';
    const list = M.events.filter((e) => warCat === 'all'
      || (isTier ? (M.evTier || {})[e[3]] === warCat : e[2] === warCat));
    const wNote = $('warTierNote');
    if (wNote) wNote.innerHTML = '<b>T1</b> 决定王朝走向（改结构、定归属、存亡之战）' +
      '<b>T2</b> 重要事件，未改格局　<b>T3</b> 局部或次要（悬停徽标看单条理由）';
    $('warGrid').innerHTML = list.map((v) => {
      const [y, m, c, t, d, vol] = v;
      const col = CATC[c];
      const tier = (M.evTier || {})[t] || 'T2';
      const cls = tier === 'T1' ? 'war t1' : tier === 'T3' ? 'war t3' : 'war t2';
      return '<article class="' + cls + '" style="border-left-color:' + col + '">' +
        '<div class="wh"><span class="wy">' + y + (m ? '.' + pad2(m) : '') + '</span>' +
        '<span class="wt">' + E(t) + '</span>' +
        '<span class="wv"><em class="tier" title="' + E((M.evTierWhy || {})[t] || (tier === 'T1' ? '决定王朝走向' : tier === 'T3' ? '局部或次要事件' : '重要事件，未改格局')) + '">' + tier + '</em>' + CAT[c] + ' · 第' + vol + '册</span></div>' +
        '<div class="wd">' + E(d) + '</div></article>';
    }).join('');
  }

  /* ============================================================
     06 数据表
     ============================================================ */
  function renderTables() {
    const h = ['<thead><tr><th>庙号</th><th>姓名</th><th>年号</th><th>即位</th><th>退位</th>' +
      '<th>在位</th><th>生卒</th><th>葬</th><th>册</th><th>结局</th></tr></thead><tbody>'];
    M.emps.forEach((e) => {
      h.push('<tr><td><b style="color:#9e2b25">' + E(e.miao) + '</b></td><td>' + E(e.name) + '</td>' +
        '<td>' + E(e.nh) + '</td><td class="num">' + ym(e.sy, e.sm) + '</td><td class="num">' + ym(e.ey, e.em) + '</td>' +
        '<td class="num">' + dur(e.months) + '</td><td class="num">' + e.y1 + '—' + (e.y2 || '?') + '</td>' +
        '<td>' + E(e.ling) + '</td><td class="num">' + e.vol + '</td><td>' + E(e.end) + '</td></tr>');
    });
    h.push('</tbody>');
    $('tblEmp').innerHTML = h.join('');
    renderApx();
  }
  function renderApx() {
    const q = ($('apxSearch').value || '').trim();
    const ef = $('apxEmp').value || 'all';
    const list = M.appendix.filter((a) => (ef === 'all' || a.emp === ef) &&
      (!q || a.text.indexOf(q) >= 0));
    const nameOf = {};
    M.emps.forEach((e) => { nameOf[e.key] = e.miao + ' ' + e.name; });
    const h = ['<thead><tr><th style="width:56px">年</th><th style="width:40px">月</th>' +
      '<th style="width:118px">皇帝</th><th>原书大事记</th></tr></thead><tbody>'];
    list.forEach((a) => {
      h.push('<tr><td class="num">' + a.year + '</td><td class="num">' + (a.month || '') + '</td>' +
        '<td>' + E(nameOf[a.emp] || '') + '</td><td>' + E(a.text) + '</td></tr>');
    });
    h.push('</tbody>');
    $('tblApx').innerHTML = h.join('');
    $('apxCount').textContent = '（' + list.length + ' / ' + M.appendix.length + ' 条）';
  }

  /* ============================================================
     导出
     ============================================================ */
  function dl(name, text, type) {
    const b = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1500);
  }
  const csv = (rows) => '\ufeff' + rows.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');

  /* ============================================================
     交互绑定
     ============================================================ */
  function bind() {
    /* 图表点击 */
    $('chart').addEventListener('click', function (ev) {
      const svg = $('chart').querySelector('svg');
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const scale = GEO.W / r.width;
      const x = (ev.clientX - r.left) * scale, y = (ev.clientY - r.top) * scale;
      /* 册带 */
      if (y < 24) {
        for (const v of M.vols) {
          if (x >= xf(v.y1) && x <= xf(v.y2 + 1)) {
            curVolSel = v.code;
            selectVol(v.code);
            return;
          }
        }
        return;
      }
      /* 行 */
      const i = Math.floor((y - GEO.ROWTOP) / GEO.ROWH);
      const yearF = Y0 + (x - GEO.X0) / GEO.PX;
      if (i >= 0 && i < GEO.N) {
        const e = rows[i];
        if (e.pre) { selectYear(Math.max(Y0, Math.min(DY0, Math.floor(yearF))), true); return; }
        const fy = yearF;
        const inside = fy >= e.sy + (e.sm - 1) / 12 - 0.2 && fy <= e.ey + (e.em - 1) / 12 + 1.2;
        selectYear(inside ? Math.floor(fy) : Math.round((mi(e.sy, e.sm) + mi(e.ey, e.em)) / 24), true);
        return;
      }
      selectYear(Math.floor(yearF), true);
    });
    $('chart').addEventListener('mousemove', function (ev) {
      const svg = $('chart').querySelector('svg');
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const scale = GEO.W / r.width;
      const y = (ev.clientY - r.top) * scale;
      const i = Math.floor((y - GEO.ROWTOP) / GEO.ROWH);
      $('chartHint').textContent = (i >= 0 && i < GEO.N)
        ? (rows[i].pre ? '元末 · 建国前（1368 年前不参与归年）'
          : rows[i].miao + rows[i].name + ' · ' + rows[i].nh + ' · 在位' + dur(rows[i].months))
        : '点击行 / 年份联动右侧';
    });

    /* 年份滑块 */
    $('yearRange').addEventListener('input', function () { selectYear(+this.value, true); });
    $('yearRange').addEventListener('change', function () { selectYear(+this.value, true); });

    /* 年份前后 */
    const jump = (v) => {
      v = parseInt(v, 10);
      if (v >= Y0 && v <= Y1) selectYear(v, true);
    };
    $('detailNav').addEventListener('click', function (ev) {
      const t = ev.target.closest('[data-step]');
      if (t) jump(curYear + (+t.dataset.step));
    });
    $('detailNav').addEventListener('change', function (ev) {
      if (ev.target && ev.target.id === 'yearInput') jump(ev.target.value);
    });
    $('detailNav').addEventListener('keydown', function (ev) {
      if (!ev.target || ev.target.id !== 'yearInput') return;
      if (ev.key === 'Enter') jump(ev.target.value);
    });

    /* 缩放（每年像素）+ 拖动 */
    document.querySelectorAll('[data-zoom]').forEach((b) => {
      b.addEventListener('click', function () {
        const k = this.dataset.zoom;
        if (k === 'in') setPxy(pxy * 1.25);
        else if (k === 'out') setPxy(pxy / 1.25);
        else fitAll();
      });
    });
    (function dragPan() {
      const st = $('chartStage');
      if (!st || !st.addEventListener) return;
      let down = false, x0 = 0, s0 = 0;
      st.addEventListener('mousedown', function (ev) {
        if (ev.button !== 0) return;
        down = true; x0 = ev.clientX; s0 = st.scrollLeft;
        st.classList.add('dragging');
        ev.preventDefault();
      });
      window.addEventListener('mousemove', function (ev) {
        if (!down) return;
        st.scrollLeft = s0 - (ev.clientX - x0);
      });
      window.addEventListener('mouseup', function () {
        if (!down) return;
        down = false;
        st.classList.remove('dragging');
      });
      /* 触屏拖动 */
      let tx = 0, ts = 0;
      st.addEventListener('touchstart', function (ev) {
        if (ev.touches.length !== 1) return;
        tx = ev.touches[0].clientX; ts = st.scrollLeft;
      }, { passive: true });
      st.addEventListener('touchmove', function (ev) {
        if (ev.touches.length !== 1) return;
        st.scrollLeft = ts - (ev.touches[0].clientX - tx);
      }, { passive: true });
      /* 滚轮：Shift 或横向手势 → 横移 */
      st.addEventListener('wheel', function (ev) {
        if (ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) {
          st.scrollLeft += (ev.deltaX || ev.deltaY);
          ev.preventDefault();
        }
      }, { passive: false });
    })();

    /* 必读章「原文」开关 */
    $('rdPlan').addEventListener('click', function (ev) {
      const b = ev.target.closest('.rp-tg');
      if (!b) return;
      const box = $('tk-' + b.dataset.tk);
      if (box && !box.hidden && box.innerHTML) {
        box.hidden = true;
        b.classList.remove('on');
        return;
      }
      openText(b.dataset.tk, b);
    });
    /* 皇帝 */
    $('empGrid').addEventListener('click', function (ev) {
      const c = ev.target.closest('[data-emp]');
      if (!c) return;
      const k = c.dataset.emp, e = empByKey[k];
      selectYear(Math.round((mi(e.sy, e.sm) + mi(e.ey, e.em)) / 24), true);
      document.getElementById('timeline').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('figTierGroup').addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-ftier]');
      if (!b) return;
      figTier = b.getAttribute('data-ftier');
      renderFigs();
    });
    $('empTierGroup').addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-etier]');
      if (!b) return;
      empTier = b.getAttribute('data-etier');
      renderEmps();
    });
    document.querySelectorAll('[data-empsort]').forEach((b) => {
      b.addEventListener('click', function () {
        document.querySelectorAll('[data-empsort]').forEach((x) => x.classList.remove('on'));
        this.classList.add('on');
        empSort = this.dataset.empsort;
        renderEmps();
      });
    });

    /* 人物筛选 */
    $('figSearch').addEventListener('input', renderFigs);
    $('figVol').addEventListener('change', renderFigs);
    $('figRank').addEventListener('change', renderFigs);
    $('figRel').addEventListener('change', renderFigs);

    $('figSort').addEventListener('change', renderFigs);

    /* 战役筛选 */
    $('warFilter').addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-cat]');
      if (!b) return;
      warCat = b.dataset.cat;
      renderWars();
    });

    /* 表格 */
    $('apxSearch').addEventListener('input', renderApx);
    $('apxEmp').addEventListener('change', renderApx);

    /* 导出 */
    $('expEv').addEventListener('click', () =>
      dl('明朝那些事儿-大事记.csv', csv([['年', '月', '类别', '标题', '简述', '册']].concat(
        M.events.map((e) => [e[0], e[1] || '', CAT[e[2]], e[3], e[4], '第' + e[5] + '册'])))));
    $('expEmp').addEventListener('click', () =>
      dl('明朝那些事儿-十六帝.csv', csv([['庙号', '姓名', '年号', '即位', '退位', '在位月数', '在位', '生', '卒', '陵', '册', '结局']]
        .concat(M.emps.map((e) => [e.miao, e.name, e.nh, ym(e.sy, e.sm), ym(e.ey, e.em), e.months,
          dur(e.months), e.y1, e.y2 || '', e.ling, e.vol, e.end])))));
    $('expFig').addEventListener('click', () =>
      dl('明朝那些事儿-人物.csv', csv([['姓名', '别名', '身份', '生', '卒', '首次页', '提及次数', '主册']]
        .concat(M.figs.map((f) => [f.name, f.alt, f.role, f.y1 || '', f.y2 || '', f.page, f.freq, f.vol])))));
    $('expJson').addEventListener('click', () => dl('明朝那些事儿-数据.json', JSON.stringify(M, null, 1), 'application/json'));

    let rzT = null;
    window.addEventListener('resize', () => {
      clearTimeout(rzT);
      rzT = setTimeout(initView, 160);
    });
  }

  function selectVol(code) {
    curVolSel = code;          /* 只高亮年表顶部的九册色带 */
    renderChart();
  }

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    /* 头部数字 */
    $('stVol').textContent = M.vols.length;
    $('stEmp').textContent = M.emps.length;
    $('stSpan').textContent = (Y1 - DY0);
    $('stEvent').textContent = M.appendix.length;
    $('stFig').textContent = M.figs.length;
    $('stChar').textContent = Math.round(M.meta.chars / 10000) + '万';
    $('topHint').textContent = M.meta.author + ' · ' + M.emps.length + ' 帝 · ' + (Y1 - Y0 + 1) + ' 年 · ' +
      M.vols.length + ' 册 ' + M.meta.pages + ' 页';

    /* 人物/附录下拉 */
    const rkSel = $('figRank');
    Object.keys(M.rankNames).forEach((k) => rkSel.insertAdjacentHTML('beforeend',
      '<option value="' + k + '">' + M.rankNames[k] + '</option>'));
    const rlSel = $('figRel');
    Object.keys(M.relNames).forEach((k) => rlSel.insertAdjacentHTML('beforeend',
      '<option value="' + k + '">' + M.relNames[k] + '</option>'));
    const volSel = $('figVol');
    M.vols.forEach((v) => { volSel.insertAdjacentHTML('beforeend', '<option value="' + v.code + '">第' + v.code + '册</option>'); });
    const empSel = $('apxEmp');
    M.emps.forEach((e) => { empSel.insertAdjacentHTML('beforeend', '<option value="' + e.key + '">' + e.miao + e.name + '</option>'); });

    renderLegend();
    renderChart();
    renderNote(curYear);
    renderDetail();
    renderReading();
    renderEmps();
    renderFigs();
    renderWars();
    renderTables();
    bind();
    selectYear(1449);
    initViewSoon();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  /* 供离线验收脚本调用（页面无 UI 入口） */
  window.__MING_DEBUG = { openText: openText, ensureText: ensureText, hasText: hasText };
})();
