// Vercel serverless function. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and EXPENSE_WRITE_CODE in Vercel Environment Variables.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { expense_date, category, item, amount, payer, payment_status, receipt_status, note, writeCode } = req.body || {};
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.EXPENSE_WRITE_CODE) {
    return res.status(503).json({ error: '後端尚未設定完成。請先設定 Vercel 環境變數。' });
  }
  if (!writeCode || writeCode !== process.env.EXPENSE_WRITE_CODE) {
    return res.status(403).json({ error: '寫入碼錯誤，未儲存資料。' });
  }
  if (!expense_date || !category || !String(item || '').trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: '日期、類目、項目與正確金額為必填。' });
  }
  const allowedCategories = ['裝潢工程','押金／租金預付','招牌／廣告','炸爐／冰箱等設備','廚房器具／小工具','桌椅／店面用品','水電／管線工程','證照／開辦費','首批食材','首批包材','清潔用品','其他'];
  const allowedPayers = ['店用帳戶','股東A','股東B','股東C','店長代付','其他'];
  const allowedStatuses = ['已付款','未付款','部分付款'];
  const allowedReceipts = ['有收據／發票','只有轉帳紀錄','尚未取得憑證','不適用'];
  if (!allowedCategories.includes(category) || !allowedPayers.includes(payer) || !allowedStatuses.includes(payment_status) || !allowedReceipts.includes(receipt_status)) {
    return res.status(400).json({ error: '欄位內容不在允許範圍內。' });
  }
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.from('startup_expenses').insert({
    expense_date, category, item: String(item).trim().slice(0,200), amount: Math.round(Number(amount)),
    payer, payment_status, receipt_status, note: String(note || '').slice(0,1000)
  }).select('id').single();
  if (error) return res.status(500).json({ error: '儲存失敗，請稍後再試。' });
  return res.status(201).json({ ok: true, id: data.id });
}