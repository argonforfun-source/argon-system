import os

def patch_emr_wave2():
    file_path = 'clinica-repo/emr-app.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update load fields for editPatient
    old_load_allergies = """  document.getElementById('epAllergies').value = (p.info.allergies || []).join('، ');
  document.getElementById('epChronic').value = (p.info.chronicDiseases || []).join('، ');"""

    new_load_allergies = """  if (window.ArgonClinicalParser && window.ARGON_FEATURES.ENABLE_CLINICAL_VERSIONING) {
    const algList = ArgonClinicalParser.getClinicalList(p.info, 'allergies');
    const chrList = ArgonClinicalParser.getClinicalList(p.info, 'chronicDiseases');
    document.getElementById('epAllergies').value = ArgonClinicalParser.toLegacyText(algList);
    document.getElementById('epChronic').value = ArgonClinicalParser.toLegacyText(chrList);
  } else {
    document.getElementById('epAllergies').value = (p.info.allergies || []).join('، ');
    document.getElementById('epChronic').value = (p.info.chronicDiseases || []).join('، ');
  }"""
    if old_load_allergies in content:
        content = content.replace(old_load_allergies, new_load_allergies)

    # 2. Update saveEditPatient
    old_save_allergies = """  const allergies = document.getElementById('epAllergies').value.trim().split(/[،,]/).map(s => s.trim()).filter(Boolean);
  const chronic = document.getElementById('epChronic').value.trim().split(/[،,]/).map(s => s.trim()).filter(Boolean);"""
    
    new_save_allergies = """  const allergies = document.getElementById('epAllergies').value.trim().split(/[،,]/).map(s => s.trim()).filter(Boolean);
  const chronic = document.getElementById('epChronic').value.trim().split(/[،,]/).map(s => s.trim()).filter(Boolean);
  
  // Wave 2 Diffing
  let finalAllergies = allergies;
  let finalChronic = chronic;
  let summaryVersion = 1;

  if (window.ArgonClinicalParser && window.ARGON_FEATURES.ENABLE_CLINICAL_VERSIONING) {
    summaryVersion = 2;
    const session = ArgonSession.get() || {};
    const nowIso = new Date().toISOString();

    const diffClinical = (oldArray, newStrings) => {
      const currentList = ArgonClinicalParser.getClinicalList(oldInfo, oldArray);
      const newValues = new Set(newStrings);
      
      // 1. Mark missing as revoked
      currentList.forEach(item => {
        if (item.status === 'active' && !newValues.has(item.value)) {
          item.status = 'revoked';
          item.revokedBy = session.staffId || 'unknown';
          item.revokedAt = nowIso;
          item.reason = 'Removed via text input';
        }
      });

      // 2. Add new values
      const existingValues = new Set(currentList.filter(i => i.status === 'active').map(i => i.value));
      newStrings.forEach(val => {
        if (!existingValues.has(val)) {
          currentList.push({
            entryId: 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2,5),
            schemaVersion: 2,
            sourceType: 'doctor_entry',
            value: val,
            status: 'active',
            addedBy: session.staffId || 'unknown',
            addedAt: nowIso
          });
        }
      });
      return currentList;
    };

    finalAllergies = diffClinical('allergies', allergies);
    finalChronic = diffClinical('chronicDiseases', chronic);
  }"""
    if old_save_allergies in content:
        content = content.replace(old_save_allergies, new_save_allergies)

    old_updates_save = """    allergies: allergies.length ? allergies : null,
    chronicDiseases: chronic.length ? chronic : null,"""
    new_updates_save = """    allergies: finalAllergies.length ? finalAllergies : null,
    chronicDiseases: finalChronic.length ? finalChronic : null,
    clinicalSummaryVersion: summaryVersion,"""
    if old_updates_save in content:
        content = content.replace(old_updates_save, new_updates_save)

    # 3. Update view rendering (HTML generation)
    old_view_html = """  const allergiesHTML = (info.allergies || []).map(a => `<span class="tag">${sanitize(a)}</span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';
  const chronicHTML = (info.chronicDiseases || []).map(a => `<span class="tag tag-danger">${sanitize(a)}</span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';"""
    
    new_view_html = """  let allergiesHTML = '';
  let chronicHTML = '';

  if (window.ArgonClinicalParser && window.ARGON_FEATURES.ENABLE_CLINICAL_VERSIONING) {
    const algList = ArgonClinicalParser.getClinicalList(info, 'allergies');
    const chrList = ArgonClinicalParser.getClinicalList(info, 'chronicDiseases');

    allergiesHTML = algList.filter(a => a.status === 'active').map(a => `<span class="tag" title="Added by: ${sanitize(a.addedBy || 'Legacy')}">${sanitize(a.value)}</span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';
    chronicHTML = chrList.filter(a => a.status === 'active').map(a => `<span class="tag tag-danger" title="Added by: ${sanitize(a.addedBy || 'Legacy')}">${sanitize(a.value)}</span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';
    
    // Render revoked items as strike-through
    const revokedAlg = algList.filter(a => a.status === 'revoked');
    if (revokedAlg.length > 0) {
       allergiesHTML += `<br><span style="font-size:10px; color:#94a3b8">أبطلت: ` + revokedAlg.map(a => `<span style="text-decoration:line-through" title="Revoked by: ${sanitize(a.revokedBy)} - ${sanitize(a.reason)}">${sanitize(a.value)}</span>`).join(', ') + `</span>`;
    }
  } else {
    allergiesHTML = (info.allergies || []).map(a => `<span class="tag">${sanitize(a)}</span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';
    chronicHTML = (info.chronicDiseases || []).map(a => `<span class="tag tag-danger">${sanitize(a)}</span>`).join('') || '<span style="color:var(--muted)">لا يوجد</span>';
  }"""
    if old_view_html in content:
        content = content.replace(old_view_html, new_view_html)
        
    # 4. Break Glass logic in viewPatientFile
    target_lock = """if (!isAdmin && lockData.doctorId !== loggedInDoctorId) {"""
    new_lock = """if (!isAdmin && lockData.doctorId !== loggedInDoctorId) {
        // Break Glass Check
        if (window.ARGON_FEATURES && window.ARGON_FEATURES.ENABLE_BREAK_GLASS) {
          const isEmergencyGranted = lockData.emergencyGrants && lockData.emergencyGrants[loggedInDoctorId] && (Date.now() < lockData.emergencyGrants[loggedInDoctorId].expiresAt);
          if (isEmergencyGranted) {
             toast('🚨 تنبيه: تم الدخول بوضع الطوارئ. جميع الإجراءات مراقبة.', 'warn');
             return; // allow execution to continue by not returning early here, wait, we want to allow execution. So we DON'T return! 
             // Wait, if isEmergencyGranted is true, we should skip the lock check.
          }
        }"""
        
    old_lock_block = """      if (!isAdmin && lockData.doctorId !== loggedInDoctorId) {
        toast(`الملف الطبي مفتوح لتعديله بواسطة ${lockData.doctorName}`, 'err');
        if (window.AuditAPI) window.AuditAPI.log('PATIENT_FILE_LOCKED_CONFLICT', { patientId: uid, lockedBy: lockData.doctorId });
        return;
      }"""
      
    new_lock_block = """      if (!isAdmin && lockData.doctorId !== loggedInDoctorId) {
        let isEmergencyGranted = false;
        if (window.ARGON_FEATURES && window.ARGON_FEATURES.ENABLE_BREAK_GLASS) {
           const grant = lockData.emergencyGrants ? lockData.emergencyGrants[loggedInDoctorId] : null;
           if (grant && Date.now() < grant.expiresAt) {
              isEmergencyGranted = true;
           }
        }
        
        if (!isEmergencyGranted) {
          toast(`الملف الطبي مفتوح لتعديله بواسطة ${lockData.doctorName}`, 'err');
          
          if (window.ARGON_FEATURES && window.ARGON_FEATURES.ENABLE_BREAK_GLASS) {
             // Show Break Glass Button in UI
             const tl = document.getElementById('timelineList');
             if (tl) tl.innerHTML = `<div style="text-align:center; padding: 40px;"><p>الملف مقفل بواسطة ${lockData.doctorName}</p><button class="btn-primary" onclick="requestBreakGlass('${uid}')" style="background:#dc2626; border-color:#b91c1c;">🚨 تفعيل وصول الطوارئ (Break Glass)</button></div>`;
          }
          
          if (window.AuditAPI) window.AuditAPI.log('PATIENT_FILE_LOCKED_CONFLICT', { patientId: uid, lockedBy: lockData.doctorId });
          return;
        } else {
          toast('🚨 تم الدخول بوضع الطوارئ.', 'warn');
        }
      }"""
      
    if old_lock_block in content:
         content = content.replace(old_lock_block, new_lock_block)
         
    break_glass_fn = """// ── Break Glass Access ──
window.requestBreakGlass = async function(uid) {
  const reason = prompt('⚠️ وصول الطوارئ مراقب بالكامل. الرجاء إدخال سبب الدخول الطارئ (إلزامي):');
  if (!reason || reason.trim().length < 5) {
     toast('❌ سبب غير كافٍ. تم إلغاء العملية.', 'err');
     return;
  }
  
  const session = ArgonSession.get() || {};
  const lockRef = db.ref(`${BASE}/active_sessions/${uid}`);
  const lockSnap = await lockRef.once('value');
  
  if (lockSnap.exists()) {
     const updates = {};
     updates[`emergencyGrants/${session.staffId}`] = {
        reason: reason.trim(),
        grantedAt: firebase.database.ServerValue.TIMESTAMP,
        expiresAt: Date.now() + (30 * 60 * 1000) // 30 mins
     };
     
     await lockRef.update(updates);
     
     if (window.ArgonAuditLog) {
        window.ArgonAuditLog.log('PATIENT', uid, 'BREAK_GLASS', null, { reason: reason }, 'Emergency Override');
     }
     
     toast('✅ تم منح وصول الطوارئ لمدة 30 دقيقة.', 'ok');
     viewPatientFile(uid);
  }
};
"""
    if "window.requestBreakGlass" not in content:
        content += break_glass_fn


    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done patching emr-app.js for Wave 2")

if __name__ == '__main__':
    patch_emr_wave2()
