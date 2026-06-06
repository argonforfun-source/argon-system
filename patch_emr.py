import re

def patch_emr_app():
    with open('clinica-repo/emr-app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Audit Log in saveEditPatient
    target_updates = """  const updates = {
    name: sanitize(name),
    phone: sanitize(phone),
    nationalId: nationalId ? sanitize(nationalId) : null,
    age: age ? parseInt(age) : null,
    gender: sanitize(gender),
    bloodType: sanitize(blood),
    allergies: allergies.length ? allergies : null,
    chronicDiseases: chronic.length ? chronic : null,
    notes: sanitize(notes),
    photo: epPhotoData || null
  };"""
    
    audit_code = """
  // ── AUDIT: Identity & Clinical Change Detection ──
  const oldInfo = _patients[uid]?.info || {};
  const auditFields = ['name', 'phone', 'nationalId', 'age', 'gender', 'bloodType', 'allergies', 'chronicDiseases'];
  const changes = {};
  auditFields.forEach(field => {
    const oldVal = oldInfo[field] ?? null;
    const newVal = updates[field] ?? null;
    if (String(oldVal) !== String(newVal)) {
      changes[field] = { old: oldVal, new: newVal };
    }
  });

  if (Object.keys(changes).length > 0) {
    const session = ArgonSession.get() || {};
    const auditId = db.ref().child('audit').push().key;
    db.ref(`${BASE}/patients/${uid}/audit/identity/${auditId}`).set({
      changedBy:    session.staffId     || 'unknown',
      changedName:  session.displayName || 'unknown',
      timestamp:    new Date().toISOString(),
      changes
    }).catch(err => console.error('Identity audit failed:', err));
  }
  // ── END AUDIT ──
"""
    if 'Identity & Clinical Change Detection' not in content:
        content = content.replace(target_updates, target_updates + "\n" + audit_code)

    # 2. Timeline Badges and Archive Button
    target_map_start = """    visitsTimelineHTML = visits.map(([vk, v]) => {
      let dateGroupDivider = '';"""
    
    lock_code = """    visitsTimelineHTML = visits.map(([vk, v]) => {
      // ── VISIT LOCK & ARCHIVE STATUS ──
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
      const archivedStyle = isArchived ? 'opacity:0.5;' : '';
      
      // زر الأرشفة يظهر فقط للمالك وإذا ليست مؤرشفة بالفعل
      const archiveBtn = (!isArchived && isVisitOwner && !isExpired)
        ? `<button class="btn-secondary btn-sm" onclick="event.stopPropagation();archiveVisit('${uid}','${vk}')" style="color:var(--muted);border-color:rgba(239,68,68,0.3)"><i class="fas fa-archive"></i> أرشفة</button>`
        : '';
      // ── END VISIT LOCK ──

      let dateGroupDivider = '';"""
    if 'VISIT LOCK & ARCHIVE STATUS' not in content:
        content = content.replace(target_map_start, lock_code)

    target_tl_item = """<div class="tl-item">"""
    if '<div class="tl-item" style="${archivedStyle}">' not in content:
        # only replace inside the timeline loop
        idx1 = content.find(lock_code)
        if idx1 > -1:
            idx2 = content.find('}).join(\'\');', idx1)
            sub = content[idx1:idx2]
            sub = sub.replace('<div class="tl-item">', '<div class="tl-item" style="${archivedStyle}">')
            content = content[:idx1] + sub + content[idx2:]

    target_tl_doc = """<span class="tl-doc"><i class="fas ${cardIcon}"></i> ${sanitize(v.docName)}</span>"""
    tl_doc_new = """<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                ${lockBadge}${archiveBadge}
                <span class="tl-doc"><i class="fas ${cardIcon}"></i> ${sanitize(v.docName)}</span>
              </div>"""
    if '${lockBadge}${archiveBadge}' not in content:
        idx1 = content.find(lock_code)
        if idx1 > -1:
            idx2 = content.find('}).join(\'\');', idx1)
            sub = content[idx1:idx2]
            sub = sub.replace(target_tl_doc, tl_doc_new)
            content = content[:idx1] + sub + content[idx2:]

    target_tl_actions = """              <div style="margin-top:14px;display:flex;justify-content:flex-end">
                <button class="btn-secondary btn-sm" onclick="event.stopPropagation();printVisitSummary('${vk}')"><i class="fas fa-print"></i> طباعة الملخص</button>
              </div>"""
    tl_actions_new = """              <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px">
                ${archiveBtn}
                <button class="btn-secondary btn-sm" onclick="event.stopPropagation();printVisitSummary('${vk}')"><i class="fas fa-print"></i> طباعة الملخص</button>
              </div>"""
    if '${archiveBtn}' not in content:
        idx1 = content.find(lock_code)
        if idx1 > -1:
            idx2 = content.find('}).join(\'\');', idx1)
            sub = content[idx1:idx2]
            sub = sub.replace(target_tl_actions, tl_actions_new)
            content = content[:idx1] + sub + content[idx2:]

    # 3. archiveVisit function
    archive_func = """
// ── CLINICAL INTEGRITY: SOFT DELETE / ARCHIVE ──
window.archiveVisit = function(patientId, visitKey) {
  const session = ArgonSession.get() || {};
  if (!confirm('⚠️ هل أنت متأكد من أرشفة (حذف) هذا السجل الطبي؟ لا يمكن التراجع عن هذه العملية.')) return;

  const updates = {};
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/status`] = 'archived';
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/archivedBy`] = session.staffId;
  updates[`${BASE}/patients/${patientId}/visits/${visitKey}/archivedAt`] = new Date().toISOString();

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
};
"""
    if 'window.archiveVisit =' not in content:
        content += archive_func
        
    with open('clinica-repo/emr-app.js', 'w', encoding='utf-8') as f:
        f.write(content)
        
patch_emr_app()
