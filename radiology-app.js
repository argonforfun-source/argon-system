/**
 * ARGON MEDICAL OS — Radiology Engine v4.0
 * Manages radiology catalog, image uploads, and queues
 */

let CID = null;
let CSETTINGS = null;

document.addEventListener('DOMContentLoaded', async () => {
    const pageData = await ArgonMedical.Page.init({
        requireSession: true,
        requiredRole: 'radiology',
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
    ArgonMedical.DB.ref(`clinics/${CID}/radiology_catalog`).on('value', snap => {
        catalog = snap.val() || {};
        renderCatalog();
    });
}

function renderCatalog() {
    const tbody = document.getElementById('catTbody');
    const list = Object.entries(catalog);
    
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">لا يوجد صور أشعة مسجلة</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(([id, t]) => `
        <tr>
            <td><strong>${t.name}</strong><br><small style="color:var(--muted)">${t.type || ''}</small></td>
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
    document.getElementById('tstType').value = 'X-Ray';
    document.getElementById('tstPrice').value = '';
    document.getElementById('tstModal').classList.add('open');
}

function editTest(id) {
    const t = catalog[id];
    if (!t) return;
    document.getElementById('tstId').value = id;
    document.getElementById('tstName').value = t.name;
    document.getElementById('tstType').value = t.type || 'X-Ray';
    document.getElementById('tstPrice').value = t.price || '';
    document.getElementById('tstModal').classList.add('open');
}

async function saveTest() {
    const id = document.getElementById('tstId').value;
    const name = document.getElementById('tstName').value.trim();
    if (!name) return ArgonMedical.UI.toast('اسم الصورة مطلوب', 'err');

    const data = {
        name,
        type: document.getElementById('tstType').value,
        price: parseFloat(document.getElementById('tstPrice').value) || 0
    };

    try {
        if (id) await ArgonMedical.DB.ref(`clinics/${CID}/radiology_catalog/${id}`).update(data);
        else await ArgonMedical.DB.ref(`clinics/${CID}/radiology_catalog`).push(data);
        ArgonMedical.UI.toast('تم الحفظ بنجاح', 'ok');
        closeModal('tstModal');
    } catch(e) { ArgonMedical.UI.toast('خطأ في الحفظ', 'err'); }
}

function deleteTest(id) {
    if(confirm('حذف؟')) ArgonMedical.DB.ref(`clinics/${CID}/radiology_catalog/${id}`).remove();
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
    const list = Object.entries(appointments).filter(x => x[1].status === 'in_radiology');
    
    const badge = document.getElementById('qBadge');
    if (list.length) { badge.textContent = list.length; badge.classList.add('show'); }
    else { badge.classList.remove('show'); }

    if (!list.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">لا يوجد مرضى في قسم الأشعة حالياً</div>';
        return;
    }

    grid.innerHTML = list.map(([id, a]) => {
        const p = patients[a.patientId] || {};
        return `
        <div class="rx-card pending">
            <div class="rx-head">
                <div><div class="rx-pt">${p.name || 'مريض'}</div><div class="rx-time">موعد: ${a.time}</div></div>
                <div class="badge pending">بانتظار التصوير</div>
            </div>
            <div class="rx-foot">
                <button class="btn btn-primary" onclick="openResultsModal('${id}', '${a.patientId}')"><i class="fas fa-camera"></i> رفع الصور والتقرير</button>
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
    
    const sel = document.getElementById('resTestSelect');
    sel.innerHTML = '<option value="">-- اختر نوع الصورة --</option>' + 
        Object.entries(catalog).map(([id, t]) => `<option value="${id}">${t.name} (${t.type || ''})</option>`).join('');
    
    document.getElementById('resReport').value = '';
    // Reset file input text
    document.getElementById('fileStatus').innerHTML = '<i class="fas fa-cloud-upload-alt"></i><br>اضغط لاختيار صورة الأشعة (JPG, PNG)';
    
    document.getElementById('resModal').classList.add('open');
}

// Mock Image Compression
async function handleImageUpload(el) {
    if(!el.files.length) return;
    const stat = document.getElementById('fileStatus');
    stat.innerHTML = '<i class="fas fa-spinner fa-spin"></i><br>جاري الضغط والرفع...';
    
    try {
        const compressed = await ArgonMedical.ImageCompressor.compress(el.files[0], 800, 0.7);
        // Storing directly as base64 in Firebase DB for MVP purposes.
        // In real app, this goes to Firebase Storage and we save URL.
        stat.dataset.b64 = compressed;
        stat.innerHTML = '<i class="fas fa-check" style="color:var(--green)"></i><br>تم رفع الصورة بنجاح';
    } catch(e) {
        stat.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--red)"></i><br>فشل الرفع';
    }
}

async function saveResults() {
    if(!currentResApt) return;
    
    const testId = document.getElementById('resTestSelect').value;
    const testName = testId ? catalog[testId]?.name : 'أشعة غير محددة';
    const report = document.getElementById('resReport').value.trim();
    const imgData = document.getElementById('fileStatus').dataset.b64 || '';

    if(!report && !imgData) { ArgonMedical.UI.toast('يرجى إرفاق تقرير أو صورة', 'err'); return; }

    const resData = {
        patientId: currentResPt,
        date: new Date().toISOString(),
        testName: testName,
        report: report,
        image: imgData,
        technician: 'قسم الأشعة'
    };

    try {
        await ArgonMedical.DB.ref(`clinics/${CID}/patients/${currentResPt}/radiology_results/${currentResApt}`).set(resData);
        
        const action = document.getElementById('resAction').value;
        const nextStatus = action === 'doctor' ? 'waiting' : 'completed';
        
        await ArgonMedical.DB.ref(`clinics/${CID}/appointments/${currentResApt}`).update({ status: nextStatus });
        
        if (action === 'doctor') {
            const apt = appointments[currentResApt];
            await ArgonMedical.DB.ref(`clinics/${CID}/waiting_room/${currentResApt}`).set({
                patientId: currentResPt, queueNum: apt.queueNum, time: apt.time, priority: 'high', addedAt: Date.now()
            });
        }

        if (CSETTINGS?.whatsapp?.enabled) {
            const p = patients[currentResPt];
            const msg = ArgonMedical.WhatsApp.buildMessage(
                CSETTINGS.whatsapp.templates?.RAD_READY || ArgonMedical.WhatsApp.TEMPLATES.RAD_READY,
                { patientName: p.name, clinicName: CSETTINGS.name, trackingUrl: window.location.origin + window.location.pathname.replace('radiology.html','patient-portal.html') + '?id=' + CID }
            );
            ArgonMedical.WhatsApp.queue(CID, { phone: p.phone, message: msg, type: 'radiology', patientId: currentResPt });
        }

        ArgonMedical.UI.toast('تم الحفظ', 'ok');
        closeModal('resModal');
    } catch(e) { ArgonMedical.UI.toast('خطأ في الحفظ', 'err'); }
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
