// Mocks
global.window = {
  ARGON_FEATURES: {
    ENABLE_VISIT_OWNERSHIP: true,
    ENABLE_SIGNOFF_LOCK: true,
    ENABLE_AUDIT_LOG: true,
    ENABLE_BREAK_GLASS: true
  },
  firebase: {
    database: {
      ServerValue: { TIMESTAMP: 1234567890 }
    }
  },
  ArgonSession: {
    get: () => ({ staffId: 'dr_hani', displayName: 'Dr. Hani' })
  }
};

// ── 1. Argon Permissions ──
window.ArgonPermissions = {
  getVisitOwner: function(visit) {
    if (!visit) return null;
    return visit.docKey || visit.doctorId || visit.uid || visit.staffId || null;
  },
  canEditVisit: function(visit, currentStaffId) {
    if (!window.ARGON_FEATURES.ENABLE_VISIT_OWNERSHIP) return true;
    if (!visit || !currentStaffId) return false;
    const owner = this.getVisitOwner(visit);
    if (!owner) return false; // legacyReadOnly fallback
    const isCreator = (owner === currentStaffId);
    if (visit.status === 'locked' || visit.signedOff) return false;
    if (visit.lockedAt) return false;
    if (visit.createdAt && typeof visit.createdAt === 'number') {
      const now = Date.now();
      if ((now - visit.createdAt) > 86400000) return false;
    }
    return isCreator;
  }
};

// ── 2. Argon Audit Log ──
window.ArgonAuditLog = {
  _currentCorrelationId: null,
  startTransaction: function() {
    this._currentCorrelationId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    return this._currentCorrelationId;
  },
  getCorrelationId: function() {
    if (!this._currentCorrelationId) this.startTransaction();
    return this._currentCorrelationId;
  },
  log: function() {} // mock
};

// --- TEST RUNNER ---
let passCount = 0;
let failCount = 0;
function assertEqual(name, actual, expected) {
  if (actual === expected) {
    console.log(`✅ PASS: ${name}`);
    passCount++;
  } else {
    console.log(`❌ FAIL: ${name} | Expected ${expected}, got ${actual}`);
    failCount++;
  }
}

console.log("\\n--- 1. OWNERSHIP TESTS ---");
const visitA = { docKey: 'dr_hani', createdAt: Date.now() };
assertEqual('Dr. Hani can edit own visit', window.ArgonPermissions.canEditVisit(visitA, 'dr_hani'), true);
assertEqual('Dr. Zaid CANNOT edit Dr. Hani visit', window.ArgonPermissions.canEditVisit(visitA, 'dr_zaid'), false);

const visitLegacy = { status: 'draft' }; // no owner
assertEqual('Legacy visit is read-only (no owner)', window.ArgonPermissions.canEditVisit(visitLegacy, 'dr_hani'), false);

const visitLegacyId = { uid: 'dr_zaid', createdAt: Date.now() };
assertEqual('Resolves legacy uid property for ownership', window.ArgonPermissions.canEditVisit(visitLegacyId, 'dr_zaid'), true);


console.log("\\n--- 2. SIGN-OFF TESTS ---");
const visitSigned = { docKey: 'dr_hani', signedOff: true, createdAt: Date.now() };
assertEqual('Creator CANNOT edit signed-off visit', window.ArgonPermissions.canEditVisit(visitSigned, 'dr_hani'), false);

const visitLocked = { docKey: 'dr_hani', lockedAt: 1234567890, createdAt: Date.now() };
assertEqual('Creator CANNOT edit locked visit', window.ArgonPermissions.canEditVisit(visitLocked, 'dr_hani'), false);

const visitExpired = { docKey: 'dr_hani', createdAt: Date.now() - 90000000 }; // > 24 hours
assertEqual('Creator CANNOT edit expired visit (>24h)', window.ArgonPermissions.canEditVisit(visitExpired, 'dr_hani'), false);


console.log("\\n--- 3. CORRELATION ID TESTS ---");
window.ArgonAuditLog.startTransaction();
const id1 = window.ArgonAuditLog.getCorrelationId();
const id2 = window.ArgonAuditLog.getCorrelationId();
assertEqual('Correlation ID persists across actions in same transaction', id1, id2);
window.ArgonAuditLog.startTransaction();
const id3 = window.ArgonAuditLog.getCorrelationId();
assertEqual('New transaction generates NEW Correlation ID', id1 === id3, false);


console.log(`\\n--- RESULTS ---\\nPass: ${passCount}\\nFail: ${failCount}`);
if (failCount === 0) {
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY (100%)');
}
