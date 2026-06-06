import os

def patch_emr():
    file_path = 'clinica-repo/emr-app.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Timeline Logic Replacement
    old_timeline_logic = """      // ── VISIT LOCK & ARCHIVE STATUS ──
      const session       = ArgonSession.get() || {};
      const isVisitOwner  = v.docKey === session.staffId;
      const isExpired     = v.timestamp && (Date.now() - v.timestamp) > 86400000;
      const isArchived    = v.status === 'archived';
      const isLocked      = !isVisitOwner || isExpired || v.signedOff;

      const lockBadge = isLocked
        ? `<span style="background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:2px 8px;font-size:0.7rem;font-weight:700;margin-right:6px">🔒 قراءة فقط</span>`
        : `<span style="background:rgba(13,148,136,0.1);color:var(--teal);border:1px solid rgba(13,148,136,0.25);border-radius:6px;padding:2px 8px;font-size:0.7rem;font-weight:700;margin-right:6px">✏️ قابل للتعديل</span>`;

      const archiveBadge = isArchived
        ? `<span style="background:rgba(239,68,68,0.08);color:#f87171;border:1px solid rgba(239,68,68,0.2);border-radius:6px;padding:2px 8px;font-size:0.7rem;font-weight:700;text-decoration:line-through;margin-right:6px">🗃️ مؤرشفة</span>`
        : '';
      // ── END VISIT LOCK ──"""

    new_timeline_logic = """      // ── VISIT LOCK & ARCHIVE STATUS ──
      const session       = ArgonSession.get() || {};
      const canEdit       = window.ArgonPermissions ? window.ArgonPermissions.canEditVisit(v, session.staffId) : false;
      const isArchived    = v.status === 'archived';
      const isSigned      = v.status === 'signed' || v.signedOff;

      const lockBadge = !canEdit
        ? `<span style="background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:2px 8px;font-size:0.7rem;font-weight:700;margin-right:6px">🔒 قراءة فقط</span>`
        : `<span style="background:rgba(13,148,136,0.1);color:var(--teal);border:1px solid rgba(13,148,136,0.25);border-radius:6px;padding:2px 8px;font-size:0.7rem;font-weight:700;margin-right:6px">✏️ قابل للتعديل</span>`;

      let stateBadge = '';
      if (isArchived) {
        stateBadge = `<span style="background:rgba(239,68,68,0.08);color:#f87171;border:1px solid rgba(239,68,68,0.2);border-radius:6px;padding:2px 8px;font-size:0.7rem;font-weight:700;text-decoration:line-through;margin-right:6px">🗃️ مؤرشفة</span>`;
      } else if (isSigned) {
        stateBadge = `<span style="background:rgba(16,185,129,0.1);color:var(--green);border:1px solid rgba(16,185,129,0.2);border-radius:6px;padding:2px 8px;font-size:0.7rem;font-weight:700;margin-right:6px">✍️ موقعة إلكترونياً</span>`;
      }
      // ── END VISIT LOCK ──"""

    if old_timeline_logic in content:
        content = content.replace(old_timeline_logic, new_timeline_logic)

    # Replace archive button logic and add sign off button
    old_btn_logic = """      // زر الأرشفة يظهر فقط للمالك وإذا ليست مؤرشفة بالفعل
      const archiveBtn = (!isArchived && isVisitOwner && !isExpired)
        ? `<button class="btn-secondary btn-sm" onclick="event.stopPropagation();archiveVisit('${uid}','${vk}')" style="color:var(--muted);border-color:rgba(239,68,68,0.3)"><i class="fas fa-archive"></i> أرشفة</button>`
        : '';"""
        
    new_btn_logic = """      // أزرار التحكم تظهر إذا كان يملك الصلاحية
      const archiveBtn = (!isArchived && canEdit)
        ? `<button class="btn-secondary btn-sm" onclick="event.stopPropagation();archiveVisit('${uid}','${vk}')" style="color:var(--muted);border-color:rgba(239,68,68,0.3)"><i class="fas fa-archive"></i> أرشفة</button>`
        : '';
        
      const signOffBtn = (!isArchived && !isSigned && canEdit)
        ? `<button class="btn-secondary btn-sm" onclick="event.stopPropagation();signOffVisit('${uid}','${vk}')" style="color:var(--teal);border-color:rgba(13,148,136,0.3)"><i class="fas fa-file-signature"></i> توقيع وإقفال</button>`
        : '';"""

    if old_btn_logic in content:
        content = content.replace(old_btn_logic, new_btn_logic)

    old_tl_actions = """              <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px">
                ${archiveBtn}"""
    
    new_tl_actions = """              <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px">
                ${archiveBtn}
                ${signOffBtn}"""
    if old_tl_actions in content:
        content = content.replace(old_tl_actions, new_tl_actions)

    old_lock_badge_var = "${lockBadge}${archiveBadge}"
    new_lock_badge_var = "${lockBadge}${stateBadge}"
    if old_lock_badge_var in content:
        content = content.replace(old_lock_badge_var, new_lock_badge_var)

    # 2. Update Visit Creation (_writeVisitUpdates)
    # The actual object creation is in completeWorkspaceVisit around line 3289:
    # updates[`${BASE}/patients/${newUid}/visits/${timelineKey}`] = visitObj;
    # But visitObj is created slightly earlier.
    # Let's just find where visitObj is assigned
    old_visit_obj = """    const visitObj = {
      docKey: (window.ArgonSession ? ArgonSession.get()?.staffId : null) || 'doctor',
      docName: (window.ArgonSession ? ArgonSession.get()?.displayName : null) || 'طبيب',
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      diagnosis: diag,
      complaint: activeVisit.complaint || '',
      vitals: activeVisit.vitals || {},
      notes: notes,
      rx: activeVisit.rx || [],
      prescriptions: rxList,
      attachments: uploadAttachments,
      labOrders: labTestsList,
      radOrders: radScansList
    };"""
    
    new_visit_obj = """    const visitObj = {
      schemaVersion: 1,
      status: 'draft',
      docKey: (window.ArgonSession ? ArgonSession.get()?.staffId : null) || 'doctor',
      docName: (window.ArgonSession ? ArgonSession.get()?.displayName : null) || 'طبيب',
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      diagnosis: diag,
      complaint: activeVisit.complaint || '',
      vitals: activeVisit.vitals || {},
      notes: notes,
      rx: activeVisit.rx || [],
      prescriptions: rxList,
      attachments: uploadAttachments,
      labOrders: labTestsList,
      radOrders: radScansList
    };"""
    
    if old_visit_obj in content:
        content = content.replace(old_visit_obj, new_visit_obj)

    # 3. Add signOffVisit function & update archiveVisit
    old_archive_visit = """// ── CLINICAL INTEGRITY: SOFT DELETE / ARCHIVE ──
window.archiveVisit = function(patientId, visitKey) {
  const session = ArgonSession.get() || {};
  if (!confirm('⚠️ هل أنت متأكد من أرشفة (حذف) هذا السجل الطبي؟ لا يمكن التراجع عن هذه العملية.')) return;

  const updates = {};
  // بدلاً من الحذف النهائي .remove() نغير الحالة إلى مؤرشفة
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/status`] = 'archived';
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/archivedBy`] = session.staffId;
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/archivedAt`] = new Date().toISOString();

  // Audit Log Entry
  const auditId = db.ref().child('audit').push().key;
  updates[`${BASE}/patients/${patientId}/audit/visits/${auditId}`] = {
    action: 'ARCHIVE_VISIT',
    visitId: visitKey,
    archivedBy: session.staffId,
    timestamp: new Date().toISOString()
  };

  db.ref().update(updates).then(() => {
    toast('✅ تم أرشفة السجل الطبي بنجاح', 'ok');
    viewPatientFile(patientId); // Refresh timeline
  }).catch(err => {
    toast('❌ حدث خطأ أثناء الأرشفة: ' + err.message, 'err');
  });
};"""

    new_archive_and_signoff = """// ── CLINICAL INTEGRITY: SOFT DELETE / ARCHIVE ──
window.archiveVisit = function(patientId, visitKey) {
  const session = ArgonSession.get() || {};
  if (!confirm('⚠️ هل أنت متأكد من أرشفة (حذف) هذا السجل الطبي؟ لا يمكن التراجع عن هذه العملية.')) return;

  const updates = {};
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/status`] = 'archived';
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/archivedBy`] = session.staffId;
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/archivedAt`] = firebase.database.ServerValue.TIMESTAMP;

  if (window.ArgonAuditLog) {
    window.ArgonAuditLog.log('VISIT', visitKey, 'ARCHIVE', null, { status: 'archived' }, 'Manual Archival');
  }

  db.ref().update(updates).then(() => {
    toast('✅ تم أرشفة السجل الطبي بنجاح', 'ok');
    viewPatientFile(patientId); // Refresh timeline
  }).catch(err => {
    toast('❌ حدث خطأ أثناء الأرشفة: ' + err.message, 'err');
  });
};

window.signOffVisit = function(patientId, visitKey) {
  const session = ArgonSession.get() || {};
  if (!confirm('⚠️ بالتوقيع الإلكتروني، سيتم إقفال هذا السجل تماماً ولن تتمكن من تعديله أو أرشفته. هل توافق؟')) return;

  const updates = {};
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/status`] = 'signed';
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/signedOff`] = true;
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/signedBy`] = session.staffId;
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/signedAt`] = firebase.database.ServerValue.TIMESTAMP;

  if (window.ArgonAuditLog) {
    window.ArgonAuditLog.log('VISIT', visitKey, 'SIGN_OFF', null, { status: 'signed' }, 'Doctor Sign Off');
  }

  db.ref().update(updates).then(() => {
    toast('✅ تم توقيع السجل الطبي وإقفاله بنجاح', 'ok');
    viewPatientFile(patientId); // Refresh timeline
  }).catch(err => {
    toast('❌ حدث خطأ أثناء التوقيع: ' + err.message, 'err');
  });
};"""
    if old_archive_visit in content:
        content = content.replace(old_archive_visit, new_archive_and_signoff)
        
    # 4. Integrate ArgonAuditLog into Identity Audit in saveEditPatient
    old_identity_audit = """  if (Object.keys(changes).length > 0) {
    const session = ArgonSession.get() || {};
    const auditId = db.ref().child('audit').push().key;
    db.ref(`${BASE}/patients/${uid}/audit/identity/${auditId}`).set({
      changedBy:    session.staffId     || 'unknown',
      changedName:  session.displayName || 'unknown',
      timestamp:    new Date().toISOString(),
      changes
    }).catch(err => console.error('Identity audit failed:', err));
  }"""
  
    new_identity_audit = """  if (Object.keys(changes).length > 0) {
    if (window.ArgonAuditLog) {
      window.ArgonAuditLog.log('PATIENT_IDENTITY', uid, 'UPDATE', oldInfo, updates, 'Profile Edit');
    }
  }"""
    
    if old_identity_audit in content:
        content = content.replace(old_identity_audit, new_identity_audit)

    # 5. Correlation ID trigger on viewPatientFile
    target_view_patient = """function viewPatientFile(uid) {"""
    new_view_patient = """function viewPatientFile(uid) {
  if (window.ArgonAuditLog) window.ArgonAuditLog.startTransaction(); // Begin new logical transaction for correlation
"""
    if 'window.ArgonAuditLog.startTransaction();' not in content:
        content = content.replace(target_view_patient, new_view_patient)


    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done patching emr-app.js")

if __name__ == '__main__':
    patch_emr()
