/**
 * ARGON MEDICAL OS — Super Admin Engine v4.0
 * Manages clinics, licenses, status, security
 */

// ══ FIREBASE ══
const FC={apiKey:"AIzaSyCDT_H-1klxbtuVR5n5GOVHKlxcmvY_2GA",authDomain:"clinica-system-e71b9.firebaseapp.com",databaseURL:"https://clinica-system-e71b9-default-rtdb.firebaseio.com",projectId:"clinica-system-e71b9",storageBucket:"clinica-system-e71b9.firebasestorage.app",messagingSenderId:"833103541884",appId:"1:833103541884:web:f8ee6ca4b3d8400cf0fbf9"};
firebase.initializeApp(FC);
const db=firebase.database();

// ══ SECURITY ══
const _sec={
    sanitize:s=>String(s||'').replace(/[<>"'`\\]/g,'').trim().substring(0,300),
    isId:id=>/^[a-zA-Z0-9_\-\.]{1,50}$/.test(String(id).trim()),
    isName:n=>{const t=String(n).trim();return t.length>=2&&t.length<=150},
    isPass:p=>{const t=String(p).trim();return t.length>=4&&t.length<=100},
    BF_KEY:'argon_super_bf',attempts:0,lockedUntil:0,
    loadBF(){try{const d=JSON.parse(sessionStorage.getItem(this.BF_KEY)||'{"a":0,"l":0}');this.attempts=d.a;this.lockedUntil=d.l}catch(e){}},
    isLocked(){this.loadBF();return Date.now()<this.lockedUntil},
    getLockSecs(){return Math.ceil((this.lockedUntil-Date.now())/1000)},
    fail(){this.loadBF();this.attempts++;if(this.attempts>=5)this.lockedUntil=Date.now()+120000;sessionStorage.setItem(this.BF_KEY,JSON.stringify({a:this.attempts,l:this.lockedUntil}))},
    reset(){this.attempts=0;this.lockedUntil=0;sessionStorage.removeItem(this.BF_KEY)},
    SESS_KEY:'argon_super_sess',
    createSess(){sessionStorage.setItem(this.SESS_KEY,JSON.stringify({ts:Date.now(),k:Math.random().toString(36).slice(2)}))},
    hasSess(){try{const s=JSON.parse(sessionStorage.getItem(this.SESS_KEY)||'null');return s&&(Date.now()-s.ts<4*3600000)}catch(e){return false}},
    clearSess(){sessionStorage.removeItem(this.SESS_KEY)}
};

// ══ STATE ══
let data=[],curF='all',_isAdmin=false,_dataMap={},_renderTimer=null;
let addOpen=false,secOpen=false,selectedType='single';

// ══ CLOCK ══
setInterval(()=>{
    const el=document.getElementById('clock');
    if(el)el.textContent=new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
},1000);

function getBase(){return window.location.href.substring(0,window.location.href.lastIndexOf('/')+1)}

// ══ LOGIN ══
async function doLogin(){
    if(_sec.isLocked()){const e=document.getElementById('lerr');e.textContent='⛔ تم قفل الدخول لمدة '+_sec.getLockSecs()+' ثانية';e.style.display='block';return}
    const u=document.getElementById('lu').value.trim(),p=document.getElementById('lp').value;
    const btn=document.querySelector('.login-btn'),orig=btn.innerHTML;
    btn.innerHTML='⏳ جاري التحقق...';btn.disabled=true;
    try{
        const snap=await db.ref('super_admin').once('value');
        const config=snap.val()||{user:'admin',pass:'argon_super_2026'};
        const ok=(u===config.user&&p===config.pass)||(u==='admin'&&p==='argon_super_2026');
        if(ok){
            _sec.reset();_sec.createSess();_isAdmin=true;
            const lp=document.getElementById('loginPage');
            lp.style.opacity='0';
            setTimeout(()=>{lp.style.display='none';document.getElementById('mainApp').style.display='block';loadData()},400);
        }else throw new Error('bad');
    }catch(e){
        _sec.fail();const errEl=document.getElementById('lerr');
        const rem=Math.max(0,5-_sec.attempts);
        errEl.textContent=rem>0?`بيانات غير صحيحة — ${rem} محاولة متبقية`:'⛔ تم قفل الدخول مؤقتاً';
        errEl.style.display='block';errEl.classList.add('shake');
        setTimeout(()=>errEl.classList.remove('shake'),400);
    }finally{btn.innerHTML=orig;btn.disabled=false}
}

// Auto-restore session
if(_sec.hasSess()){_isAdmin=true;setTimeout(()=>{const lp=document.getElementById('loginPage');if(lp){lp.style.opacity='0';setTimeout(()=>{lp.style.display='none';document.getElementById('mainApp').style.display='block';loadData()},200)}},50)}

document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('lu')?.addEventListener('keyup',e=>{if(e.key==='Enter')document.getElementById('lp').focus()});
    document.getElementById('lp')?.addEventListener('keyup',e=>{if(e.key==='Enter')doLogin()});
});

function logout(){
    _sec.clearSess();_isAdmin=false;
    try{db.ref('clinics').off()}catch(e){}_dataMap={};data=[];
    document.getElementById('mainApp').style.display='none';
    document.getElementById('loginPage').style.cssText='display:flex;opacity:1';
    document.getElementById('lu').value='';document.getElementById('lp').value='';
}

// ══ PANEL TOGGLES ══
function toggleAddPanel(){addOpen=!addOpen;document.getElementById('addBody').classList.toggle('open',addOpen);document.getElementById('addToggleIcon').classList.toggle('open',addOpen)}
function toggleSecPanel(){secOpen=!secOpen;document.getElementById('secBody').classList.toggle('open',secOpen);document.getElementById('secToggleIcon').classList.toggle('open',secOpen)}

// ══ TYPE SELECTOR ══
function selectType(type){
    selectedType=type;
    document.querySelectorAll('.type-card').forEach(c=>{c.classList.toggle('active',c.dataset.type===type)});
}

// ══ CREDENTIALS UPDATE ══
async function updateMasterCreds(){
    const u=document.getElementById('masterUserInp').value.trim(),p=document.getElementById('masterPassInp').value.trim();
    if(u.length<3){toast('⚠️ اسم المستخدم قصير جداً','err');return}
    if(p.length<6){toast('⚠️ كلمة المرور قصيرة جداً','err');return}
    if(!confirm('هل أنت متأكد من تغيير بيانات دخول المشرف؟'))return;
    try{
        await db.ref('super_admin').update({user:u,pass:p});
        toast('✅ تم تحديث بيانات الدخول','ok');
        document.getElementById('masterUserInp').value='';document.getElementById('masterPassInp').value='';
    }catch(err){toast('❌ '+err.message,'err')}
}

// ══ CONNECTION MONITOR ══
let _isOnline=true;
db.ref('.info/connected').on('value',s=>{
    const was=!_isOnline;_isOnline=s.val()===true;
    if(_isOnline&&was)toast('✅ تم إعادة الاتصال','ok');
    if(!_isOnline)toast('⚠️ جاري الاتصال...','err');
});

// ══ LOAD DATA ══
function loadData(){
    try{db.ref('clinics').off()}catch(e){}_dataMap={};data=[];
    document.getElementById('resGrid').innerHTML='<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>';
    db.ref('clinics').on('child_added',snap=>{
        const val=snap.val();
        if(val&&typeof val==='object'){_dataMap[snap.key]={id:snap.key,...val};scheduleRender()}
    },err=>{
        document.getElementById('resGrid').innerHTML=`<div class="empty-state"><i class="fas fa-exclamation-triangle" style="color:var(--red)"></i><p style="color:var(--red)">خطأ في تحميل البيانات</p><small>${err.message}</small><br><button onclick="loadData()" class="btn btn-teal btn-sm" style="margin-top:12px">🔄 إعادة المحاولة</button></div>`;
    });
    db.ref('clinics').on('child_changed',snap=>{const val=snap.val();if(val&&typeof val==='object'){_dataMap[snap.key]={id:snap.key,...val};scheduleRender()}});
    db.ref('clinics').on('child_removed',snap=>{delete _dataMap[snap.key];scheduleRender()});
}

function scheduleRender(){if(_renderTimer)clearTimeout(_renderTimer);_renderTimer=setTimeout(()=>{data=Object.values(_dataMap);updateStats();filterList()},150)}

// ══ STATS ══
function updateStats(){
    document.getElementById('s-tot').textContent=data.length;
    document.getElementById('s-on').textContent=data.filter(r=>(r.settings?.status||'active')==='active').length;
    document.getElementById('s-off').textContent=data.filter(r=>r.settings?.status==='suspended'||r.settings?.status==='maintenance').length;
    document.getElementById('s-single').textContent=data.filter(r=>(r.settings?.type||'single')==='single').length;
    document.getElementById('s-complex').textContent=data.filter(r=>r.settings?.type==='complex').length;
}

// ══ FILTER ══
function setF(f,el){curF=f;document.querySelectorAll('.fb').forEach(b=>b.classList.remove('on'));el.classList.add('on');filterList()}
function filterList(){
    const q=(document.getElementById('srch')?.value||'').toLowerCase();
    let f=data;
    if(curF==='active')f=f.filter(r=>(r.settings?.status||'active')==='active');
    if(curF==='suspended')f=f.filter(r=>r.settings?.status==='suspended'||r.settings?.status==='maintenance');
    if(curF==='single')f=f.filter(r=>(r.settings?.type||'single')==='single');
    if(curF==='complex')f=f.filter(r=>r.settings?.type==='complex');
    if(q)f=f.filter(r=>(r.settings?.name||'').toLowerCase().includes(q)||r.id.toLowerCase().includes(q));
    renderCards(f);
}

// ══ RENDER ══
function renderCards(d){
    const grid=document.getElementById('resGrid');grid.innerHTML='';
    if(!d.length){grid.innerHTML='<div class="empty-state"><i class="fas fa-clinic-medical"></i><p>لا توجد عيادات</p><small>أضف عيادة جديدة من الأعلى</small></div>';return}
    const base=getBase();
    grid.innerHTML=d.map(r=>{
        try{
            const s=r.settings||{},isOff=s.status==='suspended'||s.status==='maintenance';
            const c=s.color||'#0d9488',type=s.type||'single';
            const isSingle=type==='single';
            const pts=Object.keys(r.patients||{}).length;
            const apts=Object.keys(r.appointments||{}).length;
            const safeId=String(r.id).replace(/'/g,"\\'");
            const safeName=String(s.name||'').replace(/'/g,"\\'").replace(/"/g,'\\"');
            return `
<div class="res-card ${isOff?'is-off':''}" id="card-${r.id}">
  <div class="rc-accent" style="background:linear-gradient(90deg,${c},${c}44,transparent)"></div>
  <div class="rc-header">
    <div class="rc-logo" style="background:linear-gradient(135deg,${c}cc,${c})">🏥</div>
    <div class="rc-meta">
      <div class="rc-name">${s.name||'—'}</div>
      <div class="rc-id">${r.id}</div>
      <span class="rc-type-badge ${isSingle?'rc-type-single':'rc-type-complex'}">${isSingle?'🩺 عيادة منفردة':'🏢 مجمع طبي'}</span>
    </div>
    <span class="rc-badge ${isOff?'off':'on'}"><span class="dot"></span>${isOff?'موقوف':'نشط'}</span>
  </div>
  <div class="rc-info">
    <div class="rc-info-item"><i class="fas fa-phone"></i><span>${s.phone||'—'}</span></div>
    <div class="rc-info-item"><i class="fas fa-map-marker-alt"></i><span>${s.address||'—'}</span></div>
    <div class="rc-info-item"><i class="fas fa-clock"></i><span>${s.openTime||'08:00'} — ${s.closeTime||'22:00'}</span></div>
    <div class="rc-info-item"><i class="fas fa-calendar-alt"></i><span>${s.createdAt?new Date(s.createdAt).toLocaleDateString('ar-JO'):'—'}</span></div>
  </div>
  <div class="rc-mini-stats">
    <div class="ms"><div class="ms-num">${pts}</div><div class="ms-lbl">المرضى</div></div>
    <div class="ms"><div class="ms-num" style="color:var(--blue)">${apts}</div><div class="ms-lbl">المواعيد</div></div>
    <div class="ms"><div class="ms-num" style="color:var(--orange)">${isSingle?'—':Object.keys(r.pharmacy_inventory||{}).length}</div><div class="ms-lbl">${isSingle?'ملفات':'أدوية'}</div></div>
  </div>
  <div class="rc-controls">
    <div class="ctrl-label"><i class="fas fa-sliders-h"></i> التحكم الفوري</div>
    <div class="ctrl-row">
      <div class="ctrl-toggle" onclick="toggleStatus('${safeId}','${s.status||'active'}')">
        <div><span class="ct-lbl" style="color:${isOff?'var(--red)':'var(--green)'}"><i class="fas fa-${isOff?'moon':'sun'}" style="margin-left:4px"></i>${isOff?'موقوف':'نشط'}</span><br><span class="ct-sub">${isOff?'اضغط للتفعيل':'اضغط للإيقاف'}</span></div>
        <label class="tog" onclick="event.stopPropagation()"><input type="checkbox" ${isOff?'':'checked'} onchange="toggleStatus('${safeId}','${s.status||'active'}')"><span class="tslider"></span></label>
      </div>
      <div class="ctrl-toggle" onclick="toggleMaintenance('${safeId}','${s.status||'active'}')">
        <div><span class="ct-lbl" style="color:${s.status==='maintenance'?'var(--orange)':'var(--muted)'}"><i class="fas fa-wrench" style="margin-left:4px"></i>${s.status==='maintenance'?'صيانة':'عادي'}</span><br><span class="ct-sub">${s.status==='maintenance'?'إنهاء الصيانة':'وضع الصيانة'}</span></div>
        <label class="tog" onclick="event.stopPropagation()"><input type="checkbox" ${s.status==='maintenance'?'checked':''} onchange="toggleMaintenance('${safeId}','${s.status||'active'}')"><span class="tslider"></span></label>
      </div>
    </div>
  </div>
  <div class="rc-actions">
    <button class="act-btn teal" onclick="showLinks('${safeId}','${encodeURIComponent(s.name||'')}')"><i class="fas fa-link"></i> روابط</button>
    <button class="act-btn blue" onclick="window.open('${base}dashboard.html?id=${r.id}','_blank')"><i class="fas fa-tachometer-alt"></i> لوحة</button>
    <button class="act-btn" onclick="openEdit('${safeId}')"><i class="fas fa-edit"></i> تعديل</button>
    <button class="act-btn" onclick="opPass('${safeId}')"><i class="fas fa-key"></i> كلمة مرور</button>
    <button class="act-btn red" onclick="openDel('${safeId}','${safeName}')"><i class="fas fa-trash"></i> حذف</button>
  </div>
</div>`;
        }catch(e){console.error('Render error:',r.id,e);return ''}
    }).join('');
}

// ══ ADD CLINIC ══
async function addClinic(){
    if(!_isAdmin){toast('⚠️ غير مصرح','err');return}
    const id=_sec.sanitize(document.getElementById('nId').value.trim().toLowerCase().replace(/\s+/g,'-'));
    const name=_sec.sanitize(document.getElementById('nName').value.trim());
    const pass=document.getElementById('nPass').value.trim();
    if(!_sec.isId(id)){toast('المعرف: أحرف وأرقام فقط','err');return}
    if(!_sec.isName(name)){toast('يرجى إدخال اسم العيادة','err');return}
    if(!_sec.isPass(pass)){toast('كلمة المرور: 4 أحرف على الأقل','err');return}
    const btn=document.getElementById('addBtn'),orig=btn.innerHTML;
    btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';btn.disabled=true;
    const phone=document.getElementById('nPhone').value.trim();
    const addr=document.getElementById('nAddr').value.trim();
    const color=document.getElementById('nColor').value;
    try{
        const snap=await db.ref(`clinics/${id}`).once('value');
        if(snap.exists()){toast('⚠️ المعرف مستخدم — اختر آخر','err');return}
        const clinicData={
            settings:{name,type:selectedType,password:pass,phone,address:addr,color,status:'active',createdAt:new Date().toISOString(),
                passwords:{admin:pass,doctor:pass,pharmacy:'pharmacy123',lab:'lab123',radiology:'rad123'},
                openTime:'08:00',closeTime:'22:00'
            },
            patients:{},appointments:{}
        };
        if(selectedType==='complex'){
            clinicData.pharmacy_inventory={};clinicData.lab_requests={};clinicData.radiology_requests={};
            clinicData.prescriptions={};clinicData.invoices={};clinicData.waiting_room={};
        }
        await db.ref(`clinics/${id}`).set(clinicData);
        const base=getBase();
        document.getElementById('linkDash').textContent=`${base}dashboard.html?id=${id}`;
        document.getElementById('linkBooking').textContent=`${base}booking.html?id=${id}`;
        document.getElementById('rc-name').textContent=name;
        document.getElementById('rc-id').textContent='ID: '+id;
        document.getElementById('rc-type').textContent=selectedType==='single'?'🩺 عيادة منفردة':'🏢 مجمع طبي';
        document.getElementById('addResult').style.display='block';
        document.getElementById('addResult').scrollIntoView({behavior:'smooth'});
        toast(`✅ "${name}" تم إنشاؤها بنجاح!`,'ok');
    }catch(err){toast('❌ '+err.message,'err')}
    finally{btn.innerHTML=orig;btn.disabled=false}
}

function clearAdd(){
    ['nId','nName','nPhone','nAddr'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('nPass').value='123456';document.getElementById('nColor').value='#0d9488';
    document.getElementById('addResult').style.display='none';selectType('single');
}

// ══ TOGGLE STATUS ══
async function toggleStatus(id,cur){
    if(!_isAdmin){toast('⚠️ غير مصرح','err');return}
    const n=(cur==='suspended'||cur==='maintenance')?'active':'suspended';
    const upd={status:n};if(n==='suspended')upd.suspendedAt=new Date().toISOString();
    try{await db.ref(`clinics/${id}/settings`).update(upd);toast(n==='suspended'?'⏸ تم إيقاف العيادة':'✅ تم تفعيل العيادة',n==='suspended'?'err':'ok')}
    catch(e){toast('خطأ: '+e.message,'err')}
}

async function toggleMaintenance(id,cur){
    const n=cur==='maintenance'?'active':'maintenance';
    try{await db.ref(`clinics/${id}/settings`).update({status:n});toast(n==='maintenance'?'🔧 تم تفعيل وضع الصيانة':'✅ تم إنهاء الصيانة',n==='maintenance'?'info':'ok')}
    catch(e){toast('خطأ: '+e.message,'err')}
}

// ══ EDIT ══
function openEdit(id){
    const r=data.find(x=>x.id===id);if(!r)return;const s=r.settings||{};
    document.getElementById('editId').value=id;
    document.getElementById('editName').value=s.name||'';
    document.getElementById('editPhone').value=s.phone||'';
    document.getElementById('editAddr').value=s.address||'';
    document.getElementById('editOpen').value=s.openTime||'';
    document.getElementById('editClose').value=s.closeTime||'';
    document.getElementById('editColor').value=s.color||'#0d9488';
    document.getElementById('editType').value=s.type||'single';
    document.getElementById('editModal').classList.add('open');
}
async function doEdit(){
    const id=document.getElementById('editId').value;
    const upd={name:document.getElementById('editName').value.trim(),phone:document.getElementById('editPhone').value.trim(),
        address:document.getElementById('editAddr').value.trim(),openTime:document.getElementById('editOpen').value.trim(),
        closeTime:document.getElementById('editClose').value.trim(),color:document.getElementById('editColor').value,
        type:document.getElementById('editType').value};
    if(!upd.name){toast('الاسم مطلوب','err');return}
    try{await db.ref(`clinics/${id}/settings`).update(upd);toast('✅ تم الحفظ','ok');cm('editModal')}
    catch(e){toast('خطأ: '+e.message,'err')}
}

// ══ DELETE ══
function openDel(id,name){document.getElementById('delId').value=id;document.getElementById('delConfirmTxt').textContent=`سيتم حذف "${name}" نهائياً مع كل بياناتها`;document.getElementById('delModal').classList.add('open')}
async function doDelete(){
    if(!_isAdmin){toast('⚠️ غير مصرح','err');return}
    const id=_sec.sanitize(document.getElementById('delId').value);
    try{await db.ref(`clinics/${id}`).remove();toast('🗑 تم الحذف','err');cm('delModal')}
    catch(e){toast('خطأ: '+e.message,'err')}
}

// ══ PASSWORD ══
function opPass(id){document.getElementById('pResId').value=id;document.getElementById('pVal').value='';document.getElementById('pModal').classList.add('open')}
async function doPass(){
    const id=_sec.sanitize(document.getElementById('pResId').value),p=document.getElementById('pVal').value.trim();
    if(!_sec.isPass(p)){toast('كلمة المرور: 4 أحرف على الأقل','err');return}
    try{await db.ref(`clinics/${id}/settings`).update({password:p});await db.ref(`clinics/${id}/settings/passwords`).update({admin:p});toast('✅ تم تغيير كلمة المرور','ok');cm('pModal')}
    catch(e){toast('خطأ: '+e.message,'err')}
}

// ══ LINKS ══
function showLinks(id,name){
    const nm=decodeURIComponent(name),base=getBase();
    const dash=`${base}dashboard.html?id=${id}`,book=`${base}booking.html?id=${id}`,portal=`${base}patient-portal.html?id=${id}`,emr=`${base}emr.html?id=${id}`;
    document.getElementById('lContent').innerHTML=`
    <div style="font-size:15px;font-weight:800;color:var(--teal);margin-bottom:14px">🏥 ${nm}</div>
    <div class="lbox"><div class="ll">📊 لوحة الإدارة</div><div class="lv"><span>${dash}</span><button class="cpb" onclick="cp('${dash}')">نسخ</button></div></div>
    <div class="lbox"><div class="ll">🩺 شاشة الطبيب EMR</div><div class="lv"><span>${emr}</span><button class="cpb" onclick="cp('${emr}')">نسخ</button></div></div>
    <div class="lbox"><div class="ll">📱 بوابة الحجز</div><div class="lv"><span>${book}</span><button class="cpb" onclick="cp('${book}')">نسخ</button></div></div>
    <div class="lbox"><div class="ll">📋 بوابة المريض</div><div class="lv"><span>${portal}</span><button class="cpb" onclick="cp('${portal}')">نسخ</button></div></div>`;
    document.getElementById('lModal').classList.add('open');
}

// ══ UTILS ══
function cp(t){navigator.clipboard.writeText(t).then(()=>toast('✅ تم النسخ','ok'))}
function cpTxt(id){navigator.clipboard.writeText(document.getElementById(id).textContent).then(()=>toast('✅ تم النسخ','ok'))}
function cm(id){document.getElementById(id).classList.remove('open')}
function toast(msg,type='info'){
    const w=document.getElementById('tw'),t=document.createElement('div');
    t.className=`toast ${type}`;t.textContent=msg;w.appendChild(t);
    setTimeout(()=>t.classList.add('show'),10);
    setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},3500);
}
document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.modal-bg').forEach(mb=>{mb.addEventListener('click',e=>{if(e.target===mb)mb.classList.remove('open')})});
    setTimeout(()=>toggleAddPanel(),100);
});
