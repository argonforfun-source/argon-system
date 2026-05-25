/**
 * ARGON MEDICAL OS — Lab Engine v4.0
 * Manages lab tests catalog, result entry, and queues
 */

let CID = null;
let CSETTINGS = null;

document.addEventListener('DOMContentLoaded', async () => {
    const pageData = await ArgonMedical.Page.init({
        requireSession: true,
        requiredRole: 'lab',
        loginPage: 'login.html',
        onLicenseChange: (settings) => { CSETTINGS = settings; }
    });

    if (!pageData) return;
    CID = pageData.clinicId;
    CSETTINGS = pageData.settings;

    document.getElementById('clinicName').textContent = CSETTINGS.name || 'العيادة';

    loadCatalog();
    loadQueue();
    switchTab('queue');
});

function switchTab(tabId) {
    document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[onclick="switchTab('${tabId}')"]`).classList.add('active');
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.add('active');
}

function logout() {
    ArgonMedical.Session.clear();
    window.location.href = 'login.html';
}

// ── CATALOG ──
let catalog = {};

function loadCatalog() {
    ArgonMedical.DB.ref(`clinics/${CID}/lab_catalog`).on('value', snap => {
        catalog = snap.val() || {};
        renderCatalog();
    });
}

function renderCatalog() {
    const tbody = document.getElementById('catTbody');
    const list = Object.entries(catalog);
    
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">لا يوجد فحوصات مسجلة</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(([id, t]) => `
        <tr>
            <td><strong>${t.name}</strong><br><small style="color:var(--muted)">${t.code || ''}</small></td>
            <td dir="ltr" style="text-align:right">${t.normalRange || '—'} ${t.unit || ''}</td>
            <td>${t.price ? t.price + ' JOD' : '—'}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="editTest('${id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline" style="color:var(--red)" onclick="deleteTest('${id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openAddTest() {
    document.getElementById('tstId').value = '';
    document.getElementById('tstName').value = '';
    document.getElementById('tstCode').value = '';
    document.getElementById('tstRange').value = '';
    document.getElementById('tstUnit').value = '';
    document.getElementById('tstPrice').value = '';
    document.getElementById('tstModal').classList.add('open');
}

function editTest(id) {
    const t = catalog[id];
    if (!t) return;
    document.getElementById('tstId').value = id;
    document.getElementById('tstName').value = t.name;
    document.getElementById('tstCode').value = t.code || '';
    document.getElementById('tstRange').value = t.normalRange || '';
    document.getElementById('tstUnit').value = t.unit || '';
    document.getElementById('tstPrice').value = t.price || '';
    document.getElementById('tstModal').classList.add('open');
}

async function saveTest() {
    const id = document.getElementById('tstId').value;
    const name = document.getElementById('tstName').value.trim();
    if (!name) return ArgonMedical.UI.toast('اسم الفحص مطلوب', 'err');

    const data = {
        name,
        code: document.getElementById('tstCode').value.trim(),
        normalRange: document.getElementById('tstRange').value.trim(),
        unit: document.getElementById('tstUnit').value.trim(),
        price: parseFloat(document.getElementById('tstPrice').value) || 0
    };

    try {
        if (id) await ArgonMedical.DB.ref(`clinics/${CID}/lab_catalog/${id}`).update(data);
        else await ArgonMedical.DB.ref(`clinics/${CID}/lab_catalog`).push(data);
        ArgonMedical.UI.toast('تم الحفظ بنجاح', 'ok');
        closeModal('tstModal');
    } catch(e) { ArgonMedical.UI.toast('خطأ في الحفظ', 'err'); }
}

function deleteTest(id) {
    if(confirm('حذف الفحص؟')) ArgonMedical.DB.ref(`clinics/${CID}/lab_catalog/${id}`).remove();
}

// ── QUEUE & RESULTS ──
let appointments = {};
let patients = {};

function loadQueue() {
    ArgonMedical.DB.ref(`clinics/${CID}/patients`).on('value', snap => {
        patients = snap.val() || {};
        renderQueue();
    });

    ArgonMedical.DB.ref(`clinics/${CID}/appointments`).on('value', snap => {
        appointments = snap.val() || {};
        renderQueue();
    });
}

function renderQueue() {
    const grid = document.getElementById('rxGrid');
    const list = Object.entries(appointments).filter(x => x[1].status === 'in_lab');
    
    const badge = document.getElementById('qBadge');
    if (list.length) { badge.textContent = list.length; badge.classList.add('show'); }
    else { badge.classList.remove('show'); }

    if (!list.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">لا يوجد مرضى في المختبر حالياً</div>';
        return;
    }

    grid.innerHTML = list.map(([id, a]) => {
        const p = patients[a.patientId] || {};
        return `
        <div class="rx-card pending">
            <div class="rx-head">
                <div><div class="rx-pt">${p.name || 'مريض'}</div><div class="rx-time">موعد: ${a.time}</div></div>
                <div class="badge pending">بانتظار السحب/النتائج</div>
            </div>
            <div class="rx-foot">
                <button class="btn btn-primary" onclick="openResultsModal('${id}', '${a.patientId}')"><i class="fas fa-microscope"></i> إدخال النتائج</button>
            </div>
        </div>
        `;
    }).join('');
}

let currentResApt = null;
let currentResPt = null;

function openResultsModal(aptId, ptId) {
    currentResApt = aptId;
    currentResPt = ptId;
    const p = patients[ptId];
    
    document.getElementById('resPtName').textContent = p.name;
    
    // Render dynamic select for tests
    const sel = document.getElementById('resTestSelect');
    sel.innerHTML = '<option value="">-- اختر الفحص --</option>' + 
        Object.entries(catalog).map(([id, t]) => `<option value="${id}">${t.name} (${t.code || ''})</option>`).join('');
    
    document.getElementById('activeResults').innerHTML = '';
    document.getElementById('resNotes').value = '';
    
    document.getElementById('resModal').classList.add('open');
}

function addResultRow() {
    const sel = document.getElementById('resTestSelect');
    const tId = sel.value;
    if(!tId) return;
    
    const t = catalog[tId];
    const div = document.createElement('div');
    div.className = 'result-item';
    div.dataset.tid = tId;
    div.dataset.tname = t.name;
    div.dataset.range = t.normalRange;
    div.dataset.unit = t.unit;
    
    div.innerHTML = `
        <div class="r-name">${t.name} <br><small style="color:var(--muted)">Range: ${t.normalRange||'-'} ${t.unit||''}</small></div>
        <div><input type="text" class="fi val-inp" placeholder="النتيجة" dir="ltr" style="padding:8px"></div>
        <div style="text-align:left"><button class="btn btn-outline btn-sm" style="color:var(--red);padding:6px 10px" onclick="this.parentElement.parentElement.remove()"><i class="fas fa-times"></i></button></div>
    `;
    document.getElementById('activeResults').appendChild(div);
    sel.value = '';
}

async function saveResults() {
    if(!currentResApt) return;
    
    const items = [];
    document.querySelectorAll('#activeResults .result-item').forEach(el => {
        items.push({
            testId: el.dataset.tid,
            testName: el.dataset.tname,
            normalRange: el.dataset.range,
            unit: el.dataset.unit,
            value: el.querySelector('.val-inp').value.trim()
        });
    });

    if(!items.length) { ArgonMedical.UI.toast('يرجى إضافة نتيجة واحدة على الأقل', 'err'); return; }

    const resData = {
        patientId: currentResPt,
        date: new Date().toISOString(),
        items: items,
        notes: document.getElementById('resNotes').value.trim(),
        technician: 'مختبر المركز'
    };

    try {
        // Save to patient lab history
        await ArgonMedical.DB.ref(`clinics/${CID}/patients/${currentResPt}/lab_results/${currentResApt}`).set(resData);
        
        // Return to doctor (push to waiting room) or complete
        const action = document.getElementById('resAction').value;
        const nextStatus = action === 'doctor' ? 'waiting' : 'completed';
        
        await ArgonMedical.DB.ref(`clinics/${CID}/appointments/${currentResApt}`).update({ status: nextStatus });
        
        if (action === 'doctor') {
            const apt = appointments[currentResApt];
            await ArgonMedical.DB.ref(`clinics/${CID}/waiting_room/${currentResApt}`).set({
                patientId: currentResPt, queueNum: apt.queueNum, time: apt.time, priority: 'high', addedAt: Date.now()
            });
        }

        // WhatsApp
        if (CSETTINGS?.whatsapp?.enabled) {
            const p = patients[currentResPt];
            const msg = ArgonMedical.WhatsApp.buildMessage(
                CSETTINGS.whatsapp.templates?.LAB_READY || ArgonMedical.WhatsApp.TEMPLATES.LAB_READY,
                { patientName: p.name, clinicName: CSETTINGS.name, trackingUrl: window.location.origin + window.location.pathname.replace('lab.html','patient-portal.html') + '?id=' + CID }
            );
            ArgonMedical.WhatsApp.queue(CID, { phone: p.phone, message: msg, type: 'lab', patientId: currentResPt });
        }

        ArgonMedical.UI.toast('تم حفظ النتائج', 'ok');
        closeModal('resModal');
    } catch(e) { ArgonMedical.UI.toast('خطأ في الحفظ', 'err'); }
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
