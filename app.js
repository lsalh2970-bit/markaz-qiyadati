/* مركز قيادتي الشخصي — تطبيق متكامل يعمل محليًا */
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const LS_KEY='personal-command-center-v1';
const PRAYER_NAMES={Fajr:'الفجر',Sunrise:'الشروق',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'};
const PRAYER_ORDER=['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
const PRAYER_KEYS=['Fajr','Dhuhr','Asr','Maghrib','Isha'];

function todayKey(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function addDays(key,n){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+n);return todayKey(d);}
function toast(m){const w=$('#toastWrap');const t=document.createElement('div');t.className='toast';t.textContent=m;w.appendChild(t);setTimeout(()=>t.remove(),3200);}
function uid(){return 'x'+Date.now().toString(36)+Math.floor(Math.random()*9999);}

/* ---------- Database ---------- */
let DB=null;
function defaultDB(){return {
  settings:{name:'',city:'الرياض',country:'Saudi Arabia',method:4,remind:10,offsets:{Fajr:0,Sunrise:0,Dhuhr:0,Asr:0,Maghrib:0,Isha:0},lat:null,lon:null},
  prayers:{}, // dateKey -> {Fajr:'done'...}
  adhkarCustom:[], adhkarDone:{}, // dateKey -> {dhikrId:count}
  tasbih:{current:{dhikr:'سبحان الله',count:0,target:100},log:[]},
  quran:{target:10,log:[]},
  tasks:[], projects:[], ideas:[],
  daily:{}, habits:[],
  notifs:[], notifCfg:{prayer:true,adhkar:true,tasks:true,habits:true},
  quotesSeen:0
};}
function load(){try{const r=localStorage.getItem(LS_KEY);DB=r?{...defaultDB(),...JSON.parse(r)}:defaultDB();}catch{DB=defaultDB();}
  if(!DB.settings)DB=defaultDB();}
function save(){localStorage.setItem(LS_KEY,JSON.stringify(DB));}
load();

/* ---------- Quotes ---------- */
const QUOTES=['﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾ — خطوة صغيرة اليوم تصنع فرقًا كبيرًا غدًا 🌱','النجاح قرار يومي: صلاة في وقتها، ورد ثابت، ومهمة تُنجز بإتقان ✨','لا تقارن بدايتك بمنتصف طريق الآخرين. قارن نفسك بأمسِك 🌿','«أحب الأعمال إلى الله أدومها وإن قل» — الثبات يغلب الحماس 🤍','رتب يومك ترتب حياتك. ابدأ بالأهم ثم المهم 📋','كل صباح فرصة جديدة: ﴿ إِنَّ مَعَ الْعُسْرِ يُسْرًا ﴾ ☀️','العادات الصغيرة المتكررة تبني شخصية عظيمة 🔥','أنجز 1% أفضل كل يوم، وستندهش بعد سنة 📈','وقتك هو عمرك — احمه من التشتت ⏳','ابدأ ولو بخطوة: «ما لا يُدرك كله لا يُترك جله» 🚀'];

/* ---------- Dates & greeting ---------- */
function renderDates(){
  const now=new Date();
  const h=now.getHours();
  $('#greeting').textContent=(h>=5&&h<12?'صباح الخير 👋':h>=12&&h<17?'مساء النور ☀️':h>=17&&h<23?'مساء الخير 🌙':'ليلة هادئة 🌌');
  try{
    $('#gregDate').textContent=new Intl.DateTimeFormat('ar-SA',{day:'numeric',month:'long',year:'numeric'}).format(now);
    $('#hijriDate').textContent=new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{day:'numeric',month:'long',year:'numeric'}).format(now);
    $('#weekday').textContent=new Intl.DateTimeFormat('ar-SA',{weekday:'long'}).format(now);
  }catch{$('#gregDate').textContent=now.toLocaleDateString('ar');$('#hijriDate').textContent='';$('#weekday').textContent='';}
  const qi=new Date().getDate()%QUOTES.length;
  $('#dailyQuote').textContent=QUOTES[qi];
}

/* ---------- Router ---------- */
function go(page){
  $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $$('#bottomNav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $$('.page').forEach(p=>p.classList.remove('active'));
  const el=$('#page-'+page); if(el)el.classList.add('active');
  $('#sidebar').classList.remove('open');$('#overlay').classList.remove('show');
  window.scrollTo({top:0,behavior:'smooth'});
  if(page==='reports')renderReports(); if(page==='calendar')renderCalendar(); if(page==='dashboard')renderDashboard();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)go(b.dataset.page);});
$('#menuBtn').onclick=()=>{$('#sidebar').classList.add('open');$('#overlay').classList.add('show');};
$('#overlay').onclick=()=>{$('#sidebar').classList.remove('open');$('#overlay').classList.remove('show');};
// theme
if(localStorage.getItem('pcc-theme')==='dark'){document.documentElement.dataset.theme='dark';$('#themeBtn').textContent='☀️';}
$('#themeBtn').onclick=()=>{const d=document.documentElement.dataset.theme==='dark';document.documentElement.dataset.theme=d?'':'dark';localStorage.setItem('pcc-theme',d?'light':'dark');$('#themeBtn').textContent=d?'🌙':'☀️';};
$('#bellBtn').onclick=()=>go('alerts');

/* ================= PRAYER ================= */
let prayerTimings=null, prayerHijri='';
async function fetchPrayer(){
  const s=DB.settings;
  $('#prayerCityPill').textContent=s.city||'—';
  let url;
  if(s.lat&&s.lon)url=`https://api.aladhan.com/v1/timings/${Math.floor(Date.now()/1000)}?latitude=${s.lat}&longitude=${s.lon}&method=${s.method}`;
  else url=`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(s.city)}&country=${encodeURIComponent(s.country)}&method=${s.method}`;
  try{
    const r=await fetch(url);const j=await r.json();const t=j.data.timings;
    prayerTimings={};PRAYER_ORDER.forEach(k=>{let v=t[k].split(' ')[0];const[h,m]=v.split(':').map(Number);const off=+((s.offsets||{})[k]||0);let dt=new Date();dt.setHours(h,m+off,0,0);prayerTimings[k]=dt;});
    const hj=j.data.date.hijri; prayerHijri=`${hj.day} ${hj.month.ar} ${hj.year}هـ`;
    try{$('#hijriDate').textContent=prayerHijri;}catch{}
  }catch{
    // fallback default Riyadh-ish
    const base={Fajr:'04:30',Sunrise:'05:55',Dhuhr:'12:03',Asr:'15:25',Maghrib:'18:20',Isha:'19:50'};
    prayerTimings={};PRAYER_ORDER.forEach(k=>{const[h,m]=base[k].split(':').map(Number);const d=new Date();d.setHours(h,m,0,0);prayerTimings[k]=d;});
  }
  renderPrayerList();renderPrayerCheck();
}
function fmtT(d){return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function nextPrayer(){
  if(!prayerTimings)return null;
  const now=new Date();
  for(const k of PRAYER_ORDER){if(k==='Sunrise')continue;if(prayerTimings[k]>now)return k;}
  return 'Fajr'; // tomorrow
}
function renderPrayerList(){
  if(!prayerTimings)return;
  const nx=nextPrayer();
  $('#prayerList').innerHTML=PRAYER_ORDER.map(k=>`<div class="p-row ${k===nx?'next':''}"><span>${k==='Sunrise'?'🌅':'🕌'} ${PRAYER_NAMES[k]}</span><span class="t">${fmtT(prayerTimings[k])}</span>${k===nx?'<span class="badge">القادمة</span>':''}</div>`).join('');
  const n2=$('#nextPrayerName');
  if(n2){const disp=nx==='Fajr'&&new Date()>prayerTimings['Isha']?'الفجر (غدًا)':PRAYER_NAMES[nx];n2.textContent='🕌 '+disp;$('#prayerNext2').textContent=disp;}
}
function tickCountdown(){
  if(!prayerTimings)return;
  let nx=nextPrayer();let target=prayerTimings[nx];const now=new Date();
  if(target<=now&&nx==='Fajr'){target=new Date(target);target.setDate(target.getDate()+1);}
  let diff=Math.max(0,target-now);
  const hh=String(Math.floor(diff/3600000)).padStart(2,'0'),mm=String(Math.floor(diff%3600000/60000)).padStart(2,'0'),ss=String(Math.floor(diff%60000/1000)).padStart(2,'0');
  const cd=`${hh}:${mm}:${ss}`;
  const a=$('#prayerCountdown');if(a)a.textContent=cd;
  const b=$('#prayerCd2');if(b)b.textContent=cd;
  if(b&&$('#nextPrayerTime'))$('#nextPrayerTime').textContent=fmtT(prayerTimings[nx]);
}
setInterval(tickCountdown,1000);
function renderPrayerCheck(){
  const k=todayKey();const rec=DB.prayers[k]||{};
  $('#prayerCheck').innerHTML=PRAYER_KEYS.map(p=>{
    const v=rec[p]||'none';
    const dot=v==='done'?'🟢 أديت':v==='late'?'🟡 متأخرة':'⚪ لم تُسجل';
    return `<div class="chk" data-p="${p}"><span>🕌 ${PRAYER_NAMES[p]}</span><span class="st">${dot}</span></div>`;
  }).join('');
  document.querySelectorAll('#prayerCheck .chk').forEach(el=>el.onclick=()=>{
    const p=el.dataset.p;const cur=(DB.prayers[k]||{})[p]||'none';
    const nxt=cur==='none'?'done':cur==='done'?'late':'none';
    DB.prayers[k]=DB.prayers[k]||{};DB.prayers[k][p]=nxt;save();renderPrayerCheck();renderDashboard();
  });
  const done=PRAYER_KEYS.filter(p=>rec[p]==='done'||rec[p]==='late').length;
  $('#prayerScore').textContent=`اليوم: ${done} / 5`;
  let w=0;for(let i=0;i<7;i++){const kk=addDays(k,-i);const r=DB.prayers[kk]||{};w+=PRAYER_KEYS.filter(p=>r[p]==='done'||r[p]==='late').length;}
  $('#weekPrayerScore').textContent=`${w} / 35`;
}
// settings
function initPrayerSettings(){
  const s=DB.settings;
  $('#setCity').value=s.city||'';$('#setCountry').value=s.country||'';$('#setMethod').value=String(s.method??4);$('#setRemind').value=s.remind??10;
  $('#offsetGrid').innerHTML=PRAYER_ORDER.map(k=>`<label>${PRAYER_NAMES[k]}<input type="number" data-off="${k}" value="${(s.offsets||{})[k]||0}"></label>`).join('');
}
$('#savePrayerSettings').onclick=()=>{
  DB.settings.city=$('#setCity').value.trim()||'الرياض';DB.settings.country=$('#setCountry').value.trim()||'Saudi Arabia';
  DB.settings.method=+$('#setMethod').value;DB.settings.remind=+$('#setRemind').value||0;DB.settings.lat=null;DB.settings.lon=null;
  DB.settings.offsets={};document.querySelectorAll('[data-off]').forEach(i=>DB.settings.offsets[i.dataset.off]=+i.value||0);
  save();toast('تم حفظ إعدادات الصلاة ✅');fetchPrayer();
};
$('#geoBtn').onclick=()=>{
  if(!navigator.geolocation)return toast('المتصفح لا يدعم تحديد الموقع');
  toast('جارٍ تحديد موقعك...');
  navigator.geolocation.getCurrentPosition(p=>{DB.settings.lat=p.coords.latitude.toFixed(3);DB.settings.lon=p.coords.longitude.toFixed(3);save();fetchPrayer();toast('تم تحديد موقعك 📍');},()=>toast('تعذر تحديد الموقع'));
};

/* ================= ADHKAR ================= */
const ADH_CATS=['أذكار الصباح','أذكار المساء','أذكار بعد الصلاة','أذكار النوم','أذكار الاستيقاظ','أذكار عامة','الاستغفار','الصلاة على النبي ﷺ'];
const ADH_DATA=[
 {c:0,t:'أعوذ بالله من الشيطان الرجيم: ﴿اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...﴾ (آية الكرسي)',n:1},
 {c:0,t:'بسم الله الرحمن الرحيم: ﴿قُلْ هُوَ اللَّهُ أَحَدٌ...﴾ والمعوذتين',n:3},
 {c:0,t:'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له',n:1},
 {c:0,t:'اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور',n:1},
 {c:0,t:'رضيت بالله ربًا وبالإسلام دينًا وبمحمد ﷺ نبيًا',n:3},
 {c:0,t:'اللهم إني أسألك العافية في الدنيا والآخرة',n:1},
 {c:0,t:'سبحان الله وبحمده',n:100},
 {c:0,t:'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير',n:10},
 {c:1,t:'أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له',n:1},
 {c:1,t:'اللهم بك أمسينا وبك أصبحنا وبك نحيا وبك نموت وإليك المصير',n:1},
 {c:1,t:'أعوذ بكلمات الله التامات من شر ما خلق',n:3},
 {c:1,t:'بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم',n:3},
 {c:1,t:'سبحان الله وبحمده',n:100},
 {c:2,t:'أستغفر الله (ثلاثًا): اللهم أنت السلام ومنك السلام تباركت يا ذا الجلال والإكرام',n:1},
 {c:2,t:'سبحان الله',n:33},{c:2,t:'الحمد لله',n:33},{c:2,t:'الله أكبر',n:34},
 {c:2,t:'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير',n:10},
 {c:3,t:'باسمك اللهم أموت وأحيا',n:1},
 {c:3,t:'اللهم قني عذابك يوم تبعث عبادك',n:3},
 {c:3,t:'باسمك اللهم وضعت جنبي وبك أرفعه، فإن أمسكت نفسي فارحمها',n:1},
 {c:3,t:'سورة الإخلاص والمعوذتين (يمسح بهما ما استطاع من جسده)',n:3},
 {c:3,t:'سبحان الله (33) والحمد لله (33) والله أكبر (34)',n:1},
 {c:4,t:'الحمد لله الذي أحيانا بعد ما أماتنا وإليه النشور',n:1},
 {c:4,t:'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير',n:1},
 {c:5,t:'لا إله إلا الله',n:100},{c:5,t:'سبحان الله وبحمده سبحان الله العظيم',n:100},
 {c:5,t:'لا حول ولا قوة إلا بالله',n:100},{c:5,t:'سبحان الله والحمد لله ولا إله إلا الله والله أكبر',n:100},
 {c:6,t:'أستغفر الله وأتوب إليه',n:100},{c:6,t:'رب اغفر لي وتب علي إنك أنت التواب الرحيم',n:100},{c:6,t:'سيد الاستغفار: اللهم أنت ربي لا إله إلا أنت خلقتني وأنا عبدك...',n:1},
 {c:7,t:'اللهم صل وسلم على نبينا محمد',n:100},{c:7,t:'اللهم صل على محمد وعلى آل محمد كما صليت على إبراهيم...',n:10},
];
let adhCat=0;
function allAdhkar(){return ADH_DATA.map((d,i)=>({...d,id:'a'+i})).concat(DB.adhkarCustom);}
function renderAdhkarTabs(){
  $('#adhkarTabs').innerHTML=ADH_CATS.map((c,i)=>`<button class="tab ${i===adhCat?'active':''}" data-ac="${i}">${c}</button>`).join('');
  document.querySelectorAll('[data-ac]').forEach(b=>b.onclick=()=>{adhCat=+b.dataset.ac;renderAdhkarTabs();renderAdhkarList();});
  $('#customDhikrCat').innerHTML=ADH_CATS.map((c,i)=>`<option value="${i}">${c}</option>`).join('');
}
function adhCount(id){return (DB.adhkarDone[todayKey()]||{})[id]||0;}
function renderAdhkarList(){
  const items=allAdhkar().filter(d=>d.c===adhCat);
  const total=items.reduce((s,d)=>s+d.n,0),done=items.reduce((s,d)=>s+Math.min(adhCount(d.id),d.n),0);
  const pct=total?Math.round(done/total*100):0;
  $('#adhkarCatBar').style.width=pct+'%';$('#adhkarCatTxt').textContent=`تقدم ${ADH_CATS[adhCat]}: ${done} / ${total} (${pct}%)`;
  $('#adhkarList').innerHTML=items.map(d=>{
    const c=adhCount(d.id),p=Math.min(100,Math.round(c/d.n*100));
    return `<div class="card"><b>${d.t}</b><div class="progress-line">الهدف: ${d.n} • المنجز: ${c} • ${p}%</div><div class="bar"><div style="width:${p}%"></div></div>
    <div class="row"><button class="btn primary sm" onclick="bumpDhikr('${d.id}')">+1 سبّح</button><button class="btn ghost sm" onclick="doneDhikr('${d.id}')">تم ✓</button><button class="btn ghost sm" onclick="resetDhikr('${d.id}')">تصفير</button></div>
    ${c>=d.n?'<div class="stat-sub">🌿 أحسنت، أتممت هذا الورد اليوم</div>':''}</div>`;
  }).join('')||'<div class="card">لا توجد أذكار في هذا التصنيف بعد.</div>';
}
window.bumpDhikr=id=>{const k=todayKey();DB.adhkarDone[k]=DB.adhkarDone[k]||{};DB.adhkarDone[k][id]=(DB.adhkarDone[k][id]||0)+1;save();renderAdhkarList();renderDashboard();
  const d=allAdhkar().find(x=>x.id===id);if(d&&DB.adhkarDone[k][id]===d.n)toast('أحسنت، أتممت وردك اليوم 🌿');};
window.doneDhikr=id=>{const d=allAdhkar().find(x=>x.id===id);const k=todayKey();DB.adhkarDone[k]=DB.adhkarDone[k]||{};DB.adhkarDone[k][id]=d.n;save();renderAdhkarList();renderDashboard();toast('تقبل الله 🌿');};
window.resetDhikr=id=>{const k=todayKey();if(DB.adhkarDone[k])DB.adhkarDone[k][id]=0;save();renderAdhkarList();renderDashboard();};
$('#addCustomDhikr').onclick=()=>{
  const t=$('#customDhikrText').value.trim();if(!t)return toast('اكتب نص الذكر أولًا');
  DB.adhkarCustom.push({id:uid(),c:+$('#customDhikrCat').value,t,n:+$('#customDhikrCount').value||33});
  $('#customDhikrText').value='';save();renderAdhkarList();toast('تمت إضافة الذكر 🌿');
};

/* ================= TASBIH ================= */
const TASBIH_PRESET=['سبحان الله','الحمد لله','الله أكبر','لا إله إلا الله','أستغفر الله','اللهم صل وسلم على نبينا محمد ﷺ','سبحان الله وبحمده سبحان الله العظيم','لا حول ولا قوة إلا بالله'];
function renderTasbih(){
  const c=DB.tasbih.current;
  $('#tasbihDhikr').textContent=c.dhikr;$('#tasbihCount').textContent=c.count;$('#tasbihTarget').textContent=c.target;
  $('#tasbihRound').textContent=Math.floor(c.count/c.target)+1;
  $('#tasbihBar').style.width=Math.min(100,c.count%c.target===0&&c.count>0?100:(c.count%c.target)/c.target*100)+'%';
  $('#tasbihSelect').innerHTML=TASBIH_PRESET.map(d=>`<option ${d===c.dhikr?'selected':''}>${d}</option>`).join('');
  const log=DB.tasbih.log.slice().reverse().slice(0,30);
  const tt=todayKey();
  $('#tasbihTodayTotal').textContent=DB.tasbih.log.filter(l=>l.date===tt).reduce((s,l)=>s+l.count,0);
  $('#tasbihLog').innerHTML=log.map(l=>`<div class="item"><span>📿</span><div class="grow"><b>${l.dhikr}</b><small>${l.date} • العدد: ${l.count}</small></div></div>`).join('')||'<div class="stat-sub">لا جلسات بعد — ابدأ التسبيح 🌿</div>';
}
$('#tasbihPlus').onclick=()=>{DB.tasbih.current.count++;save();renderTasbih();
  const c=DB.tasbih.current;if(c.count%c.target===0)toast('ما شاء الله! أتممت '+c.target+' 🌿');};
$('#tasbihReset').onclick=()=>{DB.tasbih.current.count=0;save();renderTasbih();};
$('#tasbihSave').onclick=()=>{const c=DB.tasbih.current;if(!c.count)return toast('العداد صفر');DB.tasbih.log.push({date:todayKey(),dhikr:c.dhikr,count:c.count});c.count=0;save();renderTasbih();toast('حُفظت الجلسة 💾');};
$('#tasbihSelect').onchange=e=>{DB.tasbih.current.dhikr=e.target.value;DB.tasbih.current.count=0;save();renderTasbih();};
$('#tasbihUseCustom').onclick=()=>{const v=$('#tasbihCustom').value.trim();if(!v)return toast('اكتب الذكر');DB.tasbih.current.dhikr=v;DB.tasbih.current.count=0;$('#tasbihCustom').value='';save();renderTasbih();};
$('#tasbihTargetInput').onchange=e=>{DB.tasbih.current.target=Math.max(1,+e.target.value||100);save();renderTasbih();};
$('#clearTasbih').onclick=()=>{if(confirm('مسح سجل المسبحة؟')){DB.tasbih.log=[];save();renderTasbih();}};

/* ================= QURAN ================= */
function quranTodayPages(){return DB.quran.log.filter(l=>l.date===todayKey()).reduce((s,l)=>s+(+l.pages||0),0);}
function renderQuran(){
  $('#qTarget').value=DB.quran.target;$('#qTargetTxt').textContent=DB.quran.target;
  const d=quranTodayPages();$('#qDone').textContent=d;
  const p=Math.min(100,Math.round(d/DB.quran.target*100));$('#qBar').style.width=p+'%';$('#qPct').textContent=p+'%';
  const sum=arr=>arr.reduce((s,l)=>s+(+l.pages||0),0);
  const k=todayKey();const w7=[...Array(7)].map((_,i)=>addDays(k,-i));const m0=k.slice(0,7);
  const w=sum(DB.quran.log.filter(l=>w7.includes(l.date))),m=sum(DB.quran.log.filter(l=>l.date.startsWith(m0)));
  const types={};DB.quran.log.forEach(l=>types[l.type]=(types[l.type]||0)+(+l.pages||0));
  $('#quranStats').innerHTML=`<div class="item"><div class="grow"><b>آخر 7 أيام: ${w} صفحة</b><small>هذا الشهر: ${m} صفحة • ${Object.entries(types).map(([t,v])=>t+': '+v).join(' • ')||'لا بيانات'}</small></div></div>`;
  $('#quranLog').innerHTML=DB.quran.log.slice().reverse().slice(0,20).map(l=>`<div class="item"><span>📖</span><div class="grow"><b>${l.type} — ${l.pages} صفحات ${l.surah?'• '+l.surah:''}</b><small>${l.date} ${l.note?'• '+l.note:''}</small></div><button class="btn ghost sm" onclick="delQuran('${l.id}')">✕</button></div>`).join('')||'<div class="stat-sub">لا تسجيلات بعد.</div>';
}
window.delQuran=id=>{DB.quran.log=DB.quran.log.filter(l=>l.id!==id);save();renderQuran();renderDashboard();};
$('#saveQTarget').onclick=()=>{DB.quran.target=Math.max(1,+$('#qTarget').value||10);save();renderQuran();renderDashboard();toast('حُفظ المستهدف 📖');};
$('#addQuran').onclick=()=>{DB.quran.log.push({id:uid(),date:todayKey(),type:$('#qType').value,pages:+$('#qPages').value||1,surah:$('#qSurah').value.trim(),note:$('#qNote').value.trim()});$('#qNote').value='';save();renderQuran();renderDashboard();toast('تقبل الله 📖');};

/* ================= TASKS ================= */
let taskFilter='all';
function refreshProjectOptions(){const sel=$('#tProject');const cur=sel.value;sel.innerHTML='<option value="">— بدون مشروع —</option>'+DB.projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');sel.value=cur;}
function renderTasks(){
  refreshProjectOptions();
  document.querySelectorAll('#taskTabs .tab').forEach(t=>t.classList.toggle('active',t.dataset.f===taskFilter));
  const k=todayKey();
  let list=DB.tasks.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  if(taskFilter==='today')list=list.filter(t=>!t.date||t.date===k);
  else if(taskFilter!=='all')list=list.filter(t=>t.status==={new:'جديدة',doing:'قيد التنفيذ',done:'مكتملة',delayed:'مؤجلة'}[taskFilter]);
  const pr={عاجلة:'🔴',مهمة:'🟠',عادية:'🟢'};
  $('#taskList').innerHTML=list.map(t=>{
    const pj=DB.projects.find(p=>p.id===t.projectId);
    return `<div class="item ${t.status==='مكتملة'?'done':''}" draggable="true" data-tid="${t.id}">
    <input type="checkbox" class="task-check" ${t.status==='مكتملة'?'checked':''} onchange="toggleTask('${t.id}')">
    <div class="grow"><b>${pr[t.priority]||''} ${t.title}</b>
    <small>${t.date||''} ${t.time||''} • ${t.category||''} ${pj?'• 🚀 '+pj.name:''} • ${t.status} ${t.repeat?'• 🔁 '+t.repeat:''}</small>
    ${t.desc?`<small>${t.desc}</small>`:''}
    ${(t.checklist||[]).length?`<small>${t.checklist.map((c,i)=>`<label style="display:flex;gap:6px;align-items:center;color:inherit"><input type="checkbox" ${c.done?'checked':''} onchange="toggleSub('${t.id}',${i})"> ${c.text}</label>`).join('')}</small>`:''}
    </div>
    <div style="display:flex;gap:4px;flex-wrap:wrap">
      ${t.status!=='مكتملة'?`<button class="btn ghost sm" onclick="cycleTask('${t.id}')">⏭</button>`:''}
      <button class="btn ghost sm" onclick="addSub('${t.id}')">☑+</button>
      <button class="btn ghost sm" onclick="delTask('${t.id}')">✕</button>
    </div></div>`;
  }).join('')||'<div class="card">لا مهام هنا — أضف مهمة جديدة 🎯</div>';
  enableDrag();
}
document.querySelectorAll('#taskTabs .tab').forEach(t=>t.onclick=()=>{taskFilter=t.dataset.f;renderTasks();});
window.toggleTask=id=>{const t=DB.tasks.find(x=>x.id===id);t.status=t.status==='مكتملة'?'جديدة':'مكتملة';save();renderTasks();renderDashboard();};
window.cycleTask=id=>{const t=DB.tasks.find(x=>x.id===id);const order=['جديدة','قيد التنفيذ','مكتملة','مؤجلة'];t.status=order[(order.indexOf(t.status)+1)%order.length];save();renderTasks();renderDashboard();};
window.delTask=id=>{DB.tasks=DB.tasks.filter(x=>x.id!==id);save();renderTasks();renderDashboard();};
window.addSub=id=>{const v=prompt('نص البند:');if(!v)return;const t=DB.tasks.find(x=>x.id===id);t.checklist=t.checklist||[];t.checklist.push({text:v,done:false});save();renderTasks();};
window.toggleSub=(id,i)=>{const t=DB.tasks.find(x=>x.id===id);t.checklist[i].done=!t.checklist[i].done;save();renderTasks();};
function enableDrag(){
  let drag=null;
  document.querySelectorAll('#taskList .item').forEach(el=>{
    el.ondragstart=()=>drag=el;el.ondragover=e=>e.preventDefault();
    el.ondrop=e=>{e.preventDefault();if(!drag||drag===el)return;
      const ids=[...document.querySelectorAll('#taskList .item')].map(x=>x.dataset.tid);
      const from=ids.indexOf(drag.dataset.tid),to=ids.indexOf(el.dataset.tid);
      const all=DB.tasks;const get=id=>all.findIndex(t=>t.id===id);
      const [mv]=all.splice(get(drag.dataset.tid),1);all.splice(get(el.dataset.tid),0,mv);
      save();renderTasks();};
  });
}
$('#addTask').onclick=()=>{
  const title=$('#tTitle').value.trim();if(!title)return toast('اكتب اسم المهمة');
  DB.tasks.push({id:uid(),title,desc:$('#tDesc').value.trim(),date:$('#tDate').value||todayKey(),time:$('#tTime').value||'',priority:$('#tPriority').value,category:$('#tCat').value,projectId:$('#tProject').value||'',repeat:$('#tRepeat').value,duration:+$('#tDur').value||30,status:'جديدة',checklist:[]});
  $('#tTitle').value='';$('#tDesc').value='';save();renderTasks();renderDashboard();toast('أُضيفت المهمة ✅');
};
$('#clearDoneTasks').onclick=()=>{DB.tasks=DB.tasks.filter(t=>t.status!=='مكتملة');save();renderTasks();renderDashboard();};

/* ================= PROJECTS ================= */
function projectProgress(p){
  if((p.phases||[]).length){const d=p.phases.filter(f=>f.done).length;return Math.round(d/p.phases.length*100);}
  const ts=DB.tasks.filter(t=>t.projectId===p.id);
  if(!ts.length)return 0;return Math.round(ts.filter(t=>t.status==='مكتملة').length/ts.length*100);
}
function renderProjects(){
  $('#projectList').innerHTML=DB.projects.map(p=>{
    const pct=projectProgress(p);const ts=DB.tasks.filter(t=>t.projectId===p.id);
    return `<div class="card"><div class="card-head"><h3>${p.name}</h3><span class="badge">${p.priority||''}</span></div>
    <div class="stat-sub">${p.desc||''}</div>
    <div class="stat-sub">${p.start||''} → ${p.end||''} • ${ts.filter(t=>t.status==='مكتملة').length}/${ts.length} مهام</div>
    <div class="big-num">${pct}<small>%</small></div><div class="bar"><div style="width:${pct}%"></div></div>
    <div class="list" style="margin-top:8px">${(p.phases||[]).map((f,i)=>`<div class="chk" onclick="togglePhase('${p.id}',${i})"><span>${f.done?'✓':'○'} ${f.name}</span></div>`).join('')}</div>
    <div class="row"><button class="btn ghost sm" onclick="delProject('${p.id}')">حذف</button><button class="btn ghost sm" onclick="go('tasks')">مهام المشروع (${ts.length})</button></div></div>`;
  }).join('')||'<div class="card">لا مشاريع بعد — أنشئ مشروعك الأول 🚀</div>';
}
window.togglePhase=(id,i)=>{const p=DB.projects.find(x=>x.id===id);p.phases[i].done=!p.phases[i].done;save();renderProjects();renderDashboard();};
window.delProject=id=>{if(!confirm('حذف المشروع؟'))return;DB.projects=DB.projects.filter(p=>p.id!==id);save();renderProjects();renderDashboard();};
$('#addProject').onclick=()=>{
  const name=$('#pName').value.trim();if(!name)return toast('اكتب اسم المشروع');
  const phases=$('#pPhases').value.split(/،|,/).map(s=>s.trim()).filter(Boolean).map(n=>({name:n,done:false}));
  DB.projects.push({id:uid(),name,desc:$('#pDesc').value.trim(),start:$('#pStart').value,end:$('#pEnd').value,priority:$('#pPriority').value,phases});
  $('#pName').value='';$('#pDesc').value='';$('#pPhases').value='';save();renderProjects();renderDashboard();toast('أُنشئ المشروع 🚀');
};

/* ================= IDEAS ================= */
function renderIdeas(){
  $('#ideaList').innerHTML=DB.ideas.slice().reverse().map(i=>`<div class="card"><div class="card-head"><b>${i.title}</b><span class="badge">${i.status}</span></div>
  <div class="stat-sub">${i.desc||''}</div><div class="stat-sub">${i.date} • ${i.cat} • ${i.imp}</div>
  <div class="row"><button class="btn ghost sm" onclick="ideaTo('task','${i.id}')">→ مهمة</button><button class="btn ghost sm" onclick="ideaTo('project','${i.id}')">→ مشروع</button><button class="btn ghost sm" onclick="delIdea('${i.id}')">✕</button></div></div>`).join('')||'<div class="card">بنك الأفكار فارغ — سجّل أول فكرة 💡</div>';
}
$('#addIdea').onclick=()=>{
  const t=$('#iTitle').value.trim();if(!t)return toast('اكتب عنوان الفكرة');
  DB.ideas.push({id:uid(),title:t,desc:$('#iDesc').value.trim(),date:todayKey(),cat:$('#iCat').value,imp:$('#iImp').value,status:$('#iStatus').value});
  $('#iTitle').value='';$('#iDesc').value='';save();renderIdeas();toast('حُفظت الفكرة 💡');
};
window.delIdea=id=>{DB.ideas=DB.ideas.filter(x=>x.id!==id);save();renderIdeas();};
window.ideaTo=(kind,id)=>{
  const i=DB.ideas.find(x=>x.id===id);if(!i)return;
  if(kind==='task'){DB.tasks.push({id:uid(),title:i.title,desc:i.desc,date:todayKey(),time:'',priority:'مهمة',category:i.cat,projectId:'',repeat:'',duration:30,status:'جديدة',checklist:[]});toast('تحولت إلى مهمة ✅');}
  else{DB.projects.push({id:uid(),name:i.title,desc:i.desc,start:todayKey(),end:'',priority:'🟠 مهمة',phases:[{name:'التخطيط',done:false},{name:'التنفيذ',done:false},{name:'التقييم',done:false}]});toast('تحولت إلى مشروع 🚀');}
  i.status='✅ تم تنفيذها';save();renderIdeas();renderDashboard();
};

/* ================= DAILY ================= */
const IBADA_ITEMS=[['صلوات اليوم','prayer'],['ورد القرآن','quran'],['أذكار الصباح/المساء','adhkar'],['جلسة مسبحة','tasbih']];
const PERSONAL_ITEMS=['👨‍👩‍👧 الأسرة','🏃 الرياضة','📚 القراءة (20 صفحة)','😴 النوم المبكر','💧 شرب الماء','🤝 صلة الرحم'];
function dailyRec(){const k=todayKey();DB.daily[k]=DB.daily[k]||{ibada:{},work:[],meetings:'',personal:{},review:{}};return DB.daily[k];}
function renderDaily(){
  const d=dailyRec();
  $('#dailyIbada').innerHTML=IBADA_ITEMS.map(([n,k])=>`<label class="chk"><input type="checkbox" ${d.ibada[k]?'checked':''} onchange="setDaily('ibada','${k}',this.checked)"> ${n}</label>`).join('');
  const k=todayKey();
  const top=DB.tasks.filter(t=>(!t.date||t.date===k)&&t.status!=='مكتملة').slice(0,3);
  $('#dailyWork').innerHTML=top.map(t=>`<div class="chk"><input type="checkbox" onchange="toggleTask('${t.id}');renderDaily()"> ${t.title}</div>`).join('')||'<div class="stat-sub">لا مهام متبقية اليوم 🎉</div>';
  $('#dailyMeetings').value=d.meetings||'';
  $('#dailyPersonal').innerHTML=PERSONAL_ITEMS.map((n,i)=>`<label class="chk"><input type="checkbox" ${d.personal[i]?'checked':''} onchange="setDaily('personal',${i},this.checked)"> ${n}</label>`).join('');
  ['r1','r2','r3','r4','r5'].forEach((id,i)=>{const f=$('#'+id);if(f)f.value=(d.review||{})['f'+i]||'';});
}
window.setDaily=(sec,k,v)=>{const d=dailyRec();d[sec][k]=v;save();};
$('#dailyMeetings').addEventListener('change',e=>{dailyRec().meetings=e.target.value;save();});
$('#saveReview').onclick=()=>{
  const d=dailyRec();d.review={};['r1','r2','r3','r4','r5'].forEach((id,i)=>d.review['f'+i]=$('#'+id).value);
  d.meetings=$('#dailyMeetings').value;save();toast('حُفظت مراجعة اليوم 🌙');
};
$('#saveQuickNote').onclick=()=>{const v=$('#quickNote').value.trim();if(!v)return toast('اكتب جملة أولًا');const d=dailyRec();d.review=d.review||{};d.review.f0=((d.review.f0||'')+' • '+v).slice(0,500);$('#quickNote').value='';save();toast('حُفظ في مراجعة اليوم ✅');};

/* ================= HABITS ================= */
function habitStreak(h){
  let s=0;let d=new Date();
  if(!h.log[todayKey()])d.setDate(d.getDate()-1);
  while(h.log[todayKey(d)]){s++;d.setDate(d.getDate()-1);}
  return s;
}
function renderHabits(){
  $('#habitList').innerHTML=DB.habits.map(h=>{
    const st=habitStreak(h);const k=todayKey();
    const last30=[...Array(30)].map((_,i)=>addDays(k,-29+i));
    const monthCount=last30.filter(d=>h.log[d]).length;
    return `<div class="card"><div class="card-head"><b>${h.icon} ${h.name}</b><span class="streak">🔥 ${st} ${st===1?'يوم':st===2?'يومان':'أيام'}</span></div>
    <label class="chk"><input type="checkbox" ${h.log[k]?'checked':''} onchange="toggleHabit('${h.id}')"> تم اليوم ${k}</label>
    <div class="habit-dots">${last30.map(d=>`<i class="${h.log[d]?'on':''}" title="${d}">${h.log[d]?'✓':''}</i>`).join('')}</div>
    <div class="stat-sub">آخر 30 يومًا: ${monthCount} / 30 (${Math.round(monthCount/30*100)}%)</div>
    <div class="row"><button class="btn ghost sm" onclick="delHabit('${h.id}')">حذف</button></div></div>`;
  }).join('')||'<div class="card">لا عادات بعد — ابدأ بعادة صغيرة 🔥</div>';
}
window.toggleHabit=id=>{const h=DB.habits.find(x=>x.id===id);const k=todayKey();h.log[k]=!h.log[k];save();renderHabits();renderDashboard();};
window.delHabit=id=>{DB.habits=DB.habits.filter(x=>x.id!==id);save();renderHabits();};
$('#addHabit').onclick=()=>{const n=$('#hName').value.trim();if(!n)return toast('اكتب اسم العادة');DB.habits.push({id:uid(),name:n,icon:$('#hIcon').value||'⭐',log:{}});$('#hName').value='';save();renderHabits();toast('أُضيفت العادة 🔥');};
$('#seedHabits').onclick=()=>{
  const seeds=[['صلاة الجماعة','🕌'],['قراءة القرآن','📖'],['أذكار الصباح','🌅'],['أذكار المساء','🌇'],['الرياضة','🏃'],['القراءة','📚'],['النوم المبكر','😴'],['شرب الماء','💧'],['صلة الرحم','🤝']];
  seeds.forEach(([n,ic])=>{if(!DB.habits.some(h=>h.name===n))DB.habits.push({id:uid(),name:n,icon:ic,log:{}});});
  save();renderHabits();toast('أُضيفت العادات المقترحة ✅');
};

/* ================= DASHBOARD ================= */
function dayCompletion(){
  const k=todayKey();
  const ts=DB.tasks.filter(t=>!t.date||t.date===k);
  const tPct=ts.length?ts.filter(t=>t.status==='مكتملة').length/ts.length:1;
  const pr=DB.prayers[k]||{};const pPct=PRAYER_KEYS.filter(p=>pr[p]==='done'||pr[p]==='late').length/5;
  const qd=quranTodayPages();const qPct=Math.min(1,qd/(DB.quran.target||10));
  const ad=DB.adhkarDone[k]||{};const allA=allAdhkar();const at=allA.reduce((s,d)=>s+d.n,0),ac=allA.reduce((s,d)=>s+Math.min(ad[d.id]||0,d.n),0);
  const aPct=at?ac/at:1;
  const pct=Math.round((tPct*.4+pPct*.3+qPct*.15+aPct*.15)*100);
  return {pct,ts,done:ts.filter(t=>t.status==='مكتملة').length};
}
function renderDashboard(){
  const {pct,ts,done}=dayCompletion();
  $('#ringFg').style.strokeDashoffset=326.7-326.7*pct/100;
  $('#ringTxt').textContent=pct+'%';
  $('#doneCount').textContent=done;$('#leftCount').textContent=ts.length-done;
  $('#sideProgressFill').style.width=pct+'%';$('#sideProgressVal').textContent=pct+'%';
  const k=todayKey();
  const top=DB.tasks.filter(t=>(!t.date||t.date===k)).slice(0,5);
  const pr={عاجلة:'🔴',مهمة:'🟠',عادية:'🟢'};
  $('#topTasks').innerHTML=top.slice(0,3).map(t=>`<div class="item ${t.status==='مكتملة'?'done':''}"><input type="checkbox" class="task-check" ${t.status==='مكتملة'?'checked':''} onchange="toggleTask('${t.id}');renderDashboard()"><div class="grow"><b>${t.title}</b><small>${pr[t.priority]||''} ${t.status}</small></div></div>`).join('')||'<div class="stat-sub">لا مهام اليوم — استمتع أو أضف مهمة 🎯</div>';
  $('#dashProjects').innerHTML=DB.projects.slice(0,3).map(p=>{const pc=projectProgress(p);return `<div class="item"><div class="grow"><b>${p.name}</b><div class="bar"><div style="width:${pc}%"></div></div><small>${pc}%</small></div></div>`;}).join('')||'<div class="stat-sub">لا مشاريع نشطة.</div>';
  const ad=DB.adhkarDone[k]||{};const items=allAdhkar().slice(0,4);
  $('#dashAdhkar').innerHTML=items.map(d=>{const c=Math.min(ad[d.id]||0,d.n);return `<div class="item"><div class="grow"><b style="font-size:13px">${d.t.slice(0,60)}...</b><div class="bar"><div style="width:${c/d.n*100}%"></div></div><small>${c}/${d.n}</small></div></div>`;}).join('');
  $('#dashQuranDone').textContent=quranTodayPages();$('#dashQuranTarget').textContent=DB.quran.target;
  $('#dashQuranBar').style.width=Math.min(100,quranTodayPages()/DB.quran.target*100)+'%';
  // week dots: completion per day
  let html='';
  for(let i=6;i>=0;i--){const dk=addDays(k,-i);const tsk=DB.tasks.filter(t=>t.date===dk);const dn=tsk.filter(t=>t.status==='مكتملة').length;
    const ok=tsk.length>0&&dn===tsk.length;const wd=new Date(dk+'T12:00:00').toLocaleDateString('ar',{weekday:'short'});
    html+=`<span class="${ok?'on':''}" title="${dk}: ${dn}/${tsk.length}">${ok?'✓':wd}</span>`;}
  $('#weekDots').innerHTML=html;
  const hk=DB.habits.filter(h=>habitStreak(h)>0).length;
  $('#weekStreakTxt').textContent=`${hk} عادات مستمرة • ${DB.tasbih.log.filter(l=>l.date===k).reduce((s,l)=>s+l.count,0)} تسبيحة اليوم`;
}

/* ================= REPORTS ================= */
let reportRange='day';
document.querySelectorAll('#reportTabs .tab').forEach(b=>b.onclick=()=>{reportRange=b.dataset.r;document.querySelectorAll('#reportTabs .tab').forEach(x=>x.classList.toggle('active',x===b));renderReports();});
function rangeKeys(){
  const k=todayKey();
  if(reportRange==='day')return [k];
  if(reportRange==='week')return [...Array(7)].map((_,i)=>addDays(k,-6+i));
  return [...Array(30)].map((_,i)=>addDays(k,-29+i));
}
function renderReports(){
  const keys=rangeKeys();
  const titles={day:'التقرير اليومي',week:'التقرير الأسبوعي',month:'التقرير الشهري'};
  $('#reportTitle').textContent=titles[reportRange]+` (${keys.length} ${keys.length===1?'يوم':reportRange==='week'?'أيام':'يومًا'})`;
  const ts=DB.tasks.filter(t=>keys.includes(t.date));
  const tDone=ts.filter(t=>t.status==='مكتملة').length;
  const tPct=ts.length?Math.round(tDone/ts.length*100):0;
  let pT=0,pD=0;keys.forEach(k=>{const r=DB.prayers[k]||{};pT+=5;pD+=PRAYER_KEYS.filter(p=>r[p]==='done'||r[p]==='late').length;});
  const pPct=pT?Math.round(pD/pT*100):0;
  const qPages=DB.quran.log.filter(l=>keys.includes(l.date)).reduce((s,l)=>s+(+l.pages||0),0);
  const qPct=Math.min(100,Math.round(qPages/((DB.quran.target||10)*keys.length)*100));
  const allA=allAdhkar();const at=allA.reduce((s,d)=>s+d.n,0)*keys.length;
  let ac=0;keys.forEach(k=>{const d=DB.adhkarDone[k]||{};ac+=allA.reduce((s,x)=>s+Math.min(d[x.id]||0,x.n),0);});
  const aPct=at?Math.round(ac/at*100):0;
  let hT=DB.habits.length*keys.length,hD=0;DB.habits.forEach(h=>keys.forEach(k=>{if(h.log[k])hD++;}));
  const hPct=hT?Math.round(hD/hT*100):0;
  const projAvg=DB.projects.length?Math.round(DB.projects.reduce((s,p)=>s+projectProgress(p),0)/DB.projects.length):0;
  const total=Math.round((tPct+pPct+qPct+aPct+hPct+projAvg)/6);
  const row=(n,v)=>`<div class="item"><div class="grow"><b>${n}</b><div class="bar"><div style="width:${v}%"></div></div></div><b>${v}%</b></div>`;
  $('#reportBody').innerHTML=`<div class="big-num">إنتاجيتي: ${total}<small>%</small></div>
    <div class="stat-sub">المهام: ${tDone}/${ts.length} • الصلوات: ${pD}/${pT} • صفحات القرآن: ${qPages} • العادات: ${hD}/${hT}</div>
    <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">${row('🕌 الصلاة',pPct)}${row('📖 القرآن',qPct)}${row('🌿 الأذكار',aPct)}${row('✅ المهام',tPct)}${row('🔥 العادات',hPct)}${row('🚀 المشاريع',projAvg)}</div>`;
  // monthly chart: last 30 days completion
  const last30=[...Array(30)].map((_,i)=>addDays(todayKey(),-29+i));
  $('#monthChart').innerHTML=last30.map(d=>{
    const tsk=DB.tasks.filter(t=>t.date===d);const v=tsk.length?Math.round(tsk.filter(t=>t.status==='مكتملة').length/tsk.length*100):0;
    return `<div class="col" style="height:${Math.max(6,v)}%" title="${d}: ${v}%"><span>${v}</span></div>`;
  }).join('');
}

/* ================= CALENDAR ================= */
let calCursor=new Date();let calSel=todayKey();
function renderCalendar(){
  const y=calCursor.getFullYear(),m=calCursor.getMonth();
  $('#calTitle').textContent=new Intl.DateTimeFormat('ar',{month:'long',year:'numeric'}).format(calCursor);
  const first=new Date(y,m,1);let start=first.getDay(); // 0 Sun
  // Arabic week starts Saturday? keep Sunday start simple with Arabic names
  const dows=['أحد','إثنين','ثلا','أرب','خمي','جمع','سبت'];
  let html=dows.map(d=>`<div class="cal-dow">${d}</div>`).join('');
  const dim=new Date(y,m+1,0).getDate();
  for(let i=0;i<start;i++)html+=`<div class="cal-day other"></div>`;
  for(let d=1;d<=dim;d++){
    const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const n=DB.tasks.filter(t=>t.date===key).length;
    const isT=key===todayKey(),sel=key===calSel;
    html+=`<div class="cal-day ${isT?'today':''} ${sel?'sel':''}" data-day="${key}"><span class="n">${d}</span>${n?`<span class="ev">✅ ${n} مهام</span>`:''}${DB.quran.log.some(l=>l.date===key)?'<span class="ev" style="background:#7c3aed">📖 ورد</span>':''}</div>`;
  }
  $('#calGrid').innerHTML=html;
  document.querySelectorAll('[data-day]').forEach(el=>el.onclick=()=>{calSel=el.dataset.day;renderCalendar();});
  $('#calSelDate').textContent=calSel;
  const ts=DB.tasks.filter(t=>t.date===calSel);
  $('#calDetail').innerHTML=ts.map(t=>`<div class="item ${t.status==='مكتملة'?'done':''}"><div class="grow"><b>${t.title}</b><small>${t.time||''} • ${t.status}</small></div></div>`).join('')||'<div class="stat-sub">لا مهام في هذا اليوم.</div>';
}
$('#calPrev').onclick=()=>{calCursor.setMonth(calCursor.getMonth()-1);renderCalendar();};
$('#calNext').onclick=()=>{calCursor.setMonth(calCursor.getMonth()+1);renderCalendar();};

/* ================= NOTIFICATIONS ================= */
function pushNotif(text){DB.notifs.unshift({id:uid(),text,time:new Date().toLocaleString('ar'),read:false});DB.notifs=DB.notifs.slice(0,50);save();renderNotifs();}
function renderNotifs(){
  const box=$('#notifBox');
  if(box)box.innerHTML=DB.notifs.map(n=>`<div class="item"><span>🔔</span><div class="grow"><b style="font-size:13.5px">${n.text}</b><small>${n.time}</small></div></div>`).join('')||'<div class="stat-sub">لا تنبيهات بعد.</div>';
  const un=DB.notifs.filter(n=>!n.read).length;
  $('#bellDot').hidden=!un;
  const cfg=DB.notifCfg;['nPrayer','nAdhkar','nTasks','nHabits'].forEach((id,i)=>{const k=['prayer','adhkar','tasks','habits'][i];const el=document.getElementById(id);if(el)el.checked=!!cfg[k];});
}
$('#saveNotif').onclick=()=>{DB.notifCfg={prayer:$('#nPrayer').checked,adhkar:$('#nAdhkar').checked,tasks:$('#nTasks').checked,habits:$('#nHabits').checked};save();toast('حُفظت إعدادات التنبيهات 🔔');};
$('#clearNotif').onclick=()=>{DB.notifs=[];save();renderNotifs();};
$('#enableBrowserNotif').onclick=async()=>{try{const p=await Notification.requestPermission();toast(p==='granted'?'تم تفعيل الإشعارات ✅':'لم تُفعّل الإشعارات');}catch{toast('غير مدعوم');}};
$('#testNotif').onclick=()=>{pushNotif('تجربة تنبيه 🔔 — النظام يعمل بنجاح');toast('وصل تنبيه جديد 🔔');if(Notification.permission==='granted')new Notification('مركز قيادتي',{body:'تجربة تنبيه 🔔'});};
let lastCheck='';
setInterval(()=>{
  const now=new Date();const hhmm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  if(hhmm===lastCheck)return;lastCheck=hhmm;
  const c=DB.notifCfg;
  // prayer reminder
  if(c.prayer&&prayerTimings){for(const k of PRAYER_KEYS){const t=new Date(prayerTimings[k]);t.setMinutes(t.getMinutes()-(DB.settings.remind||10));const th=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');if(th===hhmm){pushNotif(`🕌 تذكير: صلاة ${PRAYER_NAMES[k]} بعد ${DB.settings.remind||10} دقائق`);toast(`🕌 اقتربت صلاة ${PRAYER_NAMES[k]}`);if(Notification.permission==='granted')new Notification(`صلاة ${PRAYER_NAMES[k]}`,{body:'حان وقت الاستعداد للصلاة 🕌'});}}}
  if(c.adhkar&&(hhmm==='06:00')){pushNotif('🌅 وقت أذكار الصباح');toast('🌅 وقت أذكار الصباح');}
  if(c.adhkar&&(hhmm==='17:00')){pushNotif('🌇 وقت أذكار المساء');toast('🌇 وقت أذكار المساء');}
  if(c.tasks&&(hhmm==='09:00')){const t=DB.tasks.filter(x=>(!x.date||x.date===todayKey())&&x.status!=='مكتملة').length;if(t){pushNotif(`📋 لديك ${t} مهام اليوم`);toast(`📋 لديك ${t} مهام اليوم`);}}
  if(c.habits&&(hhmm==='22:00')){pushNotif('🔥 تذكير: سجّل عادات اليوم قبل النوم');toast('🔥 سجّل عادات اليوم');}
},20000);

/* ---------- export/import ---------- */
$('#exportBtn').onclick=()=>{
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='backup-'+todayKey()+'.json';a.click();
};
$('#importFile').onchange=e=>{
  const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{DB={...defaultDB(),...JSON.parse(r.result)};save();boot();toast('تم الاستيراد ✅');}catch{toast('ملف غير صالح');}};
  r.readAsText(f);
};
// task date default
$('#tDate').value=todayKey();$('#pStart').value=todayKey();

/* ---------- boot ---------- */
function boot(){
  renderDates();initPrayerSettings();renderAdhkarTabs();renderAdhkarList();
  renderTasbih();renderQuran();renderTasks();renderProjects();renderIdeas();
  renderDaily();renderHabits();renderDashboard();renderCalendar();renderNotifs();
  fetchPrayer();
}
boot();
setInterval(renderDates,60000);
