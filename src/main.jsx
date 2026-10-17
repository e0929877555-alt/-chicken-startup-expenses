import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { PlusCircle, ChartNoAxesColumn, ReceiptText, Download, RefreshCw, Trash2, Eye, Store, CircleAlert } from 'lucide-react';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const categories = ['裝潢工程','押金／租金預付','招牌／廣告','炸爐／冰箱等設備','廚房器具／小工具','桌椅／店面用品','水電／管線工程','證照／開辦費','首批食材','首批包材','清潔用品','其他'];
const blank = { expense_date: new Date().toLocaleDateString('sv-SE'), category: categories[0], item: '', amount: '', payer: '店用帳戶', payment_status: '已付款', receipt_status: '有收據／發票', note: '' };
const money = n => 'NT$ ' + Math.round(Number(n)||0).toLocaleString('zh-TW');
const escCsv = v => `"${String(v ?? '').replaceAll('"','""')}"`;

function App() {
  const [mode, setMode] = useState('entry');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [writeCode, setWriteCode] = useState('');
  const [showWriteCode, setShowWriteCode] = useState(false);
  const cloudReady = Boolean(supabase);
  const readOnly = mode === 'summary';

  async function loadRows() {
    if (!supabase) {
      setRows(JSON.parse(localStorage.getItem('startup-expenses-preview') || '[]'));
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from('startup_expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false });
    if (error) setMessage('讀取失敗：' + error.message);
    else setRows(data || []);
    setLoading(false);
  }
  useEffect(() => {
    loadRows();
    if (!supabase) return;
    const channel = supabase.channel('startup-expenses-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'startup_expenses' }, loadRows).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const total = useMemo(() => rows.reduce((a, r) => a + Number(r.amount || 0), 0), [rows]);
  const paid = useMemo(() => rows.filter(r => r.payment_status === '已付款').reduce((a, r) => a + Number(r.amount || 0), 0), [rows]);
  const unpaid = useMemo(() => rows.filter(r => r.payment_status !== '已付款').reduce((a, r) => a + (r.payment_status === '部分付款' ? Number(r.outstanding_amount ?? Number(r.amount||0)/2) : Number(r.amount||0)), 0), [rows]);
  const byCategory = useMemo(() => {
    const m = new Map();
    rows.forEach(r => m.set(r.category, (m.get(r.category)||0) + Number(r.amount||0)));
    return [...m.entries()].sort((a,b)=>b[1]-a[1]);
  }, [rows]);

  function update(k,v) { setForm(p=>({...p,[k]:v})); }
  async function submit(e) {
    e.preventDefault();
    if (readOnly) return;
    if (!form.item.trim() || !(Number(form.amount)>0)) { setMessage('請填寫費用項目與大於 0 的金額。'); return; }
    if (!cloudReady) {
      const next = [{...form, id: crypto.randomUUID(), amount: Number(form.amount), created_at: new Date().toISOString()}, ...rows];
      setRows(next); localStorage.setItem('startup-expenses-preview', JSON.stringify(next));
      setForm({...blank, expense_date: new Date().toLocaleDateString('sv-SE')});
      setMessage('已儲存於此瀏覽器的預覽資料；尚未同步到股東的裝置。'); return;
    }
    if (!writeCode.trim()) { setShowWriteCode(true); setMessage('請輸入店長共用寫入碼後再儲存。'); return; }
    setBusy(true); setMessage('');
    // The shared write code is sent to a serverless API, never used as a database password.
    const response = await fetch('/api/expenses', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, amount:Number(form.amount), writeCode }) });
    const result = await response.json().catch(()=>({}));
    setBusy(false);
    if (!response.ok) { setMessage(result.error || '儲存失敗，請稍後再試。'); return; }
    setForm({...blank, expense_date:new Date().toLocaleDateString('sv-SE')});
    setMessage('已儲存並同步至雲端。');
    await loadRows();
  }
  async function removeRow(id) {
    setMessage('為保留費用稽核紀錄，正式版不提供公開刪除。若需更正，建議新增一筆負數沖銷或由管理者在受控環境處理。');
  }
  function exportCsv() {
    const header = ['日期','費用類目','項目','金額','付款人','付款狀態','憑證狀況','備註'];
    const data = rows.map(r=>[r.expense_date,r.category,r.item,r.amount,r.payer,r.payment_status,r.receipt_status,r.note]);
    const csv = '\ufeff' + [header,...data].map(row=>row.map(escCsv).join(',')).join('\r\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='雞排店開辦費用.csv'; a.click(); URL.revokeObjectURL(a.href);
  }
  function exportJson() {
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(rows,null,2)],{type:'application/json'})); a.download='雞排店開辦費用備份.json'; a.click(); URL.revokeObjectURL(a.href);
  }

  return <div className="shell">
    <header className="top"><div className="brand"><div className="brand-icon"><Store size={23}/></div><div><h1>雞排店・開辦費用紀錄</h1><p>STARTUP EXPENSES · 簡易股東費用總覽</p></div></div><span className={`status ${cloudReady?'cloud':'preview'}`}>{cloudReady?'雲端模式':'預覽模式'}</span></header>
    {!cloudReady && <div className="notice"><CircleAlert size={18}/><div><b>目前是預覽模式</b><br/>資料只存在這個瀏覽器，其他手機不會同步。設定 Supabase 與 Vercel 環境變數、部署 API 後才會啟用雲端同步。</div></div>}
    {message && <div className="message">{message}<button className="link" onClick={()=>setMessage('')}>關閉</button></div>}
    <nav className="tabs"><button className={mode==='entry'?'active':''} onClick={()=>setMode('entry')}><PlusCircle size={17}/> 店長輸入</button><button className={mode==='summary'?'active':''} onClick={()=>setMode('summary')}><Eye size={17}/> 股東總覽</button></nav>
    {mode==='entry' ? <section className="panel">
      <h2>新增一筆開辦費用</h2><p className="muted">每次費用填一筆；保留收據或轉帳證明。</p>
      <form onSubmit={submit} className="form-grid">
        <div><label>日期 *</label><input type="date" required value={form.expense_date} onChange={e=>update('expense_date',e.target.value)}/></div>
        <div><label>費用類目 *</label><select value={form.category} onChange={e=>update('category',e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></div>
        <div className="wide"><label>費用項目／買了什麼 *</label><input required value={form.item} onChange={e=>update('item',e.target.value)} placeholder="例如：雙槽炸爐、第一批雞腿排、店面押金"/></div>
        <div><label>金額（NT$）*</label><input type="number" min="1" step="1" required value={form.amount} onChange={e=>update('amount',e.target.value)} placeholder="例如 25000"/></div>
        <div><label>付款人／先墊付股東</label><select value={form.payer} onChange={e=>update('payer',e.target.value)}>{['店用帳戶','股東A','股東B','股東C','店長代付','其他'].map(x=><option key={x}>{x}</option>)}</select></div>
        <div><label>付款狀態</label><select value={form.payment_status} onChange={e=>update('payment_status',e.target.value)}>{['已付款','未付款','部分付款'].map(x=><option key={x}>{x}</option>)}</select></div>
        <div><label>憑證狀況</label><select value={form.receipt_status} onChange={e=>update('receipt_status',e.target.value)}>{['有收據／發票','只有轉帳紀錄','尚未取得憑證','不適用'].map(x=><option key={x}>{x}</option>)}</select></div>
        <div className="wide"><label>備註（選填）</label><textarea rows="2" value={form.note} onChange={e=>update('note',e.target.value)} placeholder="供應商、付款方式、收據編號等"/></div>
        {cloudReady && <div className="wide"><label>店長共用寫入碼（非個人帳號）</label><input type="password" value={writeCode} onChange={e=>setWriteCode(e.target.value)} placeholder="由管理者設定的寫入碼"/></div>}
        <div className="wide actions"><button type="submit" disabled={busy}>{busy?'儲存中…':'儲存這筆費用'}</button><button type="button" className="secondary" onClick={()=>setForm({...blank,expense_date:new Date().toLocaleDateString('sv-SE')})}>清空表單</button></div>
      </form>
    </section> : <><div className="stats"><div className="stat"><span>開辦費用總額</span><b>{money(total)}</b><small>所有已記錄項目金額</small></div><div className="stat"><span>已付款</span><b>{money(paid)}</b><small>付款狀態為已付款</small></div><div className="stat"><span>待付款估算</span><b>{money(unpaid)}</b><small>部分付款以半額暫估，建議補登實際未付金額</small></div></div>
      <section className="panel"><div className="panel-head"><div><h2>各類目花費總結</h2><p className="muted">依費用類目加總</p></div><button className="secondary" onClick={exportCsv}><Download size={16}/> 匯出 CSV</button></div>
        {byCategory.length?byCategory.map(([name,value])=><div className="catrow" key={name}><div className="cathead"><b>{name}</b><span>{money(value)} · {total?Math.round(value/total*100):0}%</span></div><div className="barbg"><div className="bar" style={{width:`${total?value/total*100:0}%`}}/></div></div>):<div className="empty">目前還沒有費用紀錄。</div>}
      </section>
      <section className="panel"><div className="panel-head"><div><h2>全部費用明細</h2><p className="muted">{rows.length} 筆紀錄</p></div><div className="actions"><button className="secondary" onClick={loadRows}><RefreshCw size={15}/> 重新整理</button><button className="secondary" onClick={exportJson}>備份 JSON</button></div></div>
        {loading?<div className="empty">載入中…</div>:rows.length?<div className="table-wrap"><table><thead><tr><th>日期</th><th>類目</th><th>項目／備註</th><th>金額</th><th>付款人</th><th>付款狀態</th><th>憑證</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.expense_date}</td><td><span className="category">{r.category}</span></td><td><b>{r.item}</b><small>{r.note}</small></td><td className="amount">{money(r.amount)}</td><td>{r.payer}</td><td>{r.payment_status}</td><td>{r.receipt_status}</td></tr>)}</tbody></table></div>:<div className="empty">目前還沒有費用紀錄，新增第一筆就會顯示在這裡。</div>}
      </section>
    </>}
    <footer>簡易版 · 正式多人使用前，請完成雲端部署與權限設定。</footer>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
