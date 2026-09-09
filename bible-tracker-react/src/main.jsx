import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { plan, teBook, months } from './plan';
import './styles.css';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const cloudReady = SUPABASE_URL.startsWith('https://') && !!SUPABASE_KEY && !SUPABASE_URL.includes('YOUR-');
const supabase = cloudReady ? createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

const verses = [
  ['“Thy word is a lamp unto my feet, and a light unto my path.”', 'Psalm 119:105 (KJV)'],
  ['“Be strong and of a good courage; be not afraid, neither be thou dismayed.”', 'Joshua 1:9 (KJV)'],
  ['“This is the day which the LORD hath made; we will rejoice and be glad in it.”', 'Psalm 118:24 (KJV)'],
  ['“I can do all things through Christ which strengtheneth me.”', 'Philippians 4:13 (KJV)'],
];

const te = (name) => name.split(' / ').map(x => teBook[x] || x).join(' / ');
const chapterTe = (ref) => ref.replace(/Whole books/g, 'పూర్తి గ్రంథాలు');
const key = (m, i) => `${m}-${i + 1}`;
const currentMonthName = () => new Date().toLocaleString('en-US', { month: 'long' });
const flatten = () => months.flatMap(m => plan[m].map((_, i) => ({ m, i, key: key(m, i) })));
const localDateKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const loadLocal = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem('bibleReading2026') || 'null');
    return parsed || { done: {}, completedAt: {}, activity: {} };
  } catch { return { done: {}, completedAt: {}, activity: {} }; }
};
const saveLocal = (state) => localStorage.setItem('bibleReading2026', JSON.stringify(state));
const countActivity = (state) => {
  const counts = {};
  Object.entries(state.activity || {}).forEach(([day, keys]) => { counts[day] = (keys || []).length; });
  Object.entries(state.completedAt || {}).forEach(([readingKey, ts]) => {
    const day = localDateKey(ts);
    const anyActivity = Object.values(state.activity || {}).some(list => (list || []).includes(readingKey));
    if (!anyActivity) counts[day] = (counts[day] || 0) + 1;
  });
  return counts;
};

function addActivity(state, day, readingKey) {
  const next = { ...state, activity: { ...(state.activity || {}) } };
  next.activity[day] = Array.from(new Set([...(next.activity[day] || []), readingKey]));
  return next;
}

function StatCard({ label, value, sub }) {
  return <div className="card statCard"><div className="statLabel">{label}</div><div className="statValue">{value}</div><div className="statSub">{sub}</div></div>;
}

function App() {
  const [state, setState] = useState(loadLocal);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [cloudStatus, setCloudStatus] = useState(cloudReady ? 'Checking…' : 'Local mode');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [verseIndex, setVerseIndex] = useState(0);
  const [toast, setToast] = useState('');
  const [openMonths, setOpenMonths] = useState(() => new Set([currentMonthName()]));

  const toggleMonth = (m) => setOpenMonths(prev => {
    const next = new Set(prev);
    next.has(m) ? next.delete(m) : next.add(m);
    return next;
  });

  const showToast = (message) => { setToast(message); window.clearTimeout(window.__bt); window.__bt = window.setTimeout(() => setToast(''), 2200); };

  const overall = useMemo(() => {
    const all = flatten();
    const done = all.filter(x => state.done[x.key]).length;
    return { done, total: all.length, pct: all.length ? Math.round(done * 100 / all.length) : 0 };
  }, [state.done]);

  const dailyCounts = useMemo(() => countActivity(state), [state]);
  const today = localDateKey();
  const todayCount = dailyCounts[today] || 0;
  const last7 = useMemo(() => {
    let total = 0;
    for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); total += dailyCounts[localDateKey(d)] || 0; }
    return total;
  }, [dailyCounts]);
  const currentStreak = useMemo(() => {
    let cursor = new Date();
    let streak = 0;
    while (dailyCounts[localDateKey(cursor)] > 0) { streak++; cursor.setDate(cursor.getDate() - 1); }
    return streak;
  }, [dailyCounts]);
  const bestMonth = useMemo(() => {
    const ranked = months.map(m => {
      const complete = plan[m].filter((_, i) => state.done[key(m, i)]).length;
      return [m, complete, plan[m].length ? Math.round(complete * 100 / plan[m].length) : 0];
    }).sort((a, b) => b[2] - a[2]);
    return ranked[0];
  }, [state.done]);

  useEffect(() => { saveLocal(state); }, [state]);
  useEffect(() => { const t = window.setInterval(() => setVerseIndex(i => (i + 1) % verses.length), 9000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const boot = async () => {
      const { data } = await supabase.auth.getSession();
      if (active && data.session) { setUser(data.session.user); await loadCloud(data.session.user.id); }
      else if (active) setCloudStatus('Signed out');
    };
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      if (session) { setUser(session.user); setCloudStatus('Syncing…'); await loadCloud(session.user.id); }
      else { setUser(null); setCloudStatus('Signed out'); }
    });
    boot();
    return () => { active = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCloud(userId) {
    setCloudStatus('Syncing…');
    const { data, error } = await supabase.from('reading_progress').select('reading_key,completed,completed_at').eq('user_id', userId);
    if (error) { setCloudStatus('Cloud error'); showToast(error.message); return; }
    const next = { done: {}, completedAt: {}, activity: {} };
    (data || []).forEach(r => { if (r.completed) { next.done[r.reading_key] = true; if (r.completed_at) next.completedAt[r.reading_key] = r.completed_at; } });
    const act = await supabase.from('reading_activity').select('reading_key,activity_date').eq('user_id', userId);
    if (!act.error) (act.data || []).forEach(r => { next.activity[r.activity_date] = Array.from(new Set([...(next.activity[r.activity_date] || []), r.reading_key])); });
    // Merge local-only data on first sign-in, then rely on cloud as the source of truth.
    setState(next);
    setCloudStatus('Cloud synced');
  }

  async function signInOrSignUp() {
    if (!supabase) { setAuthMessage('Add the Supabase environment variables first.'); return; }
    const trimmed = username.trim().toLowerCase();
    if (!trimmed || trimmed.length < 3) { setAuthMessage('Username must be at least 3 characters.'); return; }
    if (!/^[a-z0-9_]+$/.test(trimmed)) { setAuthMessage('Username can only contain letters, numbers, and underscores.'); return; }
    if (password.length < 6) { setAuthMessage('Password must be at least 6 characters.'); return; }
    const fakeEmail = `${trimmed}@app.local`;
    setAuthMessage('Working…');
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email: fakeEmail, password, options: { data: { username: trimmed } } })
      : await supabase.auth.signInWithPassword({ email: fakeEmail, password });
    if (result.error) {
      if (result.error.message.includes('already registered') || result.error.message.includes('User already registered')) {
        setAuthMessage('That username is already taken. Try a different one.');
      } else if (result.error.message.includes('Invalid login credentials')) {
        setAuthMessage('Wrong username or password. Please try again.');
      } else {
        setAuthMessage(result.error.message);
      }
      return;
    }
    if (authMode === 'signup' && !result.data.session) {
      setAuthMessage('Account created! You can now sign in.');
      setAuthMode('signin');
      return;
    }
    if (result.data.session) { setUser(result.data.user); setAuthMessage(''); }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setUser(null); setCloudStatus('Signed out');
    setState({ done: {}, completedAt: {}, activity: {} });
  }

  async function toggleReading(m, i, checked) {
    const readingKey = key(m, i);
    const now = new Date().toISOString();
    let next = { ...state, done: { ...state.done }, completedAt: { ...state.completedAt }, activity: { ...(state.activity || {}) } };
    if (checked) {
      next.done[readingKey] = true;
      next.completedAt[readingKey] = now;
      next = addActivity(next, localDateKey(), readingKey);
    } else {
      delete next.done[readingKey];
      delete next.completedAt[readingKey];
    }
    setState(next);
    if (!supabase || !user) { showToast(checked ? 'Saved on this device' : 'Unchecked'); return; }
    setCloudStatus('Saving…');
    const { error } = await supabase.from('reading_progress').upsert({
      user_id: user.id, reading_key: readingKey, completed: checked, completed_at: checked ? now : null
    }, { onConflict: 'user_id,reading_key' });
    if (error) { setCloudStatus('Save failed'); showToast(`Cloud save failed: ${error.message}`); return; }
    if (checked) {
      const { error: activityError } = await supabase.from('reading_activity').upsert({
        user_id: user.id, reading_key: readingKey, activity_date: localDateKey(), completed_at: now
      }, { onConflict: 'user_id,reading_key,activity_date' });
      if (activityError) showToast('Reading saved; activity log failed');
    }
    setCloudStatus('Cloud synced');
    showToast(checked ? 'Reading saved to cloud' : 'Reading unchecked');
  }

  async function resetProgress() {
    if (!window.confirm('Reset every completed reading? This cannot be undone.')) return;
    setState({ done: {}, completedAt: {}, activity: {} });
    if (supabase && user) {
      setCloudStatus('Resetting…');
      const a = await supabase.from('reading_progress').delete().eq('user_id', user.id);
      const b = await supabase.from('reading_activity').delete().eq('user_id', user.id);
      if (a.error || b.error) { setCloudStatus('Reset failed'); showToast('Cloud reset failed'); return; }
      setCloudStatus('Cloud synced');
    }
    showToast('Progress reset');
  }

  function exportProgress() {
    const blob = new Blob([JSON.stringify({ ...state, version: 4, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'bible-reading-progress-2026.json'; a.click(); URL.revokeObjectURL(url);
    showToast('Progress exported');
  }

  function importProgress(file) {
    const reader = new FileReader();
    reader.onload = () => { try { const x = JSON.parse(reader.result); setState({ done: x.done || {}, completedAt: x.completedAt || {}, activity: x.activity || {} }); showToast(user ? 'Imported locally; cloud is unchanged' : 'Progress imported'); } catch { showToast('Invalid progress file'); } };
    reader.readAsText(file);
  }

  function goToday() {
    const month = new Date().toLocaleString('en-US', { month: 'long' });
    const day = new Date().getDate();
    setOpenMonths(prev => { const next = new Set(prev); next.add(month); return next; });
    setTimeout(() => {
      document.getElementById(month)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => document.getElementById(`${month}-${day}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 450);
    }, 50);
  }

  const filtered = useMemo(() => months.map(m => {
    const rows = plan[m].map((r, i) => ({ r, i, done: !!state.done[key(m, i)] })).filter(({ r, i, done }) => {
      const hay = `${m} ${r[0]} ${te(r[0])} ${r[1]} ${chapterTe(r[1])} ${i + 1}`.toLowerCase();
      return (!search || hay.includes(search.toLowerCase())) && (status === 'all' || (status === 'done' && done) || (status === 'open' && !done));
    });
    return [m, rows];
  }).filter(([, rows]) => rows.length), [search, status, state.done]);

  return <>
    <div className="shell">
      <header className="topbar">
        <div className="brand"><div className="mark">✦</div><div><h1>Bible Reading Journey · బైబిల్ పఠన ప్రణాళిక</h1><small>2026 annual reading tracker · రోజువారీ ప్రగతి</small></div></div>
        <div className="actions">
          <div className={`cloudPill ${user && cloudReady ? 'on' : ''}`}><span className="cloudDot" />{user ? cloudStatus : cloudReady ? 'Sign in required' : 'Local mode'}</div>
          <button className="btn" onClick={goToday}>Go to today</button>
          <button className="btn" onClick={resetProgress}>Reset</button>
          <button className="btn gold" onClick={exportProgress}>Export</button>
          <label className="btn fileBtn">Import<input hidden type="file" accept="application/json" onChange={e => e.target.files?.[0] && importProgress(e.target.files[0])} /></label>
          {user && <button className="btn" onClick={signOut}>Sign out</button>}
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">A little every day</div>
        <h2>Let the Word shape the day before the day shapes you.</h2>
        <p>Follow your 2026 schedule, read the assigned portion, and mark it complete. Your progress and reading activity can sync through Supabase once you sign in.</p>
        <div className="verse"><q>{verses[verseIndex][0]}</q><cite>{verses[verseIndex][1]}</cite></div>
      </section>

      <section className="stats">
        <div className="card progressCard"><div className="ring" style={{ '--progress': `${overall.pct}%` }}><strong>{overall.pct}%</strong></div><div><div className="statLabel">Overall completion</div><div className="statValue">{overall.done} / {overall.total}</div><div className="statSub">assigned readings completed</div></div></div>
        <StatCard label="Current streak" value={`${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}`} sub="active reading days" />
        <StatCard label="Best month" value={bestMonth?.[1] ? bestMonth[0] : '—'} sub={bestMonth?.[1] ? `${bestMonth[2]}% complete` : 'No readings completed yet'} />
        <StatCard label="Today" value={todayCount} sub="readings completed today" />
        <StatCard label="Last 7 days" value={last7} sub="completed in the past week" />
        <StatCard label="Remaining" value={overall.total - overall.done} sub="readings left in the plan" />
      </section>

      <section className="controls"><div className="search"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a book, chapter, or month…" /></div><select className="select" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All readings</option><option value="open">Not completed</option><option value="done">Completed</option></select></section>

      <section className="daily card"><div className="dailyHead"><div><div className="statLabel">Daily progress</div><div className="dailyTitle">Your reading activity · last 28 days</div></div><div className="legend"><span>Less</span><i/><i/><i/><i/><span>More</span></div></div><div className="dailyGrid">{Array.from({ length: 28 }, (_, n) => 27 - n).reverse().map(i => { const d = new Date(); d.setDate(d.getDate() - i); const k = localDateKey(d); return <div className="dayCell" key={k} title={`${d.toLocaleDateString()} · ${dailyCounts[k] || 0} completed`}><span>{d.getDate()}</span><b data-level={Math.min(dailyCounts[k] || 0, 4)} /></div>; })}</div></section>

      <nav className="monthNav">{months.map(m => <button key={m} className="chip" onClick={() => { setOpenMonths(prev => { const next = new Set(prev); next.add(m); return next; }); setTimeout(() => document.getElementById(m)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}>{m.slice(0, 3)}</button>)}</nav>

      <main>
        {filtered.length ? filtered.map(([m, rows]) => {
          const completed = plan[m].filter((_, i) => state.done[key(m, i)]).length; const pct = Math.round(completed * 100 / plan[m].length);
          const isOpen = openMonths.has(m);
          return <section className="month" id={m} key={m}>
            <div className="monthHead monthToggle" onClick={() => toggleMonth(m)} style={{ cursor: 'pointer', userSelect: 'none' }}>
              <div><h3 className="monthTitle">{m} <span className="monthChevron">{isOpen ? '▾' : '▸'}</span></h3><div className="monthMeta">{plan[m].length} scheduled readings · {completed} completed</div></div>
              <div className="monthMeta">{pct}%</div>
            </div>
            {isOpen && <><div className="monthBar"><span style={{ width: `${pct}%` }} /></div><div className="readingList">
              {rows.map(({ r, i, done }) => <div className={`reading ${done ? 'done' : ''}`} id={`${m}-${i + 1}`} key={key(m, i)}><input className="check" type="checkbox" checked={done} onChange={e => toggleReading(m, i, e.target.checked)} /><div className="day">{i + 1}</div><div className="bookWrap"><div className="book">{te(r[0])}</div><div className="bookEn">{r[0]}</div></div><div className="ref">{chapterTe(r[1])}</div><div className="badge">{done ? `✓ ${new Date(state.completedAt[key(m, i)]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : 'Read'}</div></div>)}
            </div></>}
          </section>;
        }) : <div className="card empty">No readings match the current filter.</div>}
      </main>
      <div className="footer">Schedule transcribed from the supplied 2026 PDF. The printed February 29th row is preserved.</div>
    </div>

    {cloudReady && !user && <div className="authOverlay"><div className="authCard"><div className="authLogo">✦</div><div className="eyebrow">Cloud-synced reading journey</div><h2>{authMode === 'signin' ? 'Welcome back' : 'Create your account'}</h2><p>{authMode === 'signin' ? 'Sign in with your username and password to sync your reading progress.' : 'Pick a username and password — no email needed.'}</p><input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" autoComplete="username" onKeyDown={e => e.key === 'Enter' && signInOrSignUp()} /><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" onKeyDown={e => e.key === 'Enter' && signInOrSignUp()} /><button className="btn gold full" onClick={signInOrSignUp}>{authMode === 'signin' ? 'Sign in' : 'Create account'}</button><button className="linkBtn" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthMessage(''); setUsername(''); setPassword(''); }}>{authMode === 'signin' ? 'Create a new account' : 'I already have an account'}</button>{authMessage && <div className="authMsg">{authMessage}</div>}</div></div>}
    {toast && <div className="toast show">{toast}</div>}
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
