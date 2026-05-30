const fs = require('fs');
let code = fs.readFileSync('./clinica-repo/emr-app.js', 'utf8');

// --- B1 PATCH ---
const b1Old = `  // ── B1: NID Gate — يتحقق قبل فتح أي ملف ──
  const patData = _patients[uid];
  const hasNID  = ArgonNID.isValidNID(patData?.info?.nationalId || '');

  if (!hasNID) {
    // المريض بدون رقم وطني — أطلب من الطبيب إدخاله أولاً
    // أفرج عن القفل مؤقتاً ريثما يُدخل الرقم
    window.EMRContext.sessionLock = false;
    if (typeof BASE !== 'undefined') {
      db.ref(\`\${BASE}/active_sessions/\${uid}\`).remove();
    }

    const session = window.ArgonSession ? window.ArgonSession.get() : {};
    ArgonNID.showGate({
      patientName: patData?.info?.name || 'المريض',
      patientId: uid,
      db: db,
      basePath: typeof BASE !== 'undefined' ? BASE : '',
      doctorId: session.staffId || 'unknown',
      doctorName: session.displayName || 'طبيب',
      patientsCache: _patients,
      onComplete: (patientId, result) => {
        // result = { nid: '...', bypassed: false } or { nid: null, bypassed: true, bypassReason: '...' }
        if (_patients[patientId] && _patients[patientId].info) {
          if (result.nid) {
            _patients[patientId].info.nationalId = result.nid;
          }
        }
        // أعد فتح الملف (سواء برقم وطني أو كـ bypass)
        safeViewPatientFile(patientId);
      }
    });
    return; // أوقف التنفيذ الحالي
  }
  // ── نهاية B1 ──`;

const b1New = `const _patData = _patients[uid];
const _hasNID  = ArgonNID.isValidNID(_patData?.info?.nationalId || '');

if (!_hasNID) {
  // أفرج عن القفل مؤقتاً
  window.EMRContext.sessionLock = false;
  if (typeof BASE !== 'undefined')
    db.ref(\`\${BASE}/active_sessions/\${uid}\`).remove();

  const session = window.ArgonSession ? ArgonSession.get() : {};

  ArgonNID.showGate({
    patientName:   _patData?.info?.name || 'المريض',
    patientId:     uid,
    db,
    basePath:      BASE,
    doctorId:      session.staffId   || 'unknown',
    doctorName:    session.displayName || 'الطبيب',
    patientsCache: _patients,

    onComplete: (patientId, result) => {
      // سواء أدخل الرقم أو تجاوز — نفتح الملف في الحالتين
      if (_patients[patientId]?.info && result.nid) {
        // حدّث الكاش المحلي فوراً
        _patients[patientId].info.nationalId = result.nid;
      }
      // أعد المحاولة — الآن إما عنده NID أو عنده bypass مسجّل
      safeViewPatientFile(patientId);
    }
  });
  return;
}`;

code = code.replace(b1Old, b1New);

// --- B2 PATCH ---
const b2Old = `// ── B2: NID إجباري عند إنشاء مريض جديد ──
const nationalId_B2 = document.getElementById('npNationalId').value.trim();

if (!name || !phone) {
  toast('⚠️ يرجى إدخال الاسم ورقم الهاتف', 'err');
  return;
}
if (!ArgonNID.isValidNID(nationalId_B2)) {
  toast('🚫 الرقم الوطني إجباري — لا يمكن إنشاء ملف بدونه', 'err');
  const nidField = document.getElementById('npNationalId');
  if (nidField) {
    nidField.style.borderColor = '#ef4444';
    nidField.focus();
    setTimeout(() => { nidField.style.borderColor = ''; }, 3000);
  }
  return;
}

// تحقق: هل الرقم الوطني مسجل مسبقاً؟
const nidClean_B2 = ArgonNID.cleanNID(nationalId_B2);
const nidExistingLocal = ArgonNID.findByNIDLocal(nidClean_B2, _patients);

if (nidExistingLocal) {
  // الرقم الوطني موجود — افتح الملف القديم مباشرة
  toast(\`ℹ️ هذا المريض مسجل مسبقاً (\${nidExistingLocal.info.mrn || 'ملف موجود'}) — جاري فتح ملفه\`, 'ok');
  closeModal('newPatModal');
  viewPatientFile(nidExistingLocal.uid);
  return;
}
// ── نهاية B2 ──`;

const b2New = `const _nidVal = document.getElementById('npNationalId')?.value?.trim() || '';

// التحقق من الاسم والهاتف أولاً
if (!name || !phone) {
  toast('⚠️ يرجى إدخال الاسم ورقم الهاتف', 'err');
  return;
}

// التحقق من الرقم الوطني
if (!ArgonNID.isValidNID(_nidVal)) {
  toast('🪪 الرقم الوطني إجباري لإنشاء ملف جديد', 'err');
  const el = document.getElementById('npNationalId');
  if (el) {
    el.style.borderColor = '#ef4444';
    el.style.boxShadow   = '0 0 0 3px rgba(239,68,68,0.15)';
    el.focus();
    setTimeout(() => { el.style.borderColor=''; el.style.boxShadow=''; }, 3000);
  }
  return;
}

// تحقق: هل الرقم الوطني مسجل لمريض موجود؟
const _nidClean = ArgonNID.cleanNID(_nidVal);
const _nidExist = ArgonNID.findByNIDLocal(_nidClean, _patients);
if (_nidExist) {
  toast(\`ℹ️ مريض مسجل بهذا الرقم الوطني (\${_nidExist.info.mrn||'موجود'}) — جاري فتح ملفه\`, 'ok');
  closeModal('newPatModal');
  viewPatientFile(_nidExist.uid);
  return;
}`;

code = code.replace(b2Old, b2New);

// --- B3 PATCH ---
const b3Old = `    // ── B3: إضافة البحث بالرقم الوطني ──
    if (!q) return true;
    return (info.phone || '').includes(q)
      || (info.name || '').toLowerCase().includes(q)
      || (info.mrn || '').toLowerCase().includes(q)
      || ArgonNID.cleanNID(info.nationalId || '').includes(ArgonNID.cleanNID(q))
      || uid.includes(q);
    // ── نهاية B3 ──`;

const b3New = `    if (!q) return true;
    const _qClean = ArgonNID.cleanNID(q);
    return (info.phone || '').includes(q)
      || (info.name  || '').toLowerCase().includes(q)
      || (info.mrn   || '').toLowerCase().includes(q)
      || (_qClean.length >= 4 && ArgonNID.cleanNID(info.nationalId||'').includes(_qClean))
      || uid.includes(q);`;

code = code.replace(b3Old, b3New);

// --- B4 PATCH ---
const b4Old = `// ── B4: استخراج NID من الحجز وتمريره للمحرك ──
const bookingNID = ArgonNID.cleanNID(booking.patNationalId || booking.nationalId || '');

// إذا الحجز يحتوي رقم وطني، ابحث به أولاً (أسرع وأدق)
if (ArgonNID.isValidNID(bookingNID)) {
  const nidMatch = ArgonNID.findByNIDLocal(bookingNID, _patients);
  if (nidMatch) {
    // ✅ وجدنا المريض برقمه الوطني — فتح مباشر بدون أي سؤال
    if (typeof window.ArgonMedical?.ShadowLog?.log === 'function') {
      window.ArgonMedical.ShadowLog.log(CID, {
        result: 'EXACT', confidence: 1.0,
        matchedId: nidMatch.uid, matchedName: nidMatch.info.name,
        reason: '🔒 NID direct match from booking — instant open'
      }, { source: 'doctor_waiting_room_nid', userId: (ArgonSession.get()||{}).staffId||'' }, db);
    }
    if (startVisit) { sw('newVisit'); loadVisitForm(nidMatch.uid, bookingKey); }
    else             { viewPatientFile(nidMatch.uid); sw('patFile'); }
    return;
  }
}
// ── نهاية B4 ──`;

const b4New = `// B4-A: استخراج NID من بيانات الحجز
const _bNID = ArgonNID.cleanNID(
  booking.patNationalId || booking.nationalId || ''
);

// B4-B: إذا في NID في الحجز ← بحث مباشر وسريع بدون Firebase
if (ArgonNID.isValidNID(_bNID)) {
  const _nidHit = ArgonNID.findByNIDLocal(_bNID, _patients);
  if (_nidHit) {
    // ✅ EXACT فوري — فتح مباشر
    if (window.ArgonMedical?.ShadowLog?.log) {
      window.ArgonMedical.ShadowLog.log(CID, {
        result: 'EXACT', confidence: 1.0,
        matchedId: _nidHit.uid, matchedName: _nidHit.info.name,
        reason: '🔒 NID direct hit from booking — instant open, zero ambiguity'
      }, {
        source: 'doctor_wr_nid_direct',
        userId: (ArgonSession.get()||{}).staffId || ''
      }, db);
    }
    if (startVisit) { sw('newVisit'); loadVisitForm(_nidHit.uid, bookingKey); }
    else             { viewPatientFile(_nidHit.uid); sw('patFile'); }
    return; // ← أوقف كل المنطق الآخر
  }
}`;

code = code.replace(b4Old, b4New);

// --- B5 PATCH ---
const b5OldRegex = /const nationalId = info\.nationalId \? `.*?` : '';/s;
const b5New = `    const _nidStatus = ArgonNID.isValidNID(info.nationalId || '')
      ? \`<span style="
           font-size:10px;color:var(--teal,#0d9488);font-family:monospace;
           background:rgba(13,148,136,.08);padding:1px 7px;border-radius:5px;
           border:1px solid rgba(13,148,136,.2);
         ">🪪 \${ArgonNID.cleanNID(info.nationalId)}</span>\`
      : \`<span style="
           font-size:10px;color:rgba(239,68,68,0.7);
           background:rgba(239,68,68,.06);padding:1px 7px;border-radius:5px;
           border:1px solid rgba(239,68,68,.15);
         ">🪪 لا يوجد رقم وطني</span>\`;`;

code = code.replace(b5OldRegex, b5New);
code = code.replace(/\$\{nationalId\}/g, '${_nidStatus}');

// --- B6 PATCH ---
const b6Old = `}

// Render Waiting Room`;
const b6New = `}

function countMissingNIDs() {
  return Object.values(_patients).filter(p =>
    !ArgonNID.isValidNID(p.info?.nationalId || '')
  ).length;
}

// Render Waiting Room`;

code = code.replace(b6Old, b6New);

fs.writeFileSync('./clinica-repo/emr-app.js', code);
console.log('ALL V2.0 PATCHES APPLIED TO EMR-APP.JS');
