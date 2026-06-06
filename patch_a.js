import os

def append_to_enterprise():
    file_path = 'clinica-repo/argon-enterprise.js'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_code = """
// ═══════════════════════════════════════════════════════════════════
// 🛡️ ARGON CLINICAL INTEGRITY - WAVE 1
// ═══════════════════════════════════════════════════════════════════

window.ARGON_FEATURES = {
  ENABLE_VISIT_OWNERSHIP: true,
  ENABLE_SIGNOFF_LOCK: true,
  ENABLE_AUDIT_LOG: true,
  ENABLE_BREAK_GLASS: true
};

// ── 1. Argon Permissions ──
window.ArgonPermissions = {
  getVisitOwner: function(visit) {
    if (!visit) return null;
    // Layer of backward compatibility to resolve ownership
    return visit.docKey || visit.doctorId || visit.uid || visit.staffId || null;
  },

  canEditVisit: function(visit, currentStaffId) {
    if (!window.ARGON_FEATURES.ENABLE_VISIT_OWNERSHIP) return true;
    if (!visit || !currentStaffId) return false;

    const owner = this.getVisitOwner(visit);
    if (!owner) return false; // legacyReadOnly fallback

    const isCreator = (owner === currentStaffId);
    
    // Check lock status
    if (visit.status === 'locked' || visit.signedOff) return false;
    if (visit.lockedAt) return false;

    // Check server timestamp-based 24h auto-lock
    // Assuming server timestamp is populated in visit.signedAt or visit.createdAt
    // Note: Firebase ServerValue.TIMESTAMP gives epoch MS.
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

  log: function(entityType, entityId, action, oldValue, newValue, reason = '') {
    if (!window.ARGON_FEATURES.ENABLE_AUDIT_LOG) return;
    if (!window.firebase || !window.ArgonSession) return;

    const session = window.ArgonSession.get() || {};
    const db = window.firebase.database();
    
    const auditRecord = {
      correlationId: this.getCorrelationId(),
      entityType: entityType,
      entityId: entityId,
      action: action,
      oldValue: oldValue || null,
      newValue: newValue || null,
      performedBy: session.staffId || 'unknown',
      timestamp: new Date().toISOString(), // Use client ISO for UI sorting
      serverTime: window.firebase.database.ServerValue.TIMESTAMP, // Use server time for rigid timeline
      reason: reason
    };

    // Push to a centralized, append-only audit path
    const auditRef = db.ref('audit_logs').push();
    auditRef.set(auditRecord).catch(err => console.error('Audit Log failed:', err));
  }
};
"""
    if 'window.ArgonPermissions =' not in content:
        content += new_code
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("ArgonPermissions & Audit Log added.")
    else:
        print("Already present.")

if __name__ == '__main__':
    append_to_enterprise()
