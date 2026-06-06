import os

def patch_critical_alerts():
    file_path = 'clinica-repo/emr.html'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    old_html = """    <div class="fg"><label>الأمراض المزمنة (مفصولة بفاصلة)</label><input class="fi" id="epChronic" placeholder="مثال: سكري، ضغط..."></div>"""
    
    new_html = """    <div class="fg"><label>الأمراض المزمنة (مفصولة بفاصلة)</label><input class="fi" id="epChronic" placeholder="مثال: سكري، ضغط..."></div>
    
    <div class="fg" style="border:1px solid #fee2e2; padding:10px; border-radius:8px; background:#fef2f2;">
      <label style="color:#dc2626; font-weight:bold;">⚠️ تنبيهات حرجة (Critical Alerts)</label>
      <div style="display:flex; gap:8px; margin-bottom:8px;">
         <input class="fi" id="epCriticalAlertName" placeholder="نوع التنبيه الحرج (مثال: حساسية بنسلين شديدة)...">
         <select class="fi" id="epCriticalAlertSeverity" style="width:120px;">
            <option value="">اختر الحدة</option>
            <option value="high">عالية (High)</option>
            <option value="medium">متوسطة (Med)</option>
         </select>
         <button class="btn-primary" type="button" onclick="addCriticalAlertUI()" style="background:#dc2626; border-color:#dc2626;">إضافة</button>
      </div>
      <div id="epCriticalAlertsList" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
    </div>"""

    if old_html in content:
        content = content.replace(old_html, new_html)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Patched emr.html")
    else:
        print("Not found or already patched")

def patch_app_alerts():
    file_path = 'clinica-repo/emr-app.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    js_code = """
window._tempCriticalAlerts = [];

window.addCriticalAlertUI = function() {
  const nameInput = document.getElementById('epCriticalAlertName');
  const severitySelect = document.getElementById('epCriticalAlertSeverity');
  const name = nameInput.value.trim();
  const severity = severitySelect.value;
  
  if (!name) return toast('الرجاء إدخال اسم التنبيه', 'err');
  if (!severity) return toast('الرجاء اختيار الحدة (Severity) - إجباري', 'err');
  
  window._tempCriticalAlerts.push({
    entryId: 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2,5),
    schemaVersion: 2,
    sourceType: 'doctor_entry',
    type: 'critical_alert',
    value: name,
    severity: severity,
    status: 'active',
    addedBy: (window.ArgonSession ? ArgonSession.get()?.staffId : null) || 'unknown',
    addedAt: new Date().toISOString()
  });
  
  nameInput.value = '';
  severitySelect.value = '';
  renderCriticalAlertsUI();
};

window.removeCriticalAlertUI = function(entryId) {
   const alert = window._tempCriticalAlerts.find(a => a.entryId === entryId);
   if (alert) {
      alert.status = 'revoked';
      alert.revokedBy = (window.ArgonSession ? ArgonSession.get()?.staffId : null) || 'unknown';
      alert.revokedAt = new Date().toISOString();
      alert.reason = 'Removed via UI';
   }
   renderCriticalAlertsUI();
};

window.renderCriticalAlertsUI = function() {
   const container = document.getElementById('epCriticalAlertsList');
   if (!container) return;
   
   container.innerHTML = window._tempCriticalAlerts.filter(a => a.status === 'active').map(a => `
      <span style="background:#fee2e2; color:#b91c1c; padding:4px 8px; border-radius:4px; font-size:0.8rem; display:flex; align-items:center; gap:6px;">
         <span>${a.value} (${a.severity})</span>
         <i class="fas fa-times" style="cursor:pointer" onclick="removeCriticalAlertUI('${a.entryId}')"></i>
      </span>
   `).join('');
};
"""
    if "window._tempCriticalAlerts" not in content:
        content += js_code

    # Also update load fields
    target_load = """document.getElementById('epChronic').value = ArgonClinicalParser.toLegacyText(chrList);"""
    new_load = """document.getElementById('epChronic').value = ArgonClinicalParser.toLegacyText(chrList);
    window._tempCriticalAlerts = ArgonClinicalParser.getClinicalList(p.info, 'criticalAlerts') || [];
    renderCriticalAlertsUI();"""
    if target_load in content and "renderCriticalAlertsUI();" not in content:
        content = content.replace(target_load, new_load)

    # And save fields
    target_save = """chronicDiseases: finalChronic.length ? finalChronic : null,"""
    new_save = """chronicDiseases: finalChronic.length ? finalChronic : null,
    criticalAlerts: window._tempCriticalAlerts.length ? window._tempCriticalAlerts : null,"""
    if target_save in content and "criticalAlerts: window._tempCriticalAlerts" not in content:
        content = content.replace(target_save, new_save)
        
    # Render in timeline patient info
    target_render = """<div class="pat-field" style="grid-column:span 1"><div class="pfl">الأمراض المزمنة</div><div>${chronicHTML}</div></div>"""
    new_render = """<div class="pat-field" style="grid-column:span 1"><div class="pfl">الأمراض المزمنة</div><div>${chronicHTML}</div></div>
    
    ${(info.criticalAlerts && info.criticalAlerts.length > 0) ? `
    <div class="pat-field" style="grid-column:span 2; background:#fef2f2; border:1px solid #fee2e2; border-radius:8px; margin-top:8px;">
       <div class="pfl" style="color:#dc2626; font-weight:bold;">⚠️ تنبيهات حرجة</div>
       <div style="margin-top:4px; display:flex; flex-direction:column; gap:4px;">
         ${info.criticalAlerts.filter(a => a.status === 'active').map(a => `<div style="color:#b91c1c; font-size:0.85rem;">• ${a.value} <span style="background:#dc2626; color:white; padding:1px 4px; border-radius:3px; font-size:0.7rem; margin-right:4px;">${a.severity}</span> <span style="color:#94a3b8; font-size:0.75rem; margin-right:6px;">(بواسطة ${a.addedBy})</span></div>`).join('')}
       </div>
    </div>
    ` : ''}"""
    if target_render in content and "تنبيهات حرجة" not in content:
        content = content.replace(target_render, new_render)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched emr-app.js for Critical Alerts")

if __name__ == '__main__':
    patch_critical_alerts()
    patch_app_alerts()
