import os

def fix_ui():
    file_path = 'clinica-repo/emr-app.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Fix the `canEdit` crash by correctly injecting Wave 2 Clinical Versioning logic
    old_demo = """  // Demographics HTML
  const allergiesHTML = (info.allergies || []).map(a => `<span class="tag">${sanitize(a)}</span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';
  const chronicHTML = (info.chronicDiseases || []).map(c => `<span class="tag blue">${sanitize(c)}</span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';"""

    new_demo = """  // Demographics HTML
  let allergiesHTML = '';
  let chronicHTML = '';

  if (window.ArgonClinicalParser && window.ARGON_FEATURES && window.ARGON_FEATURES.ENABLE_CLINICAL_VERSIONING) {
    const algList = ArgonClinicalParser.getClinicalList(info, 'allergies');
    const chrList = ArgonClinicalParser.getClinicalList(info, 'chronicDiseases');

    allergiesHTML = algList.filter(a => a.status === 'active').map(a => `<span class="tag" style="padding: 4px 8px;" title="Added by: ${sanitize(a.addedBy || 'Legacy')}">${sanitize(a.value)} <span style="font-size:0.7rem; font-weight:bold; background:rgba(255,255,255,0.4); padding:2px 6px; border-radius:4px; margin-right:6px; color:#1e293b;"><i class="fas fa-user-md"></i> د. ${sanitize(a.addedBy || 'سابق')}</span></span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';
    
    chronicHTML = chrList.filter(a => a.status === 'active').map(a => `<span class="tag blue" style="padding: 4px 8px; background:var(--teal); color:white; border:none;" title="Added by: ${sanitize(a.addedBy || 'Legacy')}">${sanitize(a.value)} <span style="font-size:0.7rem; font-weight:bold; background:rgba(255,255,255,0.3); padding:2px 6px; border-radius:4px; margin-right:6px; color:white;"><i class="fas fa-user-md"></i> د. ${sanitize(a.addedBy || 'سابق')}</span></span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';
    
    const revokedAlg = algList.filter(a => a.status === 'revoked');
    if (revokedAlg.length > 0) {
       allergiesHTML += `<div style="font-size:10px; color:#94a3b8; margin-top:4px;">أبطلت: ` + revokedAlg.map(a => `<span style="text-decoration:line-through" title="Revoked by: ${sanitize(a.revokedBy)} - ${sanitize(a.reason)}">${sanitize(a.value)} (د.${sanitize(a.revokedBy)})</span>`).join(', ') + `</div>`;
    }
    const revokedChr = chrList.filter(a => a.status === 'revoked');
    if (revokedChr.length > 0) {
       chronicHTML += `<div style="font-size:10px; color:#94a3b8; margin-top:4px;">أبطلت: ` + revokedChr.map(a => `<span style="text-decoration:line-through" title="Revoked by: ${sanitize(a.revokedBy)} - ${sanitize(a.reason)}">${sanitize(a.value)} (د.${sanitize(a.revokedBy)})</span>`).join(', ') + `</div>`;
    }
  } else {
    allergiesHTML = (info.allergies || []).map(a => `<span class="tag">${sanitize(a)}</span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';
    chronicHTML = (info.chronicDiseases || []).map(c => `<span class="tag blue">${sanitize(c)}</span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';
  }"""
    if old_demo in content:
        content = content.replace(old_demo, new_demo)

    old_locks = """      // ── VISIT LOCK & ARCHIVE STATUS ──
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
      
      // أزرار التحكم تظهر إذا كان يملك الصلاحية
      const archiveBtn = (!isArchived && canEdit)
        ? `<button class="btn-secondary btn-sm" onclick="event.stopPropagation();archiveVisit('${uid}','${vk}')" style="color:var(--muted);border-color:rgba(239,68,68,0.3)"><i class="fas fa-archive"></i> أرشفة</button>`
        : '';
        
      const signOffBtn = (!isArchived && !isSigned && canEdit)
        ? `<button class="btn-secondary btn-sm" onclick="event.stopPropagation();signOffVisit('${uid}','${vk}')" style="color:var(--teal);border-color:rgba(13,148,136,0.3)"><i class="fas fa-file-signature"></i> توقيع وإقفال</button>`
        : '';"""

    new_locks = """      // ── VISIT LOCK & ARCHIVE STATUS ──
      const session       = window.ArgonSession ? window.ArgonSession.get() : {};
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
      
      const archiveBadge = stateBadge;
      const archivedStyle = isArchived ? 'opacity:0.5;' : '';
      
      // أزرار التحكم تظهر إذا كان يملك الصلاحية
      const archiveBtn = (!isArchived && canEdit)
        ? `<button class="btn-secondary btn-sm" onclick="event.stopPropagation();archiveVisit('${uid}','${vk}')" style="color:var(--muted);border-color:rgba(239,68,68,0.3)"><i class="fas fa-archive"></i> أرشفة</button>`
        : '';
        
      const signOffBtn = (!isArchived && !isSigned && canEdit)
        ? `<button class="btn-secondary btn-sm" onclick="event.stopPropagation();signOffVisit('${uid}','${vk}')" style="color:var(--teal);border-color:rgba(13,148,136,0.3)"><i class="fas fa-file-signature"></i> توقيع وإقفال</button>`
        : '';"""

    if old_locks in content:
        content = content.replace(old_locks, new_locks)


    old_tl_head = """            <div class="tl-head">
              <span class="tl-date">${v.date} · ${v.time}</span>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                ${lockBadge}${stateBadge}
                <span class="tl-doc"><i class="fas ${cardIcon}"></i> ${sanitize(v.docName)}</span>
              </div>
            </div>"""
    
    # We will replace it with a more prominent doctor name badge
    new_tl_head = """            <div class="tl-head" style="justify-content: space-between; align-items:flex-start;">
              <div style="display:flex; flex-direction:column; gap:4px;">
                <span class="tl-date">${v.date} · ${v.time}</span>
                <span class="tl-doc" style="background:#0f172a; color:#f8fafc; padding:4px 10px; border-radius:8px; font-weight:700; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 4px rgba(0,0,0,0.1); width:fit-content; border: 1px solid #334155;"><i class="fas ${cardIcon}"></i> الطبيب: ${sanitize(v.docName)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                ${lockBadge}${archiveBadge}
              </div>
            </div>"""

    if old_tl_head in content:
        content = content.replace(old_tl_head, new_tl_head)
    elif "${lockBadge}${stateBadge}" in content:
        # Just in case `stateBadge` was already named `archiveBadge` in the current code
        old_tl_head_alt = """            <div class="tl-head">
              <span class="tl-date">${v.date} · ${v.time}</span>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                ${lockBadge}${archiveBadge}
                <span class="tl-doc"><i class="fas ${cardIcon}"></i> ${sanitize(v.docName)}</span>
              </div>
            </div>"""
        if old_tl_head_alt in content:
            content = content.replace(old_tl_head_alt, new_tl_head)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("UI fixed successfully")

if __name__ == '__main__':
    fix_ui()
