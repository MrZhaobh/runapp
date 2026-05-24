// 注入到每个 WebView 页面 (本地 + 远程 GitHub Pages)
// 职责: 记录 URL 历史, 提供悬浮按钮 + 历史抽屉 UI
(function () {
  if (window.__QL_SHELL_INJECTED__) return;
  window.__QL_SHELL_INJECTED__ = true;

  var DEFAULT_URL = 'https://mrzhaobh.github.io/runapp/';
  var INSET_CACHE_KEY = '__ql_top_inset_px__';

  // 沉浸式适配: 测量 safe-area-inset-top, 只在 env() 失效时兜底.
  // 第一次加载 env() 真 (例如 40px) → HTML 的 .container env padding 自己生效, 缓存值.
  // location.reload() 后 WebView 的 env() 会返回 0 → HTML 的 padding 失效,
  // 这里给 documentElement 加缓存的 padding-top 兜底, 避免标题被刘海遮挡.
  function applyTopInset() {
    var probe = document.createElement('div');
    probe.style.cssText = 'padding-top:env(safe-area-inset-top,0);position:fixed;visibility:hidden;left:-9999px;top:0';
    (document.body || document.documentElement).appendChild(probe);
    var measured = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.parentNode.removeChild(probe);

    if (measured > 0) {
      // env() 正常,HTML 自己的 .container env padding 已生效, 只缓存等以后用
      try { localStorage.setItem(INSET_CACHE_KEY, String(measured)); } catch (e) {}
      return;
    }
    // env() 失效, 用缓存兜底
    var cached = 0;
    try { cached = parseFloat(localStorage.getItem(INSET_CACHE_KEY) || '0'); } catch (e) {}
    if (cached > 0) {
      document.documentElement.style.paddingTop = cached + 'px';
      document.documentElement.style.boxSizing = 'border-box';
    }
  }
  if (document.body) applyTopInset();
  else document.addEventListener('DOMContentLoaded', applyTopInset);

  function invoke(cmd, args) {
    try {
      // Tauri 2 with withGlobalTauri: true
      if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
        return window.__TAURI__.core.invoke(cmd, args || {});
      }
      // Always-available internal API (no global)
      if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
        return window.__TAURI_INTERNALS__.invoke(cmd, args || {});
      }
    } catch (e) {}
    return Promise.resolve(null);
  }

  var lastRecorded = '';
  function recordCurrent() {
    var url = location.href;
    if (!/^https?:/i.test(url)) return;
    if (url === lastRecorded) return; // 同一 URL 不重复打,避免 setInterval 刷屏
    lastRecorded = url;
    invoke('record_url', { url: url, title: document.title || url });
  }

  // 多路径并联,任何能改 location 的事件都打一次:
  window.addEventListener('pageshow', function () { setTimeout(recordCurrent, 100); });
  window.addEventListener('load', recordCurrent);
  document.addEventListener('DOMContentLoaded', recordCurrent);
  window.addEventListener('popstate', recordCurrent);
  window.addEventListener('hashchange', recordCurrent);
  // SPA pushState/replaceState 拦截
  ['pushState', 'replaceState'].forEach(function (k) {
    var orig = history[k];
    history[k] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(recordCurrent, 0);
      return r;
    };
  });
  // 兜底: 每 1.5s 轮询 location.href 变化,捕获前面所有方式都漏掉的场景
  // (lastRecorded 去重,实际只有变化时才 invoke,不耗 CPU)
  setInterval(recordCurrent, 1500);

  // ===== 悬浮按钮 + 抽屉 UI =====
  function buildUI() {
    if (document.getElementById('__ql_shell_fab__')) return;
    var fab = document.createElement('div');
    fab.id = '__ql_shell_fab__';
    fab.textContent = '☰'; // ☰
    fab.style.cssText = [
      'position:fixed', 'right:14px', 'bottom:14px', 'z-index:2147483647',
      'width:46px', 'height:46px', 'border-radius:50%',
      'background:rgba(80,80,200,0.85)', 'color:#fff',
      'font-size:22px', 'line-height:46px', 'text-align:center',
      'box-shadow:0 2px 8px rgba(0,0,0,0.35)', 'cursor:pointer',
      'user-select:none', 'font-family:sans-serif'
    ].join(';');

    // 刷新按钮: ☰ 上方
    var refresh = document.createElement('div');
    refresh.id = '__ql_shell_refresh__';
    // 用 SVG 而不是 Unicode (⟳ U+27F3 字体回退不可靠,部分设备只显示空白圆)
    refresh.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff"'
      + ' stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:12px auto">'
      + '<path d="M21 12a9 9 0 1 1-3-6.7"/>'
      + '<polyline points="21 4 21 10 15 10"/>'
      + '</svg>';
    refresh.style.cssText = [
      'position:fixed', 'right:14px', 'bottom:70px', 'z-index:2147483647',
      'width:46px', 'height:46px', 'border-radius:50%',
      'background:rgba(80,80,200,0.85)',
      'box-shadow:0 2px 8px rgba(0,0,0,0.35)', 'cursor:pointer',
      'user-select:none'
    ].join(';');
    refresh.addEventListener('click', function () {
      // 一圈动画反馈, 然后 reload
      refresh.style.transition = 'transform .35s';
      refresh.style.transform = 'rotate(360deg)';
      setTimeout(function () { location.reload(); }, 150);
    });

    // 后退按钮: ⟳ 上方
    var back = document.createElement('div');
    back.id = '__ql_shell_back__';
    back.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff"'
      + ' stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:12px auto">'
      + '<polyline points="15 18 9 12 15 6"/>'
      + '</svg>';
    back.style.cssText = [
      'position:fixed', 'right:14px', 'bottom:126px', 'z-index:2147483647',
      'width:46px', 'height:46px', 'border-radius:50%',
      'background:rgba(80,80,200,0.85)',
      'box-shadow:0 2px 8px rgba(0,0,0,0.35)', 'cursor:pointer',
      'user-select:none'
    ].join(';');
    back.addEventListener('click', function () {
      if (window.history.length > 1) {
        history.back();
      } else {
        // 没历史可退,回默认首页
        location.href = DEFAULT_URL;
      }
    });

    var drawer = document.createElement('div');
    drawer.id = '__ql_shell_drawer__';
    drawer.style.cssText = [
      'position:fixed', 'top:0', 'right:0', 'width:88vw', 'max-width:380px',
      'height:100vh', 'z-index:2147483646',
      'background:#1c1c24', 'color:#e6e6e6',
      'box-shadow:-4px 0 16px rgba(0,0,0,0.5)',
      'transform:translateX(100%)', 'transition:transform .25s ease',
      'display:flex', 'flex-direction:column',
      'font-family:sans-serif', 'font-size:14px'
    ].join(';');
    drawer.innerHTML = ''
      + '<div style="padding:14px 16px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center">'
      +   '<b style="font-size:16px">访问历史</b>'
      +   '<span id="__ql_close__" style="cursor:pointer;font-size:22px;line-height:1">×</span>'
      + '</div>'
      + '<div style="padding:10px 14px;border-bottom:1px solid #333;display:flex;gap:8px">'
      +   '<input id="__ql_addr__" type="text" placeholder="输入 URL 跳转"'
      +     ' style="flex:1;background:#0f0f15;color:#e6e6e6;border:1px solid #333;border-radius:6px;padding:6px 8px;font-size:13px"/>'
      +   '<button id="__ql_go__" style="background:#5050c8;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer">Go</button>'
      + '</div>'
      + '<div style="padding:8px 14px;display:flex;gap:8px;border-bottom:1px solid #333">'
      +   '<button id="__ql_home__" style="flex:1;background:#2a2a36;color:#e6e6e6;border:1px solid #333;border-radius:6px;padding:6px;cursor:pointer">首页</button>'
      +   '<button id="__ql_clear__" style="flex:1;background:#2a2a36;color:#ff6e6e;border:1px solid #333;border-radius:6px;padding:6px;cursor:pointer">清空历史</button>'
      + '</div>'
      + '<div id="__ql_list__" style="flex:1;overflow:auto"></div>';

    document.body.appendChild(fab);
    document.body.appendChild(refresh);
    document.body.appendChild(back);
    document.body.appendChild(drawer);

    var drawerOpen = false;
    function open() { drawer.style.transform = 'translateX(0)'; loadHistory(); drawerOpen = true; }
    function close() { drawer.style.transform = 'translateX(100%)'; drawerOpen = false; }
    function toggle() { drawerOpen ? close() : open(); }
    fab.addEventListener('click', toggle);
    drawer.querySelector('#__ql_close__').addEventListener('click', close);

    drawer.querySelector('#__ql_go__').addEventListener('click', function () {
      var v = drawer.querySelector('#__ql_addr__').value.trim();
      if (!v) return;
      if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
      location.href = v;
    });
    drawer.querySelector('#__ql_home__').addEventListener('click', function () {
      location.href = DEFAULT_URL;
    });
    drawer.querySelector('#__ql_clear__').addEventListener('click', function () {
      invoke('clear_history').then(loadHistory);
    });

    function loadHistory() {
      var list = drawer.querySelector('#__ql_list__');
      list.innerHTML = '<div style="padding:14px;color:#888">加载中...</div>';
      invoke('get_history').then(function (items) {
        items = items || [];
        if (!items.length) {
          list.innerHTML = '<div style="padding:14px;color:#888">还没有历史记录</div>';
          return;
        }
        list.innerHTML = '';
        items.forEach(function (it) {
          var row = document.createElement('div');
          row.style.cssText = 'padding:10px 14px;border-bottom:1px solid #2a2a36;cursor:pointer';
          row.innerHTML = '<div style="color:#e6e6e6;font-size:14px;line-height:1.35;word-break:break-all">'
            + escapeHtml(it.title || it.url) + '</div>'
            + '<div style="color:#888;font-size:12px;margin-top:3px;word-break:break-all">'
            + escapeHtml(it.url) + '</div>';
          row.addEventListener('click', function () { location.href = it.url; });
          list.appendChild(row);
        });
      });
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
      });
    }
  }

  if (document.body) {
    buildUI();
  } else {
    document.addEventListener('DOMContentLoaded', buildUI);
  }
})();
