# English Lab

Erick 的英文學習工作台：今日任務＋打卡、文法課綱與練習、單字篩選與間隔重複、聽力課表、口說主題看板。
純靜態網頁（無建置步驟），放在 GitHub Pages；進度存在裝置 localStorage，用 Google 登入後同步到 Firebase Firestore（users/{uid}）。

## 結構
- `index.html` 今日任務／打卡／連續天數
- `grammar.html` + `content/grammar/*` 文法章節（HTML 片段）與練習（JSON，自動對答）
- `vocab.html` + `content/vocab/words.json` 單字篩選、單字卡（SM-2 式間隔重複）、待補完整卡清單
- `listen.html` + `content/listen.json` 四週聽力課表與頻道
- `speak.html` + `content/speak.json` 28 天口說主題
- `assets/app.js` 共用：儲存層、打卡、Firebase 同步、底部導覽
- `firebase-config.js` Firebase 前端設定（公開值）

## 字表來源
- NGSL 1.2 — Browne, C., Culligan, B. & Phillips, J. (2013). New General Service List. newgeneralservicelist.com — CC BY-SA 4.0
- TSL 1.2 — Browne, C. & Culligan, B. TOEIC Service List. newgeneralservicelist.com — CC BY-SA 4.0
中文釋義與例句為本專案自行編寫。
