const fs = require('fs');
let code = fs.readFileSync('./clinica-repo/emr-app.js', 'utf8');

// --- B1 PATCH ---
const b1OldGuard = `  // --- NID SECURITY GUARD ---
  if (typeof window.ArgonNID !== 'undefined' && _patients[uid]) {
    const pInfo = _patients[uid].info || {};
    if (!window.ArgonNID.isValidNID(pInfo.nationalId)) {
      window.ArgonNID.showCollectorDialog(pInfo.name || 'المريض', uid, db, typeof BASE !== 'undefined' ? BASE : '', (savedUid, savedNid) => {
        safeViewPatientFile(savedUid);
      });
      return; 
    }
  }`;

const b1NewGuard = `
  // ── B1: NID Gate — يتحقق قبل فتح أي ملف ──
  const patData = _patients[uid];
  const hasNID  = ArgonNID.isValidNID(patData?.info?.nationalId || '');

  if (!hasNID) {
    // المريض بدون رقم وطني — أطلب من الطبيب إدخاله أولاً
    // أفرج عن القفل مؤقتاً ريثما يُدخل الرقم
    window.EMRContext.sessionLock = false;
    if (typeof BASE !== 'undefined') {
      db.ref(\`\${BASE}/active_sessions/\${uid}\`).remove();
    }

    ArgonNID.showCollectorDialog(
      patData?.info?.name || 'المريض',
      uid,
      db,
      BASE,
      (patientId, nid) => {
        // بعد الحفظ: حدّث الكاش المحلي فوراً
        if (_patients[patientId] && _patients[patientId].info) {
          _patients[patientId].info.nationalId = nid;
        }
        // أعد فتح الملف — الآن عنده رقم وطني
        safeViewPatientFile(patientId);
      }
    );
    return; // أوقف التنفيذ الحالي
  }
  // ── نهاية B1 ──
`;

if (code.includes(b1OldGuard)) {
  code = code.replace(b1OldGuard, '');
}

code = code.replace('  activePatientId = uid;', b1NewGuard + '\n  activePatientId = uid;');

// --- B2 PATCH ---
const b2Old = `  const cleanNid = ArgonNID.cleanNID(nationalId);
  if (!name || !phone || !ArgonNID.isValidNID(cleanNid)) {
    toast('⚠️ يرجى إدخال الاسم، رقم الهاتف، والرقم الوطني (9 أرقام كحد أدنى)', 'err');
    return;
  }`;

const b2New = `
// ── B2: NID إجباري عند إنشاء مريض جديد ──
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

code = code.replace(b2Old, b2New);

// --- B3 PATCH ---
const b3Old = `    if (!q) return true;
    return (info.phone || '').includes(q) ||
      (info.name || '').toLowerCase().includes(q) ||
      (info.mrn || '').toLowerCase().includes(q) ||
      (info.nationalId || '').toLowerCase().includes(q) ||
      uid.includes(q);`;

const b3New = `    // ── B3: إضافة البحث بالرقم الوطني ──
    if (!q) return true;
    return (info.phone || '').includes(q)
      || (info.name || '').toLowerCase().includes(q)
      || (info.mrn || '').toLowerCase().includes(q)
      || ArgonNID.cleanNID(info.nationalId || '').includes(ArgonNID.cleanNID(q))
      || uid.includes(q);
    // ── نهاية B3 ──`;

code = code.replace(b3Old, b3New);

// --- B4 PATCH ---
const b4Old = `  const bookingName = (booking.patName || '').trim();`;
const b4New = `  const bookingName = (booking.patName || '').trim();

// ── B4: استخراج NID من الحجز وتمريره للمحرك ──
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

code = code.replace(b4Old, b4New);

fs.writeFileSync('./clinica-repo/emr-app.js', code);
console.log('PATCH B APPLIED');
