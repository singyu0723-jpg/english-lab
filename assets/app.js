/* English Lab — shared runtime (no build step) */
(function(){
  const NS = 'el:';
  // ---------- date helpers (device local time) ----------
  const pad = n => String(n).padStart(2,'0');
  const dkey = (d=new Date()) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const addDays = (key, n) => { const [y,m,d]=key.split('-').map(Number); const t=new Date(y,m-1,d+n); return dkey(t); };
  const weekday = (key) => { const [y,m,d]=key.split('-').map(Number); return new Date(y,m-1,d).getDay(); }; // 0=Sun
  const daysBetween = (a,b) => { const [y1,m1,d1]=a.split('-').map(Number),[y2,m2,d2]=b.split('-').map(Number); return Math.round((new Date(y2,m2-1,d2)-new Date(y1,m1-1,d1))/864e5); };

  // ---------- storage: localStorage now, Firebase mirror when configured ----------
  const mem = {};
  function lsGet(k){ try{ const v=localStorage.getItem(NS+k); return v==null?undefined:JSON.parse(v);}catch(e){return undefined;} }
  function lsSet(k,v){ try{ localStorage.setItem(NS+k, JSON.stringify(v)); }catch(e){} }
  // ---------- 重新開始：改這個日期，所有裝置下次打開會清空進度 ----------
  const RESET_EPOCH = '2026-10-28';
  let justReset = false;
  (function(){ try{
    if(localStorage.getItem(NS+'_epoch') !== JSON.stringify(RESET_EPOCH)){
      const keys=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k.startsWith(NS)) keys.push(k); }
      keys.forEach(k=>localStorage.removeItem(k));
      localStorage.setItem(NS+'_epoch', JSON.stringify(RESET_EPOCH));
      localStorage.setItem(NS+'_updated', JSON.stringify(Date.now()));
      justReset = true;
    }
  }catch(e){} })();
  const listeners = [];
  const Store = {
    get(k, def){ const v = lsGet(k); return v===undefined ? def : v; },
    set(k, v){ lsSet(k, v); lsSet('_updated', Date.now()); listeners.forEach(f=>f(k,v)); Store._mirror(k,v); },
    update(k, fn, def){ const v = fn(Store.get(k, def)); Store.set(k, v); return v; },
    onChange(f){ listeners.push(f); },
    _mirror(){}, // replaced by firebase adapter
    exportAll(){ const out={}; for(let i=0;i<localStorage.length;i++){ const key=localStorage.key(i); if(key.startsWith(NS)) out[key.slice(NS.length)]=lsGet(key.slice(NS.length)); } return out; },
    importAll(obj){ Object.entries(obj).forEach(([k,v])=>lsSet(k,v)); }
  };

  // ---------- Firebase adapter (optional) ----------
  // Put a firebase-config.js next to index.html that sets window.FIREBASE_CONFIG = {...}
  // Sign-in is Google (same account on Mac + iPhone = same data). Until signed in, data stays on this device.
  const Auth = { user:null, ready:false, available:false };
  function emitAuth(){ document.dispatchEvent(new CustomEvent('el:auth', {detail:Auth})); }
  async function attachSync(user){
    const db = firebase.firestore();
    const ref = db.collection('users').doc(user.uid);
    const snap = await ref.get();
    let overwrite = false;
    if(snap.exists){
      const remote = snap.data();
      if(remote._epoch !== RESET_EPOCH){ overwrite = true; } // 雲端還是舊進度：用本機（已清空）蓋掉
      else {
        const lu = Store.get('_updated',0);
        if((remote._updated||0) > lu){ Store.importAll(remote); document.dispatchEvent(new CustomEvent('el:remote-loaded')); }
      }
    }
    let timer=null;
    Store._mirror = function(){ clearTimeout(timer); timer=setTimeout(()=>{ const m = overwrite ? {} : {merge:true}; overwrite=false; ref.set(Store.exportAll(), m).catch(e=>console.warn('sync fail', e.message)); }, 800); };
    Store._mirror();
  }
  async function initFirebase(){
    if(!window.FIREBASE_CONFIG || !window.firebase){ Auth.ready=true; emitAuth(); return false; }
    try{
      if(!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      Auth.available = true;
      const auth = firebase.auth();
      try{ await auth.getRedirectResult(); }catch(e){ console.warn('redirect result', e.message); }
      auth.onAuthStateChanged(async user => {
        Auth.user = user ? {uid:user.uid, name:user.displayName, email:user.email, photo:user.photoURL} : null;
        if(user){ try{ await attachSync(user); }catch(e){ console.warn('sync off:', e.message); } }
        else { Store._mirror = function(){}; }
        Auth.ready = true; emitAuth();
      });
      return true;
    }catch(e){ console.warn('firebase off:', e.message); Auth.ready=true; emitAuth(); return false; }
  }
  async function signIn(){
    if(!Auth.available) return toast('這個版本沒有接 Firebase');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    try{ await firebase.auth().signInWithPopup(provider); }
    catch(e){
      if(/popup/.test(e.code||'')) { await firebase.auth().signInWithRedirect(provider); }
      else toast('登入失敗：'+e.message);
    }
  }
  async function signOut(){ if(Auth.available){ await firebase.auth().signOut(); toast('已登出，資料留在這台裝置'); } }

  // ---------- nav ----------
  const TABS = [
    ['index.html','今日','🏠'], ['grammar.html','文法','📘'], ['vocab.html','單字','🔤'], ['listen.html','聽','🎧'], ['speak.html','說','🗣️']
  ];
  function renderNav(){
    const here = location.pathname.split('/').pop() || 'index.html';
    const nav = document.createElement('nav'); nav.className='tabs';
    nav.innerHTML = TABS.map(([h,l,i])=>`<a href="${h}" class="${h===here?'active':''}"><span class="ic">${i}</span><span>${l}</span></a>`).join('');
    document.body.appendChild(nav);
  }

  // ---------- auth status line (put <div id="auth"></div> anywhere) ----------
  function renderAuth(){
    const el = document.getElementById('auth'); if(!el) return;
    const draw = () => {
      if(!Auth.ready){ el.innerHTML = '<span class="muted">連線中…</span>'; return; }
      if(!Auth.available){ el.innerHTML = '<span class="muted">資料只存在這台裝置</span>'; return; }
      if(Auth.user){ el.innerHTML = `<span class="muted">同步中 · ${Auth.user.name||Auth.user.email||''}</span> <button class="btn small ghost" id="authOut">登出</button>`; }
      else { el.innerHTML = `<span class="muted">尚未同步，進度只在這台裝置</span> <button class="btn small primary" id="authIn">用 Google 登入同步</button>`; }
    };
    el.addEventListener('click', e=>{ if(e.target.id==='authIn') signIn(); if(e.target.id==='authOut') signOut(); });
    document.addEventListener('el:auth', draw); draw();
  }

  // ---------- toast ----------
  let toastEl;
  function toast(msg){ if(!toastEl){ toastEl=document.createElement('div'); toastEl.className='toast'; document.body.appendChild(toastEl);} toastEl.textContent=msg; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'),1600); }

  // ---------- daily log / streak ----------
  // log[date] = { done:true|false, tasks:{id:true}, minimal:true }
  function getLog(){ return Store.get('log', {}); }
  function markTask(date, id, on){ Store.update('log', log=>{ log[date]=log[date]||{tasks:{}}; log[date].tasks=log[date].tasks||{}; if(on) log[date].tasks[id]=true; else delete log[date].tasks[id]; return log; }, {}); }
  function setDayDone(date, on, minimal){ Store.update('log', log=>{ log[date]=log[date]||{tasks:{}}; log[date].done=!!on; if(minimal!==undefined) log[date].minimal=!!minimal; return log; }, {}); }
  function streak(today){ const log=getLog(); let n=0, d=today; if(!(log[d]&&log[d].done)) d=addDays(d,-1); while(log[d]&&log[d].done){ n++; d=addDays(d,-1);} return n; }
  function monthCount(today){ const log=getLog(); const ym=today.slice(0,7); return Object.keys(log).filter(k=>k.startsWith(ym)&&log[k].done).length; }
  function totalCount(){ const log=getLog(); return Object.values(log).filter(v=>v.done).length; }

  // ---------- fetch helper ----------
  async function loadJSON(path){ const r = await fetch(path, {cache:'no-cache'}); if(!r.ok) throw new Error(path); return r.json(); }
  async function loadText(path){ const r = await fetch(path, {cache:'no-cache'}); if(!r.ok) throw new Error(path); return r.text(); }

  // ---------- speech (Web Speech API, 不需要音檔) ----------
  const Speech = { ok: 'speechSynthesis' in window, voice: null };
  function pickVoice(){
    if(!Speech.ok) return null;
    const vs = speechSynthesis.getVoices();
    if(!vs.length) return null;
    const pref = ['Samantha','Google US English','Microsoft Aria','Microsoft Jenny','Alex','Ava','Allison'];
    let v = null;
    for(const p of pref){ v = vs.find(x=>x.name.startsWith(p) && /^en[-_]US/i.test(x.lang)); if(v) break; }
    if(!v) v = vs.find(x=>/^en[-_]US/i.test(x.lang)) || vs.find(x=>/^en/i.test(x.lang)) || null;
    Speech.voice = v; return v;
  }
  if(Speech.ok){ pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text, opts={}){
    if(!Speech.ok || !text) return false;
    try{
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/\*/g,''));
      u.lang = 'en-US'; u.rate = opts.rate || 0.92; u.pitch = 1;
      const v = Speech.voice || pickVoice(); if(v) u.voice = v;
      speechSynthesis.speak(u);
      return true;
    }catch(e){ return false; }
  }

  window.EL = { Store, dkey, addDays, weekday, daysBetween, renderNav, toast, getLog, markTask, setDayDone, streak, monthCount, totalCount, loadJSON, loadText, initFirebase, Auth, signIn, signOut, renderAuth, speak, Speech };
  document.addEventListener('DOMContentLoaded', renderNav);
})();
