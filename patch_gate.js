const fs = require('fs');

const files = [
  './clinica-repo/radiology.html',
  './clinica-repo/pharmacy.html',
  './clinica-repo/lab.html',
  './clinica-repo/emr.html',
  './clinica-repo/dashboard.html'
];

for(const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace('argon-nid-security.js', 'argon-nid-gate.js');
  fs.writeFileSync(f, content);
}
console.log('HTML files updated.');

let emrCode = fs.readFileSync('./clinica-repo/emr-app.js', 'utf8');

const oldCall = `    ArgonNID.showCollectorDialog(
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
    );`;

const newCall = `    const session = window.ArgonSession ? window.ArgonSession.get() : {};
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
    });`;

emrCode = emrCode.replace(oldCall, newCall);
fs.writeFileSync('./clinica-repo/emr-app.js', emrCode);
console.log('emr-app.js updated.');
