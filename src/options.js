// Removed the left meta icon entirely; the only icon lives inside the combobox.
// Layout: [Slot badge] | [Combobox with site icon + name] | [Actions]
// URL row appears below when "Customize" is selected.

const MAX_SLOTS = 9;
const STORAGE_KEY = "slots";
const SETTINGS_KEY = "settings";
const CUSTOM_VALUE = "__custom__";

const $  = (q, r=document) => r.querySelector(q);
const $$ = (q, r=document) => Array.from(r.querySelectorAll(q));

function slotKey(i){ return `slot_${i}`; }
function toast(msg="Saved ✓"){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),1100); }

/* Favicons with fallbacks so the combobox icon is robust */
function favCandidates(url){
  try{
    const u = new URL(url);
    const ext = chrome.runtime.getURL(`_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`);
    const s2  = `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(url)}`;
    const ddg = `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`;
    return [ext, s2, ddg];
  }catch{ return []; }
}
function loadFavicon(imgEl, url){
  if(!/^https?:\/\//i.test(url)){ imgEl.removeAttribute("src"); imgEl.style.display="none"; return; }
  const srcs = favCandidates(url);
  if(!srcs.length){ imgEl.removeAttribute("src"); imgEl.style.display="none"; return; }
  let i = 0;
  imgEl.style.display = "none";
  imgEl.onerror = () => { i++; if(i < srcs.length){ imgEl.src = srcs[i]; } else { imgEl.style.display="none"; imgEl.removeAttribute("src"); } };
  imgEl.onload = () => { imgEl.style.display="block"; };
  imgEl.src = srcs[0];
}

/* site short name (labels like "github", "chatgpt") */
function siteNameFromUrl(url){
  try{
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = host.split(".").filter(p => !["www","m","app","web"].includes(p));
    if (parts.length >= 3 && ["co","com","org","gov","ac","net","edu"].includes(parts.at(-2))) return parts.at(-3);
    return parts.at(-2) || parts[0] || host;
  }catch{ return url; }
}

function updateCounter(slots){
  const used = Object.values(slots).filter(v=>v?.enabled).length;
  $("#slotCounter").textContent = `${used} / ${MAX_SLOTS}`;
  $("#emptyState").style.display = used ? "none" : "block";
}

/* storage (debounced) */
let _saveTimer=null;
function scheduleSave(slots, settings, immediate=false){ if(immediate) return saveState(slots, settings); clearTimeout(_saveTimer); _saveTimer=setTimeout(()=>saveState(slots, settings), 280); }
async function loadState(){
  const [slotsWrap, settingsWrap] = await Promise.all([ chrome.storage.sync.get(STORAGE_KEY), chrome.storage.sync.get(SETTINGS_KEY) ]);
  const slots = slotsWrap[STORAGE_KEY] || {};
  const settings = settingsWrap[SETTINGS_KEY] || { openMode:"newTab" };
  for(let i=1;i<=MAX_SLOTS;i++){
    const k=slotKey(i); const e=slots[k]; if(!e) continue;
    if(e.enabled===undefined) e.enabled = Boolean(e.url);
    if(!e.openMode) e.openMode = "inherit";
    if(e.custom === undefined) e.custom = !e.url;
  }
  return { slots, settings };
}
async function saveState(slots, settings){ await chrome.storage.sync.set({ [STORAGE_KEY]: slots, [SETTINGS_KEY]: settings }); toast("Saved ✓"); }

/* bookmarks (flat) */
async function getAllBookmarksFlat(){
  const tree = await chrome.bookmarks.getTree();
  const flat=[];
  (function walk(n){
    if(n.url) flat.push({ id:n.id, url:n.url, label: siteNameFromUrl(n.url) });
    if(n.children) for(const c of n.children) walk(c);
  })(tree[0]);
  return flat.filter(b=>/^https?:\/\//i.test(b.url));
}

/* segmented control */
function segInit(segEl, value, onChange){
  $$("button", segEl).forEach(btn=>{
    btn.setAttribute("aria-pressed", String(btn.dataset.val===value));
    btn.onclick=()=>{
      $$("button", segEl).forEach(b=>b.setAttribute("aria-pressed","false"));
      btn.setAttribute("aria-pressed","true");
      onChange(btn.dataset.val);
    };
  });
}
function modeSegment(current="inherit"){
  const seg=document.createElement("div");
  seg.className="seg";
  seg.innerHTML=`
    <button data-val="inherit" aria-pressed="false" title="Use default">Inherit</button>
    <button data-val="current" aria-pressed="false">Current</button>
    <button data-val="newTab" aria-pressed="false">New tab</button>
    <button data-val="newWindow" aria-pressed="false">New win</button>`;
  $$("button",seg).forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.val===current)));
  return seg;
}

/* action buttons (rectangular outline→fill) */
function actionBtn(label, kind){ const b=document.createElement("button"); b.className=`act ${kind}`; b.textContent=label; return b; }

/* ------- Custom Combobox (icons + search) ------- */
function createCombobox({items, value, onChange, labelWhenCustomize="Customize"}){
  const root = document.createElement("div"); root.className="combo"; root.setAttribute("role","combobox"); root.setAttribute("aria-expanded","false");
  const btn  = document.createElement("button"); btn.type="button"; btn.className="combo-btn"; btn.setAttribute("aria-haspopup","listbox");
  const main = document.createElement("div"); main.className="combo-main";
  const icon = document.createElement("img"); icon.className="combo-icon"; icon.alt="";
  const label = document.createElement("span"); label.className="combo-label";
  const caret = document.createElement("span"); caret.className="combo-caret"; caret.innerHTML="▾";
  main.append(icon,label); btn.append(main, caret);

  const pop = document.createElement("div"); pop.className="combo-pop";
  const search = document.createElement("input"); search.className="in combo-search"; search.placeholder="Search…";
  const list = document.createElement("ul"); list.className="combo-list"; list.setAttribute("role","listbox");
  pop.append(search,list);
  root.append(btn,pop);

  function setLabelFromValue(v){
    if(v===CUSTOM_VALUE){
      label.textContent = labelWhenCustomize;
      icon.style.display="none"; icon.removeAttribute("src");
      root.dataset.value = CUSTOM_VALUE;
      return;
    }
    const it = items.find(i => i.value===v);
    if(it){
      label.textContent = it.label || it.value;
      loadFavicon(icon, it.value);
      root.dataset.value = it.value;
    }
  }

  function buildList(){
    list.innerHTML="";
    const q = search.value.trim().toLowerCase();
    const filtered = items.filter(i => (i.label||"").toLowerCase().includes(q));
    const front = [{value:CUSTOM_VALUE, label:labelWhenCustomize}];
    for(const it of [...front, ...filtered]){
      const li = document.createElement("li"); li.className="combo-item"; li.setAttribute("role","option"); li.dataset.value=it.value;
      const img = document.createElement("img");
      if(it.value===CUSTOM_VALUE){ img.style.display="none"; }
      else { loadFavicon(img, it.value); }
      const txt = document.createElement("span"); txt.textContent = it.label || it.value;
      li.append(img, txt);
      li.onclick = () => { setLabelFromValue(it.value); close(); onChange(it.value); };
      list.append(li);
    }
  }

  function open(){ pop.style.display="block"; root.setAttribute("aria-expanded","true"); buildList(); setTimeout(()=>search.focus(), 0); }
  function close(){ pop.style.display="none"; root.setAttribute("aria-expanded","false"); search.value=""; }

  btn.addEventListener("click", (e)=>{ e.stopPropagation(); if(pop.style.display==="block") close(); else open(); });
  document.addEventListener("click", (e)=>{ if(!root.contains(e.target)) close(); });
  search.addEventListener("input", buildList);
  search.addEventListener("keydown", (e)=>{ if(e.key==="Escape"){ close(); btn.focus(); } });

  // init
  setLabelFromValue(value ?? CUSTOM_VALUE);

  return { el: root, setValue: setLabelFromValue, get value(){ return root.dataset.value; } };
}
/* ----------------------------------------------- */

function renderRow(i, slots, settings, bookmarks){
  const k=slotKey(i);
  const entry=slots[k] || { url:"", enabled:true, openMode:"inherit", custom:true };
  if(!entry.enabled) return null;

  const items = bookmarks.map(b => ({ value: b.url, label: siteNameFromUrl(b.url) }));
  const isCustom = entry.custom || !bookmarks.some(b => b.url === entry.url);
  const initialValue = isCustom ? CUSTOM_VALUE : entry.url;

  const row=document.createElement("div"); row.className="row"; row.id=`row_${i}`;

  // meta: Slot badge only (no icon here)
  const meta=document.createElement("div"); meta.className="slot-meta";
  const badge=document.createElement("span"); badge.className="badge"; badge.textContent=`Slot ${i}`;
  meta.append(badge);

  // combobox
  const combo = createCombobox({
    items, value: initialValue,
    onChange: (val)=>{
      if(val===CUSTOM_VALUE){
        slots[k] = { ...(slots[k]||entry), custom:true, enabled:true };
        urlWrap.style.display="block";
      }else{
        slots[k] = { ...(slots[k]||entry), url:val, custom:false, enabled:true };
        urlWrap.style.display="none";
      }
      scheduleSave(slots, settings);
    }
  });

  // URL row (beneath picker/actions)
  const urlWrap=document.createElement("div"); urlWrap.className="url-wrap";
  const url=document.createElement("input"); url.className="in"; url.placeholder="https://example.com";
  url.value = isCustom ? (entry.url||"") : "";
  url.addEventListener("input", ()=>{
    slots[k] = { ...(slots[k]||entry), url:url.value.trim(), custom:true, enabled:true };
    scheduleSave(slots, settings);
  });
  urlWrap.append(url);
  if(isCustom) urlWrap.style.display="block";

  // actions
  const right=document.createElement("div"); right.style.display="flex"; right.style.gap="10px"; right.style.justifyContent="flex-end"; right.style.alignItems="center";
  const seg = modeSegment(entry.openMode||"inherit");
  segInit(seg, entry.openMode||"inherit", (val)=>{ slots[k]={ ...(slots[k]||entry), openMode:val, enabled:true }; scheduleSave(slots, settings); });

  const test = actionBtn("Test","success");
  test.addEventListener("click", async ()=>{
    const chosen = $$('button[aria-pressed="true"]', seg)[0]?.dataset.val || "inherit";
    const global = $$('button[aria-pressed="true"]', $("#defaultSeg"))[0]?.dataset.val || "newTab";
    const mode = (chosen==="inherit") ? global : chosen;
    const selectedValue = combo.value;
    const u = selectedValue===CUSTOM_VALUE ? url.value.trim() : selectedValue;
    if(!u) return toast("Set a URL first");
    await chrome.runtime.sendMessage({ type:"openUrl", url:u, mode });
  });

  const del = actionBtn("Delete","danger");
  del.addEventListener("click", async ()=>{
    slots[k]={ url:"", enabled:false, openMode:"inherit", custom:false };
    row.remove(); scheduleSave(slots, settings, true); updateCounter(slots); toast("Slot deleted");
  });

  right.append(seg, test, del);

  // assemble
  row.append(meta, combo.el, right, urlWrap);

  return row;
}

/* page init */
async function buildUI(){
  const slotList=$("#slotList"); slotList.innerHTML="";
  const [bookmarks, state] = await Promise.all([getAllBookmarksFlat(), loadState()]);
  const { slots, settings } = state;

  segInit($("#defaultSeg"), settings.openMode||"newTab", (val)=>{ settings.openMode=val; scheduleSave(slots, settings); });

  for(let i=1;i<=MAX_SLOTS;i++){
    const row=renderRow(i, slots, settings, bookmarks);
    if(row) slotList.append(row);
  }
  updateCounter(slots);

  $("#addSlotBtn").onclick=async()=>{
    const s = (await loadState());
    for(let i=1;i<=MAX_SLOTS;i++){
      const k=slotKey(i);
      if(!s.slots[k]?.enabled){
        s.slots[k]={ url:"", enabled:true, openMode:"inherit", custom:true };
        await saveState(s.slots, s.settings);
        const freshRow=renderRow(i, s.slots, s.settings, await getAllBookmarksFlat());
        if(freshRow) $("#slotList").append(freshRow);
        updateCounter(s.slots);
        break;
      }
    }
  };

  $("#resetBtn").onclick=async()=>{
    if(!confirm("Reset all slots and defaults?")) return;
    const fresh={}; for(let i=1;i<=MAX_SLOTS;i++) fresh[slotKey(i)]={ url:"", enabled:false, openMode:"inherit", custom:false };
    await saveState(fresh, { openMode:"newTab" }); buildUI();
  };

  $("#shortcutsBtn").onclick=()=> chrome.tabs.create({ url:"chrome://extensions/shortcuts" });
}

buildUI();
