---
doc_type: architecture
---

# Architecture

`nav-quest` 是由 GitHub Actions 建置並部署到 GitHub Pages 的靜態網站。建置腳本讀取 repository variables，產生供瀏覽器載入的設定檔；前端在使用者裝置上取得定位並計算距離。

## Boundaries

- 建置與部署：`.github/workflows/deploy.yml` 呼叫 `scripts/build.mjs`，再將 `dist/` 發佈到 GitHub Pages。
- 瀏覽器前端：`site/` 顯示任務流程、讀取建置設定並使用瀏覽器定位 API；沒有伺服器端資料處理。

## Documents

- [Site module](modules/site.md)：前端模組責任、載入順序與本機狀態。
- [Project plan](plan.md)：產品流程、設定與部署規劃。
