/**
 * ARGON MEDICAL OS — EMR Engine v4.0
 * Doctor Workspace, Smart Prescription, Waiting Room
 */

let CID = null;
let CSETTINGS = null;
let currentAptId = null;
let currentPatientId = null;

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
    const pageData = await ArgonMedical.Page.init({
        requireSession: true,
        requiredRole: 'doctor', // also allow 'admin' fallback in real use
        loginPage: 'login.html',
        onLicenseChange: (settings) => {
            CSETTINGS = settings;
        }
    });

    if (!pageData) return;
    CID = pageData.clinicId;
    CSETTINGS = pageData.settings;

    // Build the Trie for prescriptions
    initPrescriptionEngine();

    // Start Listeners
    loadWaitingRoom();
});

// ── WAITING ROOM (Real-time) ──
let waitingList = {};
let patientsData = {};

function loadWaitingRoom() {
    // Use raw DB just for waiting_room list, but do NOT download all patients!
    ArgonMedical.DB.ref(`clinics/${CID}/waiting_room`).on('value', async snap => {
        waitingList = snap.val() || {};
        
        // Fetch only the needed patient identities via Enterprise API
        for (const apt of Object.values(waitingList)) {
            if (apt.patientId && !patientsData[apt.patientId]) {
                const pat = await ArgonMedical.PatientAPI.getIdentity(apt.patientId);
                if (pat) patientsData[apt.patientId] = pat;
            }
        }
        
        renderWaitingRoom();
    });
}

function renderWaitingRoom() {
    const listEl = document.getElementById('wrList');
    const q = Object.entries(waitingList).map(([id, data]) => ({ id, ...data }));
    
    // Sort by priority then time added
    q.sort((a,b) => {
        if(a.priority === 'high' && b.priority !== 'high') return -1;
        if(b.priority === 'high' && a.priority !== 'high') return 1;
        return a.addedAt - b.addedAt;
    });

    if (!q.length) {
        listEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px">لا يوجد مرضى في الانتظار</div>';
        return;
    }

    listEl.innerHTML = q.map(item => {
        const p = patientsData[item.patientId] || {};
        const isActive = item.id === currentAptId;
        const isDoc = item.status === 'in_doctor';
        return `
            <div class="wr-card ${isActive ? 'active' : ''}" onclick="selectPatient('${item.id}', '${item.patientId}')">
                <span class="wr-badge ${isDoc ? 'indoc' : 'waiting'}">${isDoc ? 'عند الطبيب' : 'بالانتظار'}</span>
                <div class="wr-num">${item.queueNum || '-'}</div>
                <div class="wr-name">${p.info?.name || 'غير معروف'}</div>
                <div class="wr-time"><i class="fas fa-clock"></i> موعد: ${item.time || '—'}</div>
            </div>
        `;
    }).join('');
}

async function selectPatient(aptId, ptId) {
    if (currentAptId) {
        if (!confirm('هل تريد تبديل المريض قبل إنهاء الزيارة الحالية؟ لم يتم الحفظ!')) return;
    }
    
    currentAptId = aptId;
    currentPatientId = ptId;
    
    // Update appointment status to in_doctor
    await ArgonMedical.DB.ref(`clinics/${CID}/appointments/${aptId}`).update({ status: 'in_doctor' });
    await ArgonMedical.DB.ref(`clinics/${CID}/waiting_room/${aptId}`).update({ status: 'in_doctor' });

    // Load Workspace UI
    const p = patientsData[ptId] || await ArgonMedical.PatientAPI.getIdentity(ptId);
    if (!p) { ArgonMedical.UI.toast('خطأ في تحميل بيانات المريض', 'err'); return; }
    
    document.getElementById('tbName').textContent = p.info?.name || 'غير معروف';
    document.getElementById('tbPhone').textContent = p.info?.phone || '—';
    document.getElementById('tbId').textContent = p.info?.nationalId || '—';
    document.getElementById('tbAvatar').textContent = (p.info?.name || '?').charAt(0);
    
    document.getElementById('emptyWs').style.display = 'none';
    document.getElementById('activeWs').style.display = 'flex';
    
    // Clear forms
    document.getElementById('vTemp').value = '';
    document.getElementById('vBp').value = '';
    document.getElementById('vHr').value = '';
    document.getElementById('vO2').value = '';
    document.getElementById('cDiag').value = '';
    document.getElementById('cNotes').value = '';
    
    prescriptions = [];
    renderPrescriptions();
    
    // Load patient medical history (allergies, etc.)
    loadMedicalHistory(ptId);
}

// ── MEDICAL HISTORY & ALLERGIES ──
let ptHistory = {};
async function loadMedicalHistory(ptId) {
    // Fetch full patient via Enterprise API to extract records (allergies, etc.)
    const p = await ArgonMedical.PatientAPI.getIdentity(ptId);
    ptHistory = p?.records?.medical_history || { allergies: [], chronic: [] };
    
    renderTags('allergyList', ptHistory.allergies, 'allergy');
    renderTags('chronicList', ptHistory.chronic, 'chronic');
}

function addTag(type) {
    const inp = document.getElementById(type === 'allergy' ? 'inpAllergy' : 'inpChronic');
    const val = inp.value.trim();
    if (!val) return;
    
    if (type === 'allergy') {
        if(!ptHistory.allergies) ptHistory.allergies = [];
        ptHistory.allergies.push(val);
        renderTags('allergyList', ptHistory.allergies, 'allergy');
    } else {
        if(!ptHistory.chronic) ptHistory.chronic = [];
        ptHistory.chronic.push(val);
        renderTags('chronicList', ptHistory.chronic, 'chronic');
    }
    inp.value = '';
    
    
    // Save via Enterprise API
    ArgonMedical.PatientAPI.getIdentity(currentPatientId).then(p => {
        if (p) {
            p.records = p.records || {};
            p.records.medical_history = ptHistory;
            ArgonMedical.PatientAPI.saveIdentity(currentPatientId, p);
            // Push audit event silently
            ArgonMedical.TimelineAPI.pushEvent(currentPatientId, 'PATIENT_EDITED', { action: 'added_medical_history_tag', tag: val });
        }
    });
}

function removeTag(type, idx) {
    if (type === 'allergy') ptHistory.allergies.splice(idx, 1);
    else ptHistory.chronic.splice(idx, 1);
    
    renderTags(type === 'allergy' ? 'allergyList' : 'chronicList', type === 'allergy' ? ptHistory.allergies : ptHistory.chronic, type);
    
    // Save via Enterprise API
    ArgonMedical.PatientAPI.getIdentity(currentPatientId).then(p => {
        if (p) {
            p.records = p.records || {};
            p.records.medical_history = ptHistory;
            ArgonMedical.PatientAPI.saveIdentity(currentPatientId, p);
            ArgonMedical.TimelineAPI.pushEvent(currentPatientId, 'PATIENT_EDITED', { action: 'removed_medical_history_tag' });
        }
    });
}

function renderTags(elId, list, type) {
    const el = document.getElementById(elId);
    if (!list || !list.length) { el.innerHTML = '<span style="font-size:12px;color:var(--muted)">لا يوجد</span>'; return; }
    
    el.innerHTML = list.map((t, i) => `
        <div class="tag" style="${type==='chronic' ? 'background:var(--orange-l);color:var(--orange)' : ''}">
            ${t} <button onclick="removeTag('${type}', ${i})"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

// ── SMART PRESCRIPTION ENGINE (Trie) ──
class TrieNode {
    constructor() { this.children = {}; this.isEndOfWord = false; this.data = null; }
}
class DrugTrie {
    constructor() { this.root = new TrieNode(); }
    insert(word, data) {
        let node = this.root;
        const w = word.toLowerCase();
        for (let char of w) {
            if (!node.children[char]) node.children[char] = new TrieNode();
            node = node.children[char];
        }
        node.isEndOfWord = true;
        node.data = data;
    }
    searchPrefix(prefix) {
        let node = this.root;
        const p = prefix.toLowerCase();
        for (let char of p) {
            if (!node.children[char]) return [];
            node = node.children[char];
        }
        return this._collectAllWords(node, p);
    }
    _collectAllWords(node, prefix) {
        let results = [];
        if (node.isEndOfWord) results.push({ name: prefix, ...node.data });
        for (let char in node.children) {
            results = results.concat(this._collectAllWords(node.children[char], prefix + char));
        }
        return results;
    }
}

const drugEngine = new DrugTrie();
let drugInventory = {};

function initPrescriptionEngine() {
    if (ArgonMedical.License.isComplex()) {
        // Load real pharmacy inventory
        ArgonMedical.DB.ref(`clinics/${CID}/pharmacy_inventory`).on('value', snap => {
            drugInventory = snap.val() || {};
            // Rebuild Trie
            drugEngine.root = new TrieNode();
            Object.entries(drugInventory).forEach(([id, d]) => {
                drugEngine.insert(d.name, { id, dose: d.dose, stock: d.stock || 0 });
                // Also insert generic name if exists
                if (d.genericName) drugEngine.insert(d.genericName, { id, dose: d.dose, stock: d.stock || 0, isGeneric: true });
            });
        });
    } else {
        // Single clinic: simple demo database
        const demoDrugs = [
            {name: 'Panadol', dose: '500mg', stock: 100}, {name: 'Amoxil', dose: '250mg', stock: 50},
            {name: 'Augmentin', dose: '1g', stock: 20}, {name: 'Aspirin', dose: '100mg', stock: 200},
            {name: 'Ibuprofen', dose: '400mg', stock: 80}, {name: 'Metformin', dose: '500mg', stock: 0},
            {name: 'Zinnat', dose: '500mg', stock: 5}, {name: 'بنادول', dose: '500mg', stock: 100}
        ];
        demoDrugs.forEach((d, i) => drugEngine.insert(d.name, { id: 'd'+i, dose: d.dose, stock: d.stock }));
    }
}

function searchDrug() {
    const q = document.getElementById('rxSearch').value.trim();
    const resEl = document.getElementById('rxResults');
    
    if (q.length < 2) { resEl.style.display = 'none'; return; }
    
    const results = drugEngine.searchPrefix(q).slice(0, 10); // Limit to 10
    
    if (!results.length) {
        // Allow manual add
        resEl.innerHTML = `
            <div class="rx-item" onclick="addPrescription('${q}', '', true)">
                <div>
                    <div class="rx-name">${q}</div>
                    <div class="rx-dose" style="color:var(--orange)">إضافة كدواء خارجي (غير موجود بالمخزون)</div>
                </div>
                <i class="fas fa-plus-circle" style="color:var(--teal)"></i>
            </div>
        `;
        resEl.style.display = 'block';
        return;
    }

    resEl.innerHTML = results.map(d => {
        let sc = 'high', st = 'متوفر';
        if (d.stock === 0) { sc = 'out'; st = 'نفذت الكمية'; }
        else if (d.stock < 10) { sc = 'low'; st = `قليل (${d.stock})`; }
        
        return `
            <div class="rx-item" onclick="addPrescription('${d.name}', '${d.dose}')">
                <div>
                    <div class="rx-name">${d.name} ${d.isGeneric ? '<span style="font-size:10px;color:var(--muted)">(Generic)</span>' : ''}</div>
                    <div class="rx-dose">${d.dose}</div>
                </div>
                <div class="rx-stock ${sc}">${st}</div>
            </div>
        `;
    }).join('');
    resEl.style.display = 'block';
}

// Close search results on click outside
document.addEventListener('click', e => {
    if(!e.target.closest('.rx-search-wrap')) document.getElementById('rxResults').style.display = 'none';
});

let prescriptions = [];

function addPrescription(name, dose, isExternal = false) {
    prescriptions.push({ name, dose, freq: 'مرتين يومياً', duration: '5 أيام', isExternal });
    document.getElementById('rxSearch').value = '';
    document.getElementById('rxResults').style.display = 'none';
    renderPrescriptions();
}

function removeRx(idx) {
    prescriptions.splice(idx, 1);
    renderPrescriptions();
}

function renderPrescriptions() {
    const tbody = document.getElementById('rxTbody');
    if (!prescriptions.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted)">لم يتم إضافة أدوية</td></tr>';
        return;
    }
    
    tbody.innerHTML = prescriptions.map((rx, i) => `
        <tr>
            <td><strong>${rx.name}</strong> ${rx.isExternal ? '<span style="font-size:10px;color:var(--orange)">(خارجي)</span>' : ''}</td>
            <td><input type="text" value="${rx.dose}" onchange="prescriptions[${i}].dose=this.value"></td>
            <td><input type="text" value="${rx.freq}" onchange="prescriptions[${i}].freq=this.value"></td>
            <td style="width:50px"><button class="btn btn-outline btn-sm" style="color:var(--red)" onclick="removeRx(${i})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

// ── SAVE ENCOUNTER ──
async function completeVisit(sendTo) {
    if (!currentAptId) return;
    
    const visitData = {
        patientId: currentPatientId,
        date: new Date().toISOString(),
        vitals: {
            temp: document.getElementById('vTemp').value,
            bp: document.getElementById('vBp').value,
            hr: document.getElementById('vHr').value,
            spo2: document.getElementById('vO2').value
        },
        diagnosis: document.getElementById('cDiag').value,
        notes: document.getElementById('cNotes').value,
        prescriptions: prescriptions
    };

    try {
        // Save visit to legacy node (via PatientAPI backwards-compat) AND new Timeline 
        const p = await ArgonMedical.PatientAPI.getIdentity(currentPatientId);
        if (p) {
            // Push Event-Sourced Immutable Record
            await ArgonMedical.TimelineAPI.pushEvent(currentPatientId, 'VISIT_CREATED', visitData);
            
            // For now, still append to legacy visits to not break the UI
            p.visits = p.visits || {};
            p.visits[currentAptId] = visitData;
            await ArgonMedical.PatientAPI.saveIdentity(currentPatientId, p);
        }
        
        // If complex, route prescriptions to pharmacy
        if (prescriptions.length && ArgonMedical.License.isComplex()) {
            await ArgonMedical.DB.ref(`clinics/${CID}/prescriptions/${currentAptId}`).set({
                patientId: currentPatientId,
                items: prescriptions,
                status: 'pending',
                date: new Date().toISOString()
            });
        }

        // Update Appointment status
        const nextStatus = sendTo === 'pharmacy' ? 'in_pharmacy' : (sendTo === 'lab' ? 'in_lab' : 'completed');
        await ArgonMedical.DB.ref(`clinics/${CID}/appointments/${currentAptId}`).update({ status: nextStatus });
        
        // Remove from waiting room
        await ArgonMedical.DB.ref(`clinics/${CID}/waiting_room/${currentAptId}`).remove();

        ArgonMedical.UI.toast('تم حفظ الزيارة بنجاح', 'ok');
        
        // Reset UI
        currentAptId = null;
        currentPatientId = null;
        document.getElementById('activeWs').style.display = 'none';
        document.getElementById('emptyWs').style.display = 'flex';

    } catch (e) {
        ArgonMedical.UI.toast('حدث خطأ أثناء الحفظ', 'err');
    }
}
