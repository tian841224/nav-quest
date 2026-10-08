(function () {
  'use strict';

  var config = window.NAV_CONFIG;
  if (!config || !config.destination) {
    document.body.textContent = '尚未產生設定檔，請先執行 npm run build。';
    return;
  }

  var STORAGE_KEY = 'navquest.state';
  var GEO_TIMEOUT_MS = 10000;
  var MAX_ACCURACY_M = 1000;
  var destName = config.destination.name;
  var radiusM = config.radiusKm * 1000;

  var $ = function (selector) { return document.querySelector(selector); };
  var $$ = function (selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); };

  // ---- 狀態：記在這支手機的瀏覽器裡 -------------------------------------

  var memoryState = {};

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      // 無痕模式或儲存空間被停用時，退回只在本次瀏覽有效的記憶體狀態
    }
    return memoryState;
  }

  function saveState(state) {
    memoryState = state;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // 同上，狀態只留在記憶體
    }
  }

  function clearState() {
    memoryState = {};
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // 忽略
    }
  }

  // ---- 格式化 -----------------------------------------------------------

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatClock(d) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function showRedeemedAt(iso) {
    var d = new Date(iso);
    var valid = !isNaN(d.getTime());
    $('#redeemed-date').textContent = valid ? d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) : '—';
    $('#redeemed-time').textContent = valid ? formatClock(d) : '—';
  }

  function formatDistance(meters) {
    if (meters < 1000) return Math.round(meters) + ' 公尺';
    return (meters / 1000).toFixed(1) + ' 公里';
  }

  function formatRadius(km) {
    return String(Number(km.toFixed(2)));
  }

  // 兩點的球面距離（公尺）
  function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var toRad = function (deg) { return deg * Math.PI / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // ---- 畫面切換 ---------------------------------------------------------

  var STEP_LABELS = {
    start: { text: '步驟 1 / 3', done: 1 },
    blocked: { text: '步驟 1 / 3', done: 1 },
    task: { text: '步驟 2 / 3', done: 2 },
    redeemed: { text: '步驟 3 / 3', done: 3 }
  };

  function show(name) {
    $$('.view').forEach(function (el) { el.hidden = el.getAttribute('data-view') !== name; });

    var step = STEP_LABELS[name];
    $('#step-label').textContent = step.text;
    $$('#progress span').forEach(function (bar, i) {
      bar.className = i < step.done ? 'is-done' : '';
    });

    $('#app').setAttribute('data-screen', name);

    var heading = $('.view:not([hidden]) h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
  }

  function showStartOrTask() {
    var state = loadState();
    if (state.redeemedAt) {
      showRedeemedAt(state.redeemedAt);
      show('redeemed');
    } else if (state.startedAt) {
      show('task');
    } else {
      show('start');
    }
  }

  // ---- 定位 -------------------------------------------------------------

  function setLocating(busy) {
    [$('#locate-btn'), $('#retry-btn')].forEach(function (btn) {
      btn.disabled = busy;
    });
    $('#locate-btn').textContent = busy ? '定位中…' : '確認我的位置';
    $('#retry-btn').textContent = busy ? '定位中…' : '重新確認位置';
  }

  var TIP_OPEN_BROWSER = '從其他 App 內開啟連結時可能無法定位，請複製網址，改用 Safari 或 Chrome 開啟。';
  var TIP_SIGNAL = '請確認手機的定位服務已開啟，並移到收訊較好的地方後重試。';

  function showBlocked(reason, info) {
    var rangeText = '活動範圍：以 ' + destName + ' 為中心，方圓 ' + formatRadius(config.radiusKm) + ' 公里。';
    var content = {
      far: {
        title: '你目前不在活動範圍內',
        message: '任務需要在 ' + destName + ' 方圓 ' + formatRadius(config.radiusKm) + ' 公里內才能開始。請到現場附近後再試一次。',
        detail: info && info.distance != null ? '你目前距離約 ' + formatDistance(info.distance) + '。' : rangeText,
        tip: '已經在附近了？可能是定位不夠準確。請移到室外或靠近窗邊，稍等幾秒後重試。'
      },
      denied: {
        title: '需要開啟定位權限',
        message: '我們需要確認您在園區內',
        detail: rangeText,
        tip: 'iPhone：到「設定→隱私權與安全性→定位服務」，開啟並允許瀏覽器使用。\n\nAndroid：到「設定→位置資訊」開啟，並確認瀏覽器的網站設定沒有封鎖位置。完成後回來重試。'
      },
      unavailable: {
        title: '暫時無法取得位置',
        message: '手機沒有回報你的位置。',
        detail: rangeText,
        tip: TIP_SIGNAL
      },
      timeout: {
        title: '定位花太久了',
        message: '等了 ' + (GEO_TIMEOUT_MS / 1000) + ' 秒仍沒有取得位置。',
        detail: rangeText,
        tip: TIP_SIGNAL
      },
      inaccurate: {
        title: '定位誤差太大',
        message: '目前的定位誤差約 ' + Math.round(info && info.accuracy || 0) + ' 公尺，無法判斷你是否在範圍內。',
        detail: rangeText,
        tip: '請移到室外或空曠處，稍等幾秒讓定位穩定後重試。'
      },
      unsupported: {
        title: '此瀏覽器無法定位',
        message: '請改用 Safari 或 Chrome 開啟這個網址。',
        detail: rangeText,
        tip: TIP_OPEN_BROWSER
      }
    }[reason];

    $('#blocked-title').textContent = content.title;
    $('#blocked-message').textContent = content.message;
    $('#blocked-detail').textContent = content.detail;
    $('#blocked-tip').textContent = content.tip;
    show('blocked');
  }

  function onPosition(position) {
    setLocating(false);
    var coords = position.coords;
    if (coords.accuracy > MAX_ACCURACY_M) {
      showBlocked('inaccurate', { accuracy: coords.accuracy });
      return;
    }
    var distance = haversine(coords.latitude, coords.longitude, config.destination.lat, config.destination.lng);
    if (distance > radiusM) {
      showBlocked('far', { distance: distance });
      return;
    }
    // 座標只用來當下計算，不保存；只記下「任務已開始」
    saveState({ startedAt: new Date().toISOString(), redeemedAt: null });
    show('task');
  }

  function onPositionError(error) {
    setLocating(false);
    if (error.code === 1) showBlocked('denied');
    else if (error.code === 3) showBlocked('timeout');
    else showBlocked('unavailable');
  }

  function locate() {
    if (!window.isSecureContext || !('geolocation' in navigator)) {
      showBlocked('unsupported');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(onPosition, onPositionError, {
      enableHighAccuracy: true,
      timeout: GEO_TIMEOUT_MS,
      maximumAge: 0
    });
  }

  // ---- 兌獎確認視窗 -----------------------------------------------------

  var sheet = $('#confirm-sheet');

  function openSheet() {
    sheet.hidden = false;
    $('#cancel-btn').focus();
  }

  function closeSheet() {
    sheet.hidden = true;
    $('#redeem-btn').focus({ preventScroll: true });
  }

  function confirmRedeem() {
    var state = loadState();
    state.redeemedAt = new Date().toISOString();
    saveState(state);
    sheet.hidden = true;
    showRedeemedAt(state.redeemedAt);
    show('redeemed');
  }

  document.addEventListener('keydown', function (event) {
    if (sheet.hidden) return;
    if (event.key === 'Escape') {
      closeSheet();
    } else if (event.key === 'Tab') {
      var first = $('#confirm-btn');
      var last = $('#cancel-btn');
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  // ---- 初始化 -----------------------------------------------------------

  $$('[data-dest-name]').forEach(function (el) { el.textContent = destName; });
  $$('[data-radius]').forEach(function (el) { el.textContent = formatRadius(config.radiusKm); });

  $('#nav-link').href = config.navUrl;

  var lat = config.destination.lat;
  var lng = config.destination.lng;
  var dLat = 0.004;
  var dLng = 0.006;
  $('#map-frame').src = 'https://www.openstreetmap.org/export/embed.html?bbox=' +
    [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map(function (n) { return n.toFixed(6); }).join('%2C') +
    '&layer=mapnik&marker=' + lat + '%2C' + lng;

  $('#locate-btn').addEventListener('click', locate);
  $('#retry-btn').addEventListener('click', locate);
  $('#redeem-btn').addEventListener('click', openSheet);
  $('#confirm-btn').addEventListener('click', confirmRedeem);
  $$('[data-close-sheet]').forEach(function (el) { el.addEventListener('click', closeSheet); });

  // 測試用：網址加上 ?reset 會清除這支手機上的任務狀態
  if (new URLSearchParams(window.location.search).has('reset')) {
    clearState();
    window.history.replaceState(null, '', window.location.pathname);
  }

  showStartOrTask();
})();
