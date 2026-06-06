const fs = require('fs');
let code = fs.readFileSync('./clinica-repo/emr-app.js', 'utf8');

const oldStr = `const _patData = _patients[uid];
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

const newStr = `const _patData = _patients[uid];
window.EMRContext = window.EMRContext || {};
window.EMRContext.bypassedPatients = window.EMRContext.bypassedPatients || {};

const _hasBypass = window.EMRContext.bypassedPatients[uid];
const _hasNID    = ArgonNID.isValidNID(_patData?.info?.nationalId || '') || _hasBypass;

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
      if (result.bypassed) {
        window.EMRContext.bypassedPatients[patientId] = true;
      }
      // أعد المحاولة — الآن إما عنده NID أو عنده bypass مسجّل
      safeViewPatientFile(patientId);
    }
  });
  return;
}`;

if (code.includes(oldStr)) {
  code = code.replace(oldStr, newStr);
  fs.writeFileSync('./clinica-repo/emr-app.js', code);
  console.log('Fixed bypass loop.');
} else {
  console.log('Could not find the string to replace!');
}
