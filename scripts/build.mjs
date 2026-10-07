// 讀取 .env（或同名環境變數），解析目的地網址，把 site/ 複製到 dist/ 並產生 config.js。
// 環境變數優先於 .env，GitHub Actions 以 repository variables 傳入。
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`建置失敗：${message}`);
  process.exit(1);
}

function parseEnvFile(path) {
  const values = {};
  if (!existsSync(path)) return values;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;
    const eq = text.indexOf('=');
    if (eq < 1) continue;
    const key = text.slice(0, eq).trim();
    let value = text.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const fileEnv = parseEnvFile(resolve(root, '.env'));
const read = (key) => (process.env[key] ?? '').trim() || (fileEnv[key] ?? '').trim();

const destinationUrl = read('NAV_DESTINATION_URL');
if (!destinationUrl) {
  fail('找不到 NAV_DESTINATION_URL。請建立 .env（可複製 .env.example），或在 GitHub 設定同名的 repository variable。');
}

const radiusKm = Number(read('NAV_RADIUS_KM') || '5');
if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
  fail(`NAV_RADIUS_KM 必須是大於 0 的數字，目前是「${read('NAV_RADIUS_KM')}」。`);
}

function parseDestination(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail('NAV_DESTINATION_URL 不是有效的網址。');
  }
  if (!/(^|\.)google\.[a-z.]+$/i.test(url.hostname)) {
    fail('NAV_DESTINATION_URL 必須是 google.com/maps 的完整網址（不支援 maps.app.goo.gl 短網址）。');
  }

  // 網址資料段中 !3d緯度!4d經度 是地點本身的座標，最後一組對應網址路徑上的地點；
  // @緯度,經度 只是地圖畫面中心，僅作為備援。
  const pins = [...raw.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
  let lat;
  let lng;
  if (pins.length > 0) {
    [, lat, lng] = pins[pins.length - 1];
  } else {
    const center = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (!center) fail('在 NAV_DESTINATION_URL 中找不到座標，請貼 Google Maps 開啟地點後的完整網址。');
    [, lat, lng] = center;
  }

  let name = '活動地點';
  const place = url.pathname.match(/\/maps\/place\/([^/]+)/);
  if (place) {
    try {
      name = decodeURIComponent(place[1]).replace(/\+/g, ' ');
    } catch {
      // 保留預設名稱
    }
  }

  return { name, lat: Number(lat), lng: Number(lng) };
}

const destination = parseDestination(destinationUrl);

const config = {
  destination,
  radiusKm,
  navUrl: `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`,
};

const dist = resolve(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(resolve(root, 'site'), dist, { recursive: true });
writeFileSync(
  resolve(dist, 'config.js'),
  `// 由 scripts/build.mjs 產生，請勿手動修改。\nwindow.NAV_CONFIG = ${JSON.stringify(config, null, 2)};\n`,
);

// 樣式與腳本的網址帶上建置時間，部署後瀏覽器不會把新 HTML 配上快取的舊 CSS／JS。
const stamp = Date.now();
const indexPath = resolve(dist, 'index.html');
writeFileSync(
  indexPath,
  readFileSync(indexPath, 'utf8')
    .replace('./styles.css', `./styles.css?v=${stamp}`)
    .replace("'./app.js'", `'./app.js?v=${stamp}'`),
);

console.log(`目的地：${destination.name}（${destination.lat}, ${destination.lng}）`);
console.log(`範圍：以目的地為圓心 ${radiusKm} 公里`);
console.log('已輸出到 dist/');
