/**
 * ARGON MEDICAL OS — Dashboard Engine v4.0
 * Manages Reception, Patients, Appointments, Settings, and WhatsApp
 */

let CID = null;
let CSETTINGS = null;

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
    // Init page with Core engine (Requires session, admin role)
    const pageData = await ArgonMedical.Page.init({
        requireSession: true,
        requiredRole: 'admin',
        loginPage: 'login.html',
        onLicenseChange: (settings) => {
            CSETTINGS = settings;
            updateUI();
        }
    });

    if (!pageData) return; // Redirecting to login
    
    CID = pageData.clinicId;
    CSETTINGS = pageData.settings;
    
    // Setup UI
    document.getElementById('clinicName').textContent = CSETTINGS.name || 'العيادة';
    document.getElementById('clinicLogoText').textContent = (CSETTINGS.name || 'ع').charAt(0);
    if (CSETTINGS.color) {
        document.getElementById('clinicLogo').style.background = `linear-gradient(135deg, ${CSETTINGS.color}, ${CSETTINGS.color}cc)`;
    }

    // Load initial data
    switchTab('reception');
    loadStats();
    loadAppointments();
    loadPatients();
    loadSettings();
    if (ArgonMedical.License.hasFeature(ArgonMedical.FEATURES.WHATSAPP_AUTO)) {
        loadWhatsAppConfig();
    }
});

// ── NAVIGATION ──
function switchTab(tabId) {
    document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
    const tabBtn = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    if (tabBtn) tabBtn.classList.add('active');

    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.add('active');

    const titles = {
        'reception': 'لوحة الاستقبال',
        'patients': 'إدارة المرضى',
        'appointments': 'المواعيد والحجوزات',
        'whatsapp': 'مركز إشعارات WhatsApp',
        'settings': 'إعدادات العيادة'
    };
    document.getElementById('topbarTitle').innerHTML = titles[tabId] || 'اللوحة';
}

function logout() {
    ArgonMedical.Session.clear();
    window.location.href = 'login.html';
}

// ── DATA LOADING ──
let patients = {};
let appointments = {};

function loadStats() {
    ArgonMedical.DB.ref(`clinics/${CID}/patients`).on('value', snap => {
        patients = snap.val() || {};
        document.getElementById('stat-patients').textContent = Object.keys(patients).length;
        renderPatientsTable();
    });

    const todayStr = new Date().toISOString().split('T')[0];
    ArgonMedical.DB.ref(`clinics/${CID}/appointments`).on('value', snap => {
        appointments = snap.val() || {};
        const apts = Object.values(appointments);
        
        // Count today's
        const todayApts = apts.filter(a => a.date === todayStr);
        document.getElementById('stat-today').textContent = todayApts.length;
        
        // Count waiting
        const waiting = todayApts.filter(a => a.status === 'waiting');
        document.getElementById('stat-waiting').textContent = waiting.length;

        renderAppointmentsTable();
        renderReceptionQueue(todayApts);
    });
}

function updateUI() {
    // Triggered when license or settings change remotely
    document.getElementById('clinicName').textContent = CSETTINGS.name || 'العيادة';
}

// ── RECEPTION & QUEUE ──
function renderReceptionQueue(todayApts) {
    const qList = document.getElementById('receptionQueue');
    const waiting = todayApts.filter(a => a.status === 'waiting' || a.status === 'in_doctor').sort((a,b) => a.queueNum - b.queueNum);
    
    if (!waiting.length) {
        qList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">لا يوجد مرضى في الانتظار</div>';
        return;
    }

    qList.innerHTML = waiting.map(a => {
        const p = patients[a.patientId] || {};
        const isDoc = a.status === 'in_doctor';
        return `
            <div class="q-item">
                <div class="q-num">${a.queueNum || '-'}</div>
                <div class="q-info">
                    <div class="q-name">${p.name || 'غير معروف'}</div>
                    <div class="q-time">${a.time || '—'} • ${p.phone || ''}</div>
                </div>
                <div class="q-status ${isDoc ? 'indoc' : 'waiting'}">
                    ${isDoc ? '👨‍⚕️ عند الطبيب' : '⏳ بالانتظار'}
                </div>
            </div>
        `;
    }).join('');
}

// ── PATIENTS ──
function renderPatientsTable() {
    const tbody = document.getElementById('patientsTbody');
    const list = Object.entries(patients).reverse();
    
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px">لا يوجد مرضى مسجلين</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(([id, p]) => `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td dir="ltr" style="text-align:right">${p.phone || '—'}</td>
            <td>${p.idNumber || '—'}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="editPatient('${id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-primary" onclick="newAppointmentFromPatient('${id}')"><i class="fas fa-calendar-plus"></i></button>
            </td>
        </tr>
    `).join('');
}

function openAddPatient() {
    document.getElementById('ptId').value = '';
    document.getElementById('ptName').value = '';
    document.getElementById('ptPhone').value = '';
    document.getElementById('ptIdNum').value = '';
    document.getElementById('ptModal').classList.add('open');
}

function editPatient(id) {
    const p = patients[id];
    if (!p) return;
    document.getElementById('ptId').value = id;
    document.getElementById('ptName').value = p.name || '';
    document.getElementById('ptPhone').value = p.phone || '';
    document.getElementById('ptIdNum').value = p.idNumber || '';
    document.getElementById('ptModal').classList.add('open');
}

async function savePatient() {
    const id = document.getElementById('ptId').value;
    const name = document.getElementById('ptName').value.trim();
    const phone = document.getElementById('ptPhone').value.trim();
    const idNumber = document.getElementById('ptIdNum').value.trim();

    if (!name || !phone) { ArgonMedical.UI.toast('الاسم ورقم الهاتف مطلوبان', 'err'); return; }

    const data = { name, phone, idNumber, updatedAt: new Date().toISOString() };

    try {
        if (id) {
            await ArgonMedical.DB.ref(`clinics/${CID}/patients/${id}`).update(data);
            ArgonMedical.UI.toast('تم تحديث بيانات المريض', 'ok');
        } else {
            data.createdAt = new Date().toISOString();
            await ArgonMedical.DB.ref(`clinics/${CID}/patients`).push(data);
            ArgonMedical.UI.toast('تم إضافة المريض بنجاح', 'ok');
        }
        closeModal('ptModal');
    } catch (e) {
        ArgonMedical.UI.toast('خطأ في الحفظ', 'err');
    }
}

// ── APPOINTMENTS ──
function renderAppointmentsTable() {
    const tbody = document.getElementById('aptsTbody');
    const list = Object.entries(appointments).sort((a,b) => new Date(b[1].date) - new Date(a[1].date));
    
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px">لا يوجد مواعيد</td></tr>';
        return;
    }

    const statuses = {
        'booked': { t: 'محجوز', c: 'var(--blue)' },
        'waiting': { t: 'بالانتظار', c: 'var(--orange)' },
        'in_doctor': { t: 'عند الطبيب', c: 'var(--teal)' },
        'completed': { t: 'مكتمل', c: 'var(--green)' },
        'cancelled': { t: 'ملغي', c: 'var(--red)' }
    };

    tbody.innerHTML = list.map(([id, a]) => {
        const p = patients[a.patientId] || { name: 'مريض محذوف' };
        const st = statuses[a.status] || statuses['booked'];
        return `
        <tr>
            <td><strong>${a.queueNum || '-'}</strong></td>
            <td>${p.name}</td>
            <td dir="ltr" style="text-align:right">${a.date} <br><small style="color:var(--muted)">${a.time}</small></td>
            <td><span class="t-badge" style="background:${st.c}22;color:${st.c}">${st.t}</span></td>
            <td>
                <select class="fi" style="width:120px;padding:6px;font-size:12px" onchange="updateAptStatus('${id}', this.value)">
                    <option value="booked" ${a.status==='booked'?'selected':''}>محجوز</option>
                    <option value="waiting" ${a.status==='waiting'?'selected':''}>وصول للانتظار</option>
                    <option value="completed" ${a.status==='completed'?'selected':''}>مكتمل</option>
                    <option value="cancelled" ${a.status==='cancelled'?'selected':''}>إلغاء</option>
                </select>
            </td>
        </tr>
    `;}).join('');
}

function openAddAppointment() {
    const sel = document.getElementById('aptPatient');
    sel.innerHTML = '<option value="">اختر مريض...</option>' + 
        Object.entries(patients).map(([id, p]) => `<option value="${id}">${p.name} - ${p.phone}</option>`).join('');
    
    document.getElementById('aptDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('aptModal').classList.add('open');
}

function newAppointmentFromPatient(ptId) {
    switchTab('appointments');
    openAddAppointment();
    setTimeout(() => { document.getElementById('aptPatient').value = ptId; }, 100);
}

async function saveAppointment() {
    const patientId = document.getElementById('aptPatient').value;
    const date = document.getElementById('aptDate').value;
    const time = document.getElementById('aptTime').value;
    const type = document.getElementById('aptType').value;

    if (!patientId || !date || !time) { ArgonMedical.UI.toast('يرجى تعبئة جميع الحقول', 'err'); return; }

    // Generate Queue Number for the day
    const dayApts = Object.values(appointments).filter(a => a.date === date);
    const queueNum = dayApts.length + 1;

    const data = {
        patientId, date, time, type,
        status: 'booked',
        queueNum,
        createdAt: new Date().toISOString()
    };

    try {
        const ref = await ArgonMedical.DB.ref(`clinics/${CID}/appointments`).push(data);
        ArgonMedical.UI.toast('تم حجز الموعد بنجاح', 'ok');
        closeModal('aptModal');

        // Queue WhatsApp Message if enabled
        if (CSETTINGS?.whatsapp?.enabled) {
            const p = patients[patientId];
            const msg = ArgonMedical.WhatsApp.buildMessage(
                CSETTINGS.whatsapp.templates?.BOOKING_CONFIRM || ArgonMedical.WhatsApp.TEMPLATES.BOOKING_CONFIRM,
                {
                    patientName: p.name,
                    clinicName: CSETTINGS.name,
                    date: date, time: time, queueNum: queueNum,
                    trackingUrl: `${getBase()}patient-portal.html?id=${CID}&apt=${ref.key}`
                }
            );
            ArgonMedical.WhatsApp.queue(CID, { phone: p.phone, message: msg, type: 'booking', patientId, appointmentId: ref.key });
        }
    } catch (e) {
        ArgonMedical.UI.toast('خطأ في الحجز', 'err');
    }
}

async function updateAptStatus(id, newStatus) {
    try {
        await ArgonMedical.DB.ref(`clinics/${CID}/appointments/${id}`).update({ status: newStatus, updatedAt: new Date().toISOString() });
        ArgonMedical.UI.toast('تم تحديث حالة الموعد', 'ok');
        
        // Push to waiting room real-time queue if set to waiting
        if (newStatus === 'waiting') {
            const a = appointments[id];
            await ArgonMedical.DB.ref(`clinics/${CID}/waiting_room/${id}`).set({
                patientId: a.patientId, queueNum: a.queueNum, time: a.time, priority: 'normal', addedAt: Date.now()
            });
        } else if (newStatus === 'completed' || newStatus === 'cancelled') {
            await ArgonMedical.DB.ref(`clinics/${CID}/waiting_room/${id}`).remove();
        }
    } catch(e) { ArgonMedical.UI.toast('خطأ بالتحديث', 'err'); }
}

// ── WHATSAPP CENTER ──
function loadWhatsAppConfig() {
    const wa = CSETTINGS.whatsapp || {};
    document.getElementById('waEnabled').checked = wa.enabled || false;
    document.getElementById('waNumber').value = wa.number || '';
    
    // Load Templates
    const tmpl = wa.templates || {};
    document.getElementById('tmplBooking').value = tmpl.BOOKING_CONFIRM || ArgonMedical.WhatsApp.TEMPLATES.BOOKING_CONFIRM;
    document.getElementById('tmplRemind').value = tmpl.REMINDER_30 || ArgonMedical.WhatsApp.TEMPLATES.REMINDER_30;
}

async function saveWhatsAppConfig() {
    const data = {
        enabled: document.getElementById('waEnabled').checked,
        number: document.getElementById('waNumber').value.trim(),
        templates: {
            BOOKING_CONFIRM: document.getElementById('tmplBooking').value.trim(),
            REMINDER_30: document.getElementById('tmplRemind').value.trim()
        }
    };
    try {
        await ArgonMedical.DB.ref(`clinics/${CID}/settings/whatsapp`).update(data);
        ArgonMedical.UI.toast('تم حفظ إعدادات WhatsApp', 'ok');
    } catch(e) { ArgonMedical.UI.toast('خطأ في الحفظ', 'err'); }
}

// ── SETTINGS ──
function loadSettings() {
    document.getElementById('setPhone').value = CSETTINGS.phone || '';
    document.getElementById('setAddr').value = CSETTINGS.address || '';
    document.getElementById('setOpen').value = CSETTINGS.openTime || '08:00';
    document.getElementById('setClose').value = CSETTINGS.closeTime || '22:00';
}

const settingsSaver = new ArgonMedical.AutoSave(`clinics/${CID}/settings`, 2000);
function autoSaveSettings() {
    settingsSaver.save({
        phone: document.getElementById('setPhone').value.trim(),
        address: document.getElementById('setAddr').value.trim(),
        openTime: document.getElementById('setOpen').value,
        closeTime: document.getElementById('setClose').value
    });
    ArgonMedical.UI.toast('جاري الحفظ التلقائي...', 'info', 1000);
}

// ── UTILS ──
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function getBase() { return window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1); }

// ── ENTERPRISE EXPORTS ──
async function exportPatientsExcel() {
    if (!ArgonEnterprise) return ArgonMedical.UI.toast('وحدة التصدير غير محملة', 'err');
    ArgonMedical.UI.toast('جاري تحضير ملف Excel...', 'info');
    
    const exportData = Object.entries(patients).map(([id, p]) => ({
        'اسم المريض': p.name || '',
        'رقم الهاتف': p.phone || '',
        'الرقم الوطني/الهوية': p.idNumber || '',
        'تاريخ الإضافة': p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-JO') : ''
    }));

    try {
        await ArgonEnterprise.Excel.exportTable(exportData, `Patients_${CSETTINGS.name.replace(/\s+/g,'_')}`);
        ArgonMedical.UI.toast('تم التصدير بنجاح', 'ok');
    } catch(e) {
        ArgonMedical.UI.toast('فشل التصدير', 'err');
    }
}

async function generateDemoInvoice() {
    if (!ArgonEnterprise) return ArgonMedical.UI.toast('وحدة التصدير غير محملة', 'err');
    ArgonMedical.UI.toast('جاري توليد الفاتورة (PDF)...', 'info');

    const pt = { name: 'مريض تجريبي', phone: '0790000000' };
    const items = [
        { name: 'كشفية طبيب عام', qty: 1, price: 20 },
        { name: 'تخطيط قلب ECG', qty: 1, price: 15 },
        { name: 'فحص دم شامل CBC', qty: 1, price: 10 }
    ];
    const total = 45;
    const invNo = 'INV-' + Math.floor(Math.random() * 10000);

    try {
        await ArgonEnterprise.PDF.generateInvoice(CSETTINGS, pt, items, total, invNo);
        ArgonMedical.UI.toast('تم توليد الفاتورة', 'ok');
    } catch(e) {
        ArgonMedical.UI.toast('فشل توليد الفاتورة', 'err');
    }
}
