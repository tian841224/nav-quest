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

- 「已兌換」頁的 Instagram 帳號與連結直接寫在 `index.html`，不是建置設定；換店家時要手動改這個連結與帳號文字。連結以新分頁開啟，避免取代需要持續顯示時鐘的兌換頁。
- 每次載入頁面都以不同網址取得 `config.js`，避免瀏覽器沿用舊的活動半徑；`app.js` 必須在設定檔後執行。

## Unverified

none
