---
doc_type: module
covers:
  - site/
---

# `site/`

## Responsibility

提供 GitHub Pages 上的導覽任務前端，不包含後端或登入服務。

## Entrypoints

- `index.html` 載入建置產生的 `config.js` 與前端 `app.js`。

## Flow

`index.html` > `config.js` > `app.js` > 瀏覽器定位與距離檢查 > 更新頁面狀態。

## Shared state

- `window.NAV_CONFIG` 由 `scripts/build.mjs` 建置產生，提供目的地與活動半徑。
- `localStorage["navquest.state"]` 保存本機任務狀態。

## Invariants and gotchas

- 版面以 390×844 設計稿為基準：`styles.css` 的 `--u` 是每個設計稿單位的實際長度，字級、間距與絕對定位都用 `calc(N * var(--u))`；`.stage` 固定設計稿大小並置中，背景圖（`assets/bg-*.png`）依 `#app[data-screen]` 切換並貼齊頂端。步驟二、三的內容整塊上下置中，靠 `[data-view]` 上的 `--dy` 位移（設計稿單位）調整，步驟一與定位失敗的版面受背景圖裡的色帶、定位圖示與寶箱插圖限制，不位移。新增畫面要補 `data-screen` 的背景規則，並在 `app.js` 的 `STEP_LABELS` 加入對應項目。
- 字體為 `assets/FolkPro-Bold.otf`（約 3.6 MB，只有 700 字重），Noto Sans TC 僅作缺字備援；字體檔沒有縮減，首次載入較慢。
- 版面以 Claude Design 畫布（`尋寶導覽 重新設計`）為準：頂端是「尋找森林中的寶藏」標題加步驟膠囊（`步驟 n / 3` 與三段進度條）。「已兌換」頁的兌獎時間拆成日期與時間兩欄顯示，不含即時時鐘；改版前的「現在時間」時鐘已移除。

- 「已兌換」頁以 Instagram 官方個人頁內嵌（`https://www.instagram.com/<帳號>/embed`）顯示大頭照與貼文，帳號直接寫在 `index.html`，不是建置設定；換店家時要手動改內嵌網址與按鈕連結。內嵌載入失敗時仍有「前往 Instagram 追蹤」按鈕；按鈕以新分頁開啟，避免取代需要持續顯示時鐘的兌換頁。內嵌是 Instagram 的非正式網址格式，Meta 可能調整。
- `scripts/build.mjs` 會在 `dist/index.html` 的 `styles.css` 與 `app.js` 網址加上建置時間，避免部署後新 HTML 搭配快取的舊樣式。
- 每次載入頁面都以不同網址取得 `config.js`，避免瀏覽器沿用舊的活動半徑；`app.js` 必須在設定檔後執行。

## Unverified

none
