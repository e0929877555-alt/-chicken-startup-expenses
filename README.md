# 雞排店｜開辦費用紀錄簡易網頁

## 第一版範圍
- 店長輸入每筆開辦費用：日期、類目、項目、金額、付款人、付款狀態、憑證、備註。
- 股東查看總額、已付款估算、待付款估算、分類加總、明細。
- 匯出 CSV 與 JSON。
- 不建立個人帳號。正式雲端版使用一組「店長共用寫入碼」限制新增；股東頁為唯讀。
- 預覽模式資料僅存在本機瀏覽器，並不會跨裝置同步。

## 技術
React + Vite + Vercel Functions + Supabase Postgres。

## 部署步驟
1. 建立 Supabase 專案。
2. 在 Supabase SQL Editor 執行 `supabase/schema.sql`。
3. 在 Supabase 專案設定取得 Project URL 與 anon key。確認 `startup_expenses` 已啟用 Realtime（可選，否則股東可按重新整理）。
4. 將本專案推送到 GitHub，於 Vercel 匯入。
5. 在 Vercel 設定以下環境變數：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `EXPENSE_WRITE_CODE`
6. `EXPENSE_WRITE_CODE` 是店長共用寫入碼，不是個人登入。選擇長且難猜的值，只透過私下管道交給店長；不要放在前端原始碼或 GitHub。
7. 部署後測試：店長輸入一筆 → 股東頁刷新後看到 → 確認資料在 Supabase → 測試錯誤寫入碼無法新增。

## 安全注意
- `SUPABASE_SERVICE_ROLE_KEY` 只放 Vercel server-side environment variables，絕不可放進 `VITE_` 變數、前端程式或 Git。
- 目前匿名股東查看頁代表任何取得網址的人都可讀取費用資料；不要輸入個人敏感資料。如果希望只有三位股東可查看，需要增加股東登入或私密分享碼。
- 店長寫入碼可限制新增，但它不是強身分驗證。可被分享或猜測；正式使用時應加上 Vercel 防濫用／速率限制，並規劃修改更正流程。
- 為保留稽核線索，前端沒有公開刪除功能。需要更正時建議新增沖銷/更正紀錄或管理者在受控環境處理。
- 「部分付款」目前在待付款摘要中暫以一半估算；若要精準管理，建議增加「已付金額／未付金額」兩個欄位。
- 這是開辦費用管理工具，不是正式會計帳簿或報稅系統。

## 本機測試
```bash
npm install
npm run dev
```
沒有設定 Supabase 環境變數時會進入本機預覽模式，資料僅存在當前瀏覽器。
