/**
 * ARGON MEDICAL OS — Pharmacy Engine v4.0
 * Manages inventory, dispensing, and prescription queues
 */

let CID = null;
let CSETTINGS = null;

document.addEventListener('DOMContentLoaded', async () => {
    const pageData = await ArgonMedical.Page.init({
        requireSession: true,
        requiredRole: 'pharmacy',
        loginPage: 'login.html',
        onLicenseChange: (settings) => { CSETTINGS = settings; }
    });

    if (!pageData) return;
    CID = pageData.clinicId;
    CSETTINGS = pageData.settings;

    document.getElementById('clinicName').textContent = CSETTINGS.name || 'العيادة';

    loadInventory();
    loadPrescriptions();
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

// ── INVENTORY ──
let inventory = {};

function loadInventory() {
    ArgonMedical.DB.ref(`clinics/${CID}/pharmacy_inventory`).on('value', snap => {
        inventory = snap.val() || {};
        renderInventory();
    });
}

function renderInventory() {
    const tbody = document.getElementById('invTbody');
    const list = Object.entries(inventory);
    
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">لا يوجد أدوية في المخزون</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(([id, d]) => {
        let sc = 'high', st = 'متوفر';
        if (d.stock === 0) { sc = 'out'; st = 'نفذت الكمية'; }
        else if (d.stock < 10) { sc = 'low'; st = `قليل (${d.stock})`; }

        return `
        <tr>
            <td><strong>${d.name}</strong><br><small style="color:var(--muted)">${d.genericName || ''}</small></td>
            <td>${d.dose}</td>
            <td>${d.price ? d.price + ' JOD' : '—'}</td>
            <td><span class="stock-badge ${sc}">${st}</span></td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="editDrug('${id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline" style="color:var(--red)" onclick="deleteDrug('${id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `;}).join('');
}

function openAddDrug() {
    document.getElementById('drgId').value = '';
    document.getElementById('drgName').value = '';
    document.getElementById('drgGeneric').value = '';
    document.getElementById('drgDose').value = '';
    document.getElementById('drgStock').value = '';
    document.getElementById('drgPrice').value = '';
    document.getElementById('drgModal').classList.add('open');
}

function editDrug(id) {
    const d = inventory[id];
    if (!d) return;
    document.getElementById('drgId').value = id;
    document.getElementById('drgName').value = d.name;
    document.getElementById('drgGeneric').value = d.genericName || '';
    document.getElementById('drgDose').value = d.dose || '';
    document.getElementById('drgStock').value = d.stock || 0;
    document.getElementById('drgPrice').value = d.price || '';
    document.getElementById('drgModal').classList.add('open');
}

async function saveDrug() {
    const id = document.getElementById('drgId').value;
    const name = document.getElementById('drgName').value.trim();
    const data = {
        name,
        genericName: document.getElementById('drgGeneric').value.trim(),
        dose: document.getElementById('drgDose').value.trim(),
        stock: parseInt(document.getElementById('drgStock').value) || 0,
        price: parseFloat(document.getElementById('drgPrice').value) || 0
    };

    if (!name) return ArgonMedical.UI.toast('اسم الدواء مطلوب', 'err');

    try {
        if (id) await ArgonMedical.DB.ref(`clinics/${CID}/pharmacy_inventory/${id}`).update(data);
        else await ArgonMedical.DB.ref(`clinics/${CID}/pharmacy_inventory`).push(data);
        ArgonMedical.UI.toast('تم حفظ الدواء بنجاح', 'ok');
        closeModal('drgModal');
    } catch(e) { ArgonMedical.UI.toast('خطأ في الحفظ', 'err'); }
}

function deleteDrug(id) {
    if(confirm('هل أنت متأكد من حذف الدواء؟')) {
        ArgonMedical.DB.ref(`clinics/${CID}/pharmacy_inventory/${id}`).remove()
            .then(() => ArgonMedical.UI.toast('تم الحذف', 'ok'));
    }
}

// ── PRESCRIPTIONS QUEUE ──
let rxQueue = {};
let patients = {};

function loadPrescriptions() {
    ArgonMedical.DB.ref(`clinics/${CID}/patients`).on('value', snap => {
        patients = snap.val() || {};
        renderQueue();
    });

    ArgonMedical.DB.ref(`clinics/${CID}/prescriptions`).on('value', snap => {
        rxQueue = snap.val() || {};
        renderQueue();
    });
}

function renderQueue() {
    const grid = document.getElementById('rxGrid');
    const list = Object.entries(rxQueue).filter(x => x[1].status === 'pending');
    
    // Update badge
    const badge = document.getElementById('qBadge');
    if (list.length) { badge.textContent = list.length; badge.classList.add('show'); }
    else { badge.classList.remove('show'); }

    if (!list.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">لا يوجد وصفات قيد الانتظار</div>';
        return;
    }

    grid.innerHTML = list.map(([aptId, rx]) => {
        const p = patients[rx.patientId] || {};
        const time = new Date(rx.date).toLocaleTimeString('ar-JO', {hour:'2-digit', minute:'2-digit'});
        
        const itemsHtml = (rx.items || []).map(i => `
            <div class="rx-item">
                <div><strong>${i.name}</strong> ${i.isExternal ? '<span style="color:var(--orange);font-size:10px">(خارجي)</span>' : ''}<br><span style="color:var(--muted)">${i.dose} - ${i.freq}</span></div>
            </div>
        `).join('');

        return `
        <div class="rx-card pending">
            <div class="rx-head">
                <div><div class="rx-pt">${p.name || 'مريض'}</div><div class="rx-time">${time}</div></div>
                <div class="stock-badge low">قيد التجهيز</div>
            </div>
            <div class="rx-items">${itemsHtml}</div>
            <div class="rx-foot">
                <button class="btn btn-primary" onclick="dispenseRx('${aptId}', '${rx.patientId}')"><i class="fas fa-check"></i> صرف وتجهيز</button>
            </div>
        </div>
        `;
    }).join('');
}

async function dispenseRx(aptId, ptId) {
    if(!confirm('هل أنت متأكد من صرف الدواء؟ سيتم خصم الكميات من المخزون')) return;

    try {
        const rx = rxQueue[aptId];
        
        // 1. Update Status
        await ArgonMedical.DB.ref(`clinics/${CID}/prescriptions/${aptId}`).update({ status: 'completed' });
        await ArgonMedical.DB.ref(`clinics/${CID}/appointments/${aptId}`).update({ status: 'completed' });

        // 2. Deduct from inventory (Basic implementation - matches by name. In production, EMR should save drug ID)
        for (const item of (rx.items || [])) {
            if (item.isExternal) continue;
            // Find in inventory
            const match = Object.entries(inventory).find(x => x[1].name === item.name);
            if (match) {
                const newStock = Math.max(0, match[1].stock - 1);
                await ArgonMedical.DB.ref(`clinics/${CID}/pharmacy_inventory/${match[0]}`).update({ stock: newStock });
            }
        }

        // 3. WhatsApp Notification
        if (CSETTINGS?.whatsapp?.enabled) {
            const p = patients[ptId];
            const msg = ArgonMedical.WhatsApp.buildMessage(
                CSETTINGS.whatsapp.templates?.DRUG_READY || ArgonMedical.WhatsApp.TEMPLATES.DRUG_READY,
                { patientName: p.name, clinicName: CSETTINGS.name }
            );
            ArgonMedical.WhatsApp.queue(CID, { phone: p.phone, message: msg, type: 'pharmacy', patientId: ptId, appointmentId: aptId });
        }

        ArgonMedical.UI.toast('تم صرف الوصفة بنجاح وإشعار المريض', 'ok');

    } catch(e) { ArgonMedical.UI.toast('حدث خطأ', 'err'); }
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
