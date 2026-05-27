/**
 * ══════════════════════════════════════════════════════════════
 *  ARGON MEDICAL OS — Core Engine v1.0
 *  Shared module for ALL medical system pages
 *  Firebase | Sessions | License | Audit | Maintenance | Utils
 * ══════════════════════════════════════════════════════════════
 */

// ── Firebase Configuration (Single Source of Truth) ──
const ARGON_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCDT_H-1klxbtuVR5n5GOVHKlxcmvY_2GA",
    authDomain: "clinica-system-e71b9.firebaseapp.com",
    databaseURL: "https://clinica-system-e71b9-default-rtdb.firebaseio.com",
    projectId: "clinica-system-e71b9",
    storageBucket: "clinica-system-e71b9.firebasestorage.app",
    messagingSenderId: "833103541884",
    appId: "1:833103541884:web:f8ee6ca4b3d8400cf0fbf9"
};

// ── Initialize Firebase (idempotent) ──
if (!window._argonFirebaseInit) {
    firebase.initializeApp(ARGON_FIREBASE_CONFIG);
    window._argonFirebaseInit = true;
}
const argonDB = firebase.database();

// ══════════════════════════════════════════
//  CLINIC TYPES & FEATURES
// ══════════════════════════════════════════
const CLINIC_TYPES = {
    SINGLE: 'single',
    COMPLEX: 'complex'
};

const FEATURES = {
    // Single Clinic features
    RECEPTION: 'reception',
    EMR: 'emr',
    BOOKING: 'booking',
    PATIENT_PORTAL: 'patient_portal',
    PATIENT_FILES: 'patient_files',
    INVOICES_BASIC: 'invoices_basic',

    // Complex-only features
    PHARMACY: 'pharmacy',
    LAB: 'lab',
    RADIOLOGY: 'radiology',
    INTERNAL_REFERRALS: 'internal_referrals',
    WAITING_ROOMS: 'waiting_rooms',
    WHATSAPP_AUTO: 'whatsapp_auto',
    INVOICES_ADVANCED: 'invoices_advanced',
    DEPT_PASSWORDS: 'dept_passwords',
    NOTIFICATIONS_REALTIME: 'notifications_realtime'
};

const SINGLE_FEATURES = [
    FEATURES.RECEPTION, FEATURES.EMR, FEATURES.BOOKING,
    FEATURES.PATIENT_PORTAL, FEATURES.PATIENT_FILES, FEATURES.INVOICES_BASIC
];

const COMPLEX_FEATURES = [
    ...SINGLE_FEATURES,
    FEATURES.PHARMACY, FEATURES.LAB, FEATURES.RADIOLOGY,
    FEATURES.INTERNAL_REFERRALS, FEATURES.WAITING_ROOMS,
    FEATURES.WHATSAPP_AUTO, FEATURES.INVOICES_ADVANCED,
    FEATURES.DEPT_PASSWORDS, FEATURES.NOTIFICATIONS_REALTIME
];

// ══════════════════════════════════════════
//  SESSION MANAGER
// ══════════════════════════════════════════
const ArgonSession = {
    KEY: 'argon_medical_session',
    EXPIRY_MS: 4 * 3600000, // 4 hours

    create(clinicId, role, extra = {}) {
        const session = {
            clinicId,
            role, // 'admin' | 'doctor' | 'pharmacy' | 'lab' | 'radiology'
            ts: Date.now(),
            fp: this._fingerprint(),
            ...extra
        };
        try {
            localStorage.setItem(this.KEY, JSON.stringify(session));
        } catch (e) { console.warn('Session save failed:', e); }
        return session;
    },

    get() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return null;
            const s = JSON.parse(raw);
            if (Date.now() - s.ts > this.EXPIRY_MS) { this.clear(); return null; }
            if (s.fp !== this._fingerprint()) { this.clear(); return null; }
            return s;
        } catch (e) { this.clear(); return null; }
    },

    getClinicId() {
        const s = this.get();
        return s ? s.clinicId : null;
    },

    getRole() {
        const s = this.get();
        return s ? s.role : null;
    },

    isValid() { return this.get() !== null; },

    clear() {
        try { localStorage.removeItem(this.KEY); } catch (e) {}
    },

    refresh() {
        const s = this.get();
        if (s) { s.ts = Date.now(); localStorage.setItem(this.KEY, JSON.stringify(s)); }
    },

    _fingerprint() {
        const nav = window.navigator;
        return btoa((nav.userAgent || '').slice(0, 50) + (nav.language || '') + screen.width + 'x' + screen.height).slice(0, 24);
    }
};

// ══════════════════════════════════════════
//  LICENSE ENGINE
// ══════════════════════════════════════════
const ArgonLicense = {
    _cache: null,
    _clinicId: null,
    _listener: null,

    async load(clinicId) {
        this._clinicId = clinicId;
        return new Promise((resolve, reject) => {
            argonDB.ref(`clinics/${clinicId}/settings`).once('value', snap => {
                const val = snap.val();
                if (!val) { reject(new Error('Clinic not found')); return; }
                this._cache = val;
                resolve(val);
            }, reject);
        });
    },

    listen(clinicId, onChange) {
        this._clinicId = clinicId;
        if (this._listener) argonDB.ref(`clinics/${clinicId}/settings`).off('value', this._listener);
        this._listener = argonDB.ref(`clinics/${clinicId}/settings`).on('value', snap => {
            this._cache = snap.val() || {};
            if (onChange) onChange(this._cache);
        });
    },

    getType() {
        return (this._cache && this._cache.type) || CLINIC_TYPES.SINGLE;
    },

    isSingle() { return this.getType() === CLINIC_TYPES.SINGLE; },
    isComplex() { return this.getType() === CLINIC_TYPES.COMPLEX; },

    hasFeature(feature) {
        const type = this.getType();
        const features = type === CLINIC_TYPES.COMPLEX ? COMPLEX_FEATURES : SINGLE_FEATURES;
        return features.includes(feature);
    },

    isActive() {
        return this._cache && this._cache.status !== 'suspended' && this._cache.status !== 'maintenance';
    },

    isSuspended() {
        return this._cache && (this._cache.status === 'suspended' || this._cache.status === 'maintenance');
    },

    getStatus() {
        return (this._cache && this._cache.status) || 'active';
    },

    getSettings() { return this._cache || {}; },

    destroy() {
        if (this._listener && this._clinicId) {
            argonDB.ref(`clinics/${this._clinicId}/settings`).off('value', this._listener);
        }
        this._cache = null;
        this._listener = null;
    }
};

// ══════════════════════════════════════════
//  MAINTENANCE MODE DETECTOR
// ══════════════════════════════════════════
const ArgonMaintenance = {
    _listener: null,
    _overlayEl: null,

    /**
     * Start watching clinic status. If suspended/maintenance,
     * shows lockout overlay. If reactivated, removes it.
     * @param {string} clinicId
     * @param {object} options - { allowPatientPortal: false }
     */
    watch(clinicId, options = {}) {
        const ref = argonDB.ref(`clinics/${clinicId}/settings/status`);
        this._listener = ref.on('value', snap => {
            const status = snap.val();
            if (status === 'suspended' || status === 'maintenance') {
                if (!options.allowPatientPortal) {
                    this._showLockout(clinicId, status);
                }
            } else {
                this._hideLockout();
            }
        });
    },

    _showLockout(clinicId, status) {
        if (document.getElementById('argon-maintenance-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'argon-maintenance-overlay';
        overlay.innerHTML = `
            <style>
                #argon-maintenance-overlay {
                    position: fixed; inset: 0; z-index: 99999;
                    background: linear-gradient(160deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%);
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    text-align: center; padding: 40px; font-family: 'Tajawal', sans-serif;
                    animation: argon-maint-in 0.5s ease;
                }
                @keyframes argon-maint-in { from { opacity: 0; } to { opacity: 1; } }
                .maint-icon { font-size: 80px; margin-bottom: 24px; animation: maint-pulse 2s infinite; }
                @keyframes maint-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
                .maint-title { font-size: 28px; font-weight: 900; color: #0f172a; margin-bottom: 12px; }
                .maint-sub { font-size: 16px; color: #64748b; margin-bottom: 32px; max-width: 450px; line-height: 1.8; }
                .maint-badge { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2);
                    padding: 8px 20px; border-radius: 30px; font-size: 14px; font-weight: 700; }
                .maint-contact { margin-top: 28px; font-size: 13px; color: #94a3b8; }
            </style>
            <div class="maint-icon">🏥</div>
            <div class="maint-title">النظام متوقف حالياً</div>
            <div class="maint-sub">يتم حالياً إجراء صيانة على النظام أو تم إيقافه مؤقتاً من قبل الإدارة.<br>يرجى المحاولة لاحقاً.</div>
            <div class="maint-badge">⏸ ${status === 'maintenance' ? 'صيانة مجدولة' : 'النظام موقوف'}</div>
            <div class="maint-contact">للتواصل مع الدعم الفني: support@argon-os.com</div>
        `;
        document.body.appendChild(overlay);
        this._overlayEl = overlay;
    },

    _hideLockout() {
        const el = document.getElementById('argon-maintenance-overlay');
        if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }
    },

    stop(clinicId) {
        if (this._listener) {
            argonDB.ref(`clinics/${clinicId}/settings/status`).off('value', this._listener);
            this._listener = null;
        }
        this._hideLockout();
    }
};

// ══════════════════════════════════════════
//  AUDIT LOGGER
// ══════════════════════════════════════════
const ArgonAudit = {
    log(clinicId, action, details = {}) {
        if (!clinicId) return;
        const entry = {
            action,
            ts: Date.now(),
            iso: new Date().toISOString(),
            role: ArgonSession.getRole() || 'unknown',
            ua: (navigator.userAgent || '').slice(0, 100),
            screen: `${screen.width}x${screen.height}`,
            lang: navigator.language || '',
            ...details
        };
        argonDB.ref(`clinics/${clinicId}/audit_logs`).push(entry).catch(e => console.warn('Audit log failed:', e));
    }
};

// ══════════════════════════════════════════
//  BRUTE FORCE PROTECTION
// ══════════════════════════════════════════
const ArgonBruteForce = {
    KEY: 'argon_bf_state',
    MAX_ATTEMPTS: 5,
    LOCK_MS: 120000, // 2 minutes

    _load() {
        try { return JSON.parse(sessionStorage.getItem(this.KEY) || '{"a":0,"l":0}'); }
        catch (e) { return { a: 0, l: 0 }; }
    },

    _save(state) {
        try { sessionStorage.setItem(this.KEY, JSON.stringify(state)); } catch (e) {}
    },

    isLocked() {
        const s = this._load();
        return Date.now() < s.l;
    },

    getLockSeconds() {
        const s = this._load();
        return Math.max(0, Math.ceil((s.l - Date.now()) / 1000));
    },

    recordFailure() {
        const s = this._load();
        s.a++;
        if (s.a >= this.MAX_ATTEMPTS) s.l = Date.now() + this.LOCK_MS;
        this._save(s);
        return Math.max(0, this.MAX_ATTEMPTS - s.a);
    },

    reset() {
        sessionStorage.removeItem(this.KEY);
    }
};

// ══════════════════════════════════════════
//  OFFLINE QUEUE
// ══════════════════════════════════════════
const ArgonOfflineQueue = {
    KEY: 'argon_offline_queue',

    _load() {
        try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
        catch (e) { return []; }
    },

    _save(queue) {
        try { localStorage.setItem(this.KEY, JSON.stringify(queue)); } catch (e) {}
    },

    enqueue(path, data, method = 'set') {
        const queue = this._load();
        queue.push({ path, data, method, ts: Date.now() });
        this._save(queue);
    },

    async flush() {
        const queue = this._load();
        if (!queue.length) return;
        const remaining = [];
        for (const item of queue) {
            try {
                if (item.method === 'update') {
                    await argonDB.ref(item.path).update(item.data);
                } else if (item.method === 'push') {
                    await argonDB.ref(item.path).push(item.data);
                } else {
                    await argonDB.ref(item.path).set(item.data);
                }
            } catch (e) {
                remaining.push(item);
            }
        }
        this._save(remaining);
    }
};

// Auto-flush on reconnect
argonDB.ref('.info/connected').on('value', snap => {
    if (snap.val() === true) {
        ArgonOfflineQueue.flush();
    }
});

// ══════════════════════════════════════════
//  AUTO SAVE ENGINE
// ══════════════════════════════════════════
class ArgonAutoSave {
    constructor(path, debounceMs = 3000) {
        this.path = path;
        this.debounceMs = debounceMs;
        this._timer = null;
        this._lastData = null;
    }

    save(data) {
        this._lastData = data;
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(() => {
            if (this._lastData) {
                argonDB.ref(this.path).update(this._lastData).catch(e => {
                    ArgonOfflineQueue.enqueue(this.path, this._lastData, 'update');
                });
            }
        }, this.debounceMs);
    }

    flush() {
        if (this._timer) clearTimeout(this._timer);
        if (this._lastData) {
            argonDB.ref(this.path).update(this._lastData).catch(e => {
                ArgonOfflineQueue.enqueue(this.path, this._lastData, 'update');
            });
        }
    }

    destroy() {
        if (this._timer) clearTimeout(this._timer);
    }
}

// ══════════════════════════════════════════
//  SANITIZATION & VALIDATION
// ══════════════════════════════════════════
const ArgonSanitize = {
    text(s, maxLen = 300) {
        return String(s || '').replace(/[<>"'`\\]/g, '').trim().substring(0, maxLen);
    },
    id(s) {
        return /^[a-zA-Z0-9_\-\.]{1,50}$/.test(String(s).trim());
    },
    name(s) {
        const t = String(s).trim();
        return t.length >= 2 && t.length <= 150;
    },
    password(s) {
        const t = String(s).trim();
        return t.length >= 4 && t.length <= 100;
    },
    phone(s) {
        return /^[\+]?[0-9\s\-]{7,20}$/.test(String(s).trim());
    }
};

// ══════════════════════════════════════════
//  UI UTILITIES
// ══════════════════════════════════════════
const ArgonUI = {
    /**
     * Show a toast notification
     */
    toast(msg, type = 'info', duration = 3500) {
        let wrap = document.getElementById('argon-toast-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'argon-toast-wrap';
            wrap.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99998;display:flex;flex-direction:column;gap:8px;pointer-events:none;width:90%;max-width:400px;';
            document.body.appendChild(wrap);
        }
        const colors = {
            ok: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', color: '#10b981' },
            err: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', color: '#ef4444' },
            info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', color: '#3b82f6' },
            warn: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', color: '#f59e0b' }
        };
        const c = colors[type] || colors.info;
        const t = document.createElement('div');
        t.style.cssText = `background:${c.bg};border:1px solid ${c.border};color:${c.color};border-radius:14px;padding:12px 20px;font-size:14px;font-weight:700;font-family:'Tajawal',sans-serif;text-align:center;opacity:0;transform:translateY(-10px);transition:all 0.3s;backdrop-filter:blur(12px);`;
        t.textContent = msg;
        wrap.appendChild(t);
        requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
        setTimeout(() => {
            t.style.opacity = '0'; t.style.transform = 'translateY(-10px)';
            setTimeout(() => t.remove(), 300);
        }, duration);
    },

    /**
     * Apply license-based visibility to elements
     * Elements with data-feature="pharmacy" will be hidden if license doesn't include it
     */
    applyLicenseVisibility() {
        document.querySelectorAll('[data-feature]').forEach(el => {
            const feature = el.dataset.feature;
            el.style.display = ArgonLicense.hasFeature(feature) ? '' : 'none';
        });
        document.querySelectorAll('[data-clinic-type]').forEach(el => {
            const type = el.dataset.clinicType;
            const show = type === ArgonLicense.getType() || type === 'all';
            el.style.display = show ? '' : 'none';
        });
    },

    /**
     * Format date to Arabic-friendly string
     */
    formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('ar-JO', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        } catch (e) { return dateStr; }
    },

    formatTime(dateStr) {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleTimeString('ar-JO', {
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        } catch (e) { return dateStr; }
    },

    /**
     * Compress an image file before upload
     * @returns {Promise<string>} base64 data URL
     */
    compressImage(file, maxWidth = 800, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
};

// ══════════════════════════════════════════
//  WHATSAPP ENGINE (Deep Link + Queue)
// ══════════════════════════════════════════
const ArgonWhatsApp = {
    /**
     * Send a WhatsApp message via deep link
     */
    send(phone, message) {
        const cleanPhone = String(phone).replace(/[\s\-\+]/g, '');
        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
    },

    /**
     * Queue a message for sending (stored in Firebase)
     */
    async queue(clinicId, { phone, message, type, patientId, appointmentId }) {
        return argonDB.ref(`clinics/${clinicId}/whatsapp_queue`).push({
            phone, message, type,
            patientId: patientId || null,
            appointmentId: appointmentId || null,
            status: 'pending',
            createdAt: new Date().toISOString(),
            attempts: 0
        });
    },

    /**
     * Build message from template
     */
    buildMessage(template, vars = {}) {
        let msg = template;
        for (const [key, val] of Object.entries(vars)) {
            msg = msg.replace(new RegExp(`\\{${key}\\}`, 'g'), val || '');
        }
        return msg;
    },

    // Default templates
    TEMPLATES: {
        BOOKING_CONFIRM: 'مرحباً {patientName} 🏥\nتم تأكيد حجزك في {clinicName}\n📅 التاريخ: {date}\n⏰ الوقت: {time}\n🔢 رقم الدور: {queueNumber}\n\n📍 رابط تتبع الحجز:\n{trackingUrl}',
        REMINDER_30: 'تذكير 🔔\nموعدك في {clinicName} بعد 30 دقيقة\n⏰ {time}\nنتمنى لك السلامة ❤️',
        REMINDER_10: 'تذكير أخير 🔔\nموعدك في {clinicName} بعد 10 دقائق\n⏰ {time}',
        DRUG_READY: 'مرحباً {patientName} 💊\nدوائك جاهز للاستلام من صيدلية {clinicName}\nيرجى التوجه لاستلامه.',
        LAB_RESULTS: 'مرحباً {patientName} 🧪\nنتائج تحاليلك جاهزة في {clinicName}\nيمكنك مراجعة العيادة لاستلامها.',
        RADIOLOGY_RESULTS: 'مرحباً {patientName} 📷\nنتائج الأشعة جاهزة في {clinicName}\nيمكنك مراجعة العيادة لاستلامها.',
        INVOICE_UNPAID: 'تنبيه 💰\nلديك فاتورة غير مدفوعة في {clinicName}\nالمبلغ: {amount}\nيرجى المراجعة.'
    }
};

// ══════════════════════════════════════════
//  PAGE INITIALIZER
// ══════════════════════════════════════════
const ArgonPage = {
    /**
     * Initialize a medical page with session check, license load, and maintenance watch
     * @param {object} options
     * @returns {Promise<{clinicId, settings}>}
     */
    async init(options = {}) {
        const {
            requireSession = true,
            requiredRole = null,
            allowPatientPortal = false,
            loginPage = 'login.html',
            onLicenseChange = null
        } = options;

        // Get clinic ID from session or URL
        let clinicId = ArgonSession.getClinicId();
        if (!clinicId) {
            const params = new URLSearchParams(window.location.search);
            clinicId = params.get('id') || params.get('clinicId');
        }

        if (!clinicId && requireSession) {
            window.location.href = loginPage;
            return null;
        }

        if (requireSession && !ArgonSession.isValid()) {
            window.location.href = loginPage;
            return null;
        }

        if (requiredRole && ArgonSession.getRole() !== requiredRole) {
            ArgonUI.toast('ليس لديك صلاحية الوصول لهذه الصفحة', 'err');
            setTimeout(() => window.location.href = loginPage, 1500);
            return null;
        }

        // Load license
        try {
            await ArgonLicense.load(clinicId);
        } catch (e) {
            ArgonUI.toast('خطأ في تحميل بيانات العيادة', 'err');
            return null;
        }

        // Start maintenance watcher
        ArgonMaintenance.watch(clinicId, { allowPatientPortal });

        // Listen for license changes
        if (onLicenseChange) {
            ArgonLicense.listen(clinicId, (settings) => {
                ArgonUI.applyLicenseVisibility();
                onLicenseChange(settings);
            });
        }

        // Apply initial license visibility
        ArgonUI.applyLicenseVisibility();

        // Refresh session
        ArgonSession.refresh();

        return { clinicId, settings: ArgonLicense.getSettings() };
    }
};

// ══════════════════════════════════════════
//  ENTERPRISE PATIENT API (MIGRATION LAYER)
// ══════════════════════════════════════════
const PatientAPI = {
    _getBase() {
        const cid = ArgonSession.getClinicId() || new URLSearchParams(window.location.search).get('id') || window.CID;
        return cid ? `clinics/${cid}` : '';
    },

    /**
     * Enterprise Adapters
     * Guarantees that the UI always receives a consistent object, regardless of the database schema.
     */
    buildUICompatiblePatient(uid, identityData, recordsData, legacyData = null) {
        // Base object that the EMR UI expects
        const patient = {
            info: identityData?.info || legacyData?.info || {},
            visits: legacyData?.visits || {}, // For now, we still map visits from legacy if present
            invoices: legacyData?.invoices || {},
            _metadata: {
                uid: uid,
                schemaVersion: identityData?.schemaVersion || 1,
                source: identityData ? 'enterprise' : 'legacy'
            }
        };
        // Inject MRN and default fields if missing
        if (!patient.info.mrn) patient.info.mrn = ArgonMedical.UI ? ArgonMedical.UI.genMRN?.() : '';
        return patient;
    },

    /**
     * Dual-Read Engine
     * Tries patient_identity first, falls back to legacy patients/
     */
    async getIdentity(uid) {
        const base = this._getBase();
        if (!base || !uid) return null;

        try {
            // Try Enterprise Domain
            const newSnap = await argonDB.ref(`${base}/patient_identity/${uid}`).once('value');
            if (newSnap.exists()) {
                const identityData = newSnap.val();
                
                // Fetch legacy data just for the `visits` array temporarily until Timeline UI is ready
                const legacySnap = await argonDB.ref(`${base}/patients/${uid}`).once('value');
                const legacyData = legacySnap.val() || {};
                
                return this.buildUICompatiblePatient(uid, identityData, null, legacyData);
            }

            // Fallback to Legacy
            const legacySnap = await argonDB.ref(`${base}/patients/${uid}`).once('value');
            if (legacySnap.exists()) {
                const legacyData = legacySnap.val();
                if (legacyData.status === 'archived') return null; // Respect Soft Delete
                
                // Trigger auto-migration silently
                this.triggerSilentMigration(uid, legacyData);
                return this.buildUICompatiblePatient(uid, null, null, legacyData);
            }
            return null;
        } catch (e) {
            console.error('[PatientAPI] Read Error:', e);
            return null;
        }
    },

    /**
     * Unified Timeline Engine
     * Dynamically merges legacy visits and modern events into a single sorted timeline.
     * The UI loops through this without knowing the underlying source.
     */
    async getUnifiedTimeline(uid) {
        const base = this._getBase();
        if (!base || !uid) return [];

        const timeline = [];

        try {
            // 1. Fetch Event-Sourced Timeline
            const eventsSnap = await argonDB.ref(`${base}/patient_timeline/${uid}`).once('value');
            if (eventsSnap.exists()) {
                Object.values(eventsSnap.val()).forEach(evt => timeline.push(evt));
            }

            // 2. Fetch Legacy Visits (Only if they weren't migrated silently yet)
            const legacySnap = await argonDB.ref(`${base}/patients/${uid}/visits`).once('value');
            if (legacySnap.exists()) {
                Object.entries(legacySnap.val()).forEach(([vk, visit]) => {
                    // Check if this visit was already migrated into an event
                    const alreadyMigrated = timeline.some(t => t.payload?.originalKey === vk);
                    if (!alreadyMigrated) {
                        timeline.push({
                            eventId: `legacy_${vk}`,
                            eventType: 'VISIT_CREATED',
                            timestamp: visit.date || new Date(0).toISOString(),
                            author: 'Legacy System',
                            payload: visit
                        });
                    }
                });
            }

            // 3. Sort Chronologically (Newest First)
            timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            return timeline;

        } catch (e) {
            console.error('[PatientAPI] Timeline Merge Error:', e);
            return [];
        }
    },

    /**
     * Fail-Safe Patient Context Resolver
     * Prevents Cross-Linking. NEVER GUESSES.
     */
    async resolvePatientContext(bookingData) {
        // 1. Direct UUID match
        if (bookingData.patientId) {
            const p = await this.getIdentity(bookingData.patientId);
            if (p) return { resolved: true, patient: p, patientId: bookingData.patientId };
        }

        // 2. We need phone to search
        if (!bookingData.phone) {
            return { resolved: false, requiresManualSelection: true, reason: 'NO_PHONE' };
        }

        // 3. Find candidates
        const candidates = await SearchAPI.searchPatients({ query: bookingData.phone, limit: 10 });
        const candidateKeys = Object.keys(candidates);
        
        if (candidateKeys.length === 0) {
            return { resolved: false, requiresCreation: true }; // New patient
        }

        if (candidateKeys.length === 1) {
            const uid = candidateKeys[0];
            const p = candidates[uid];
            // Validate via MPI
            const match = MPIEngine.calculateMatchProbability({ info: bookingData }, p);
            if (match.score >= 98) {
                return { resolved: true, patient: p, patientId: uid };
            } else {
                return { resolved: false, requiresManualSelection: true, candidates, reason: 'MPI_DOUBT' };
            }
        }

        // Multiple candidates (Family Cluster)
        let exactMatchCount = 0;
        let exactMatchUid = null;

        for (const uid of candidateKeys) {
            const p = candidates[uid];
            const match = MPIEngine.calculateMatchProbability({ info: bookingData }, p);
            if (match.score >= 98) {
                exactMatchCount++;
                exactMatchUid = uid;
            }
        }

        // Only Auto-Resolve if there is EXACTLY ONE Exact Match
        if (exactMatchCount === 1) {
            return { resolved: true, patient: candidates[exactMatchUid], patientId: exactMatchUid };
        }

        // Otherwise (0 or >1 exact matches), never guess.
        return { resolved: false, requiresManualSelection: true, candidates, reason: 'MULTIPLE_CANDIDATES' };
    },

    /**
     * Dual-Write Engine
     * Writes to both legacy patients/ and new patient_identity/
     */
    async saveIdentity(uid, patientData) {
        const base = this._getBase();
        if (!base || !uid) throw new Error("Missing Base/UID");

        const updates = {};
        
        // 1. Legacy Write (for backward compatibility)
        updates[`${base}/patients/${uid}`] = patientData;
        
        // 2. Enterprise Write
        const identityData = {
            info: patientData.info || {},
            updatedAt: new Date().toISOString(),
            schemaVersion: 2,
            identityVersion: 2
        };
        updates[`${base}/patient_identity/${uid}`] = identityData;

        // Write historical versions for Versioning Engine
        const versionId = new Date().getTime().toString();
        updates[`${base}/profile_versions/${uid}/${versionId}`] = identityData;

        // Extract records if any
        if (patientData.records) {
            updates[`${base}/patient_records/${uid}`] = patientData.records;
        }

        await argonDB.ref().update(updates);
        
        // Indexing for search (by_phone, by_mrn)
        if (identityData.info.phone) {
            const cleanPhone = ArgonSanitize.phone(identityData.info.phone) ? String(identityData.info.phone).replace(/\D/g, '') : null;
            if (cleanPhone) {
                argonDB.ref(`${base}/patient_indexes/by_phone/${cleanPhone}/${uid}`).set(true);
            }
        }
        if (identityData.info.mrn) {
            argonDB.ref(`${base}/patient_indexes/by_mrn/${identityData.info.mrn}/${uid}`).set(true);
        }

        return true;
    },

    /**
     * Event-Sourced Timeline Layer (Immutable Events)
     */
    async pushTimelineEvent(uid, eventType, payload) {
        const base = this._getBase();
        if (!base || !uid) return null;

        const eventRef = argonDB.ref(`${base}/patient_timeline/${uid}`).push();
        const eventData = {
            eventId: eventRef.key,
            immutableId: btoa(Date.now().toString() + Math.random()),
            eventType,
            timestamp: new Date().toISOString(),
            schemaVersion: 1,
            author: ArgonSession.getRole() || 'System',
            sourceModule: window.location.pathname.split('/').pop().replace('.html', ''),
            payload
        };

        await eventRef.set(eventData);
        return eventData;
    },

    /**
     * Background Auto-Migration with Locks
     */
    async triggerSilentMigration(uid, legacyData) {
        const base = this._getBase();
        const lockRef = argonDB.ref(`${base}/_meta/migrations/identity_v2/${uid}`);
        
        try {
            const lock = await lockRef.once('value');
            if (lock.exists() && lock.val().status === 'completed') return;

            // Set Lock
            await lockRef.set({ status: 'running', startedAt: new Date().toISOString() });

            // Save to new domains
            await this.saveIdentity(uid, legacyData);

            // Migrate old visits to Timeline
            if (legacyData.visits) {
                for (const [vk, visit] of Object.entries(legacyData.visits)) {
                    // Quick deduplication check
                    const tCheck = await argonDB.ref(`${base}/patient_timeline/${uid}`).orderByChild('payload/originalKey').equalTo(vk).once('value');
                    if (!tCheck.exists()) {
                        visit.originalKey = vk;
                        await this.pushTimelineEvent(uid, 'LEGACY_VISIT_MIGRATED', visit);
                    }
                }
            }

            // Complete Lock
            await lockRef.update({ status: 'completed', completedAt: new Date().toISOString(), version: '2.0' });
            console.log(`%c[PatientAPI] Silent Migration Completed for ${uid}`, 'color:#10b981');
        } catch (e) {
            console.error(`[PatientAPI] Migration failed for ${uid}:`, e);
            await lockRef.update({ status: 'failed', error: e.message });
        }
    },

    /**
     * Enterprise Soft Delete
     */
    async archivePatient(uid) {
        const base = this._getBase();
        if (!base || !uid) return false;
        
        const updates = {};
        updates[`${base}/patients/${uid}/status`] = 'archived';
        updates[`${base}/patients/${uid}/deletedAt`] = new Date().toISOString();
        updates[`${base}/patient_identity/${uid}/status`] = 'archived';
        
        await argonDB.ref().update(updates);
        return true;
    }
};

// ══════════════════════════════════════════
//  ENTERPRISE SEARCH API
// ══════════════════════════════════════════
const SearchAPI = {
    async searchPatients(options = {}) {
        const { query = '', limit = 50, offset = 0 } = options;
        const base = PatientAPI._getBase();
        if (!base) return {};

        console.groupCollapsed(`[ARGON Enterprise] Search Execution: "${query}"`);
        console.log(`Limit: ${limit}, Offset: ${offset}`);

        try {
            // For now, if no query, we fallback to a limited fetch of legacy patients 
            // until the full indexer is ready. This replaces the heavy child_added.
            if (!query.trim()) {
                const snap = await argonDB.ref(`${base}/patients`).limitToLast(limit).once('value');
                console.log(`Fetched ${snap.numChildren()} default patients`);
                console.groupEnd();
                return snap.val() || {};
            }

            // Indexed Search Logic (Phone or MRN)
            const cleanQuery = ArgonSanitize.phone(query) ? query.replace(/\D/g, '') : query.trim();
            const results = {};
            
            // Try Phone Index
            if (/^\d+$/.test(cleanQuery)) {
                const phoneSnap = await argonDB.ref(`${base}/patient_indexes/by_phone`).orderByKey().startAt(cleanQuery).endAt(cleanQuery + '\uf8ff').limitToFirst(limit).once('value');
                if (phoneSnap.exists()) {
                    for (const [phoneKey, uids] of Object.entries(phoneSnap.val())) {
                        for (const uid of Object.keys(uids)) {
                            const p = await PatientAPI.getIdentity(uid);
                            if (p) results[uid] = p;
                        }
                    }
                }
            }
            
            // Try Legacy Fallback if index missed (temporary during migration)
            if (Object.keys(results).length === 0) {
                console.log('Index missed. Using legacy fallback search...');
                const snap = await argonDB.ref(`${base}/patients`).once('value');
                const all = snap.val() || {};
                const q = query.toLowerCase();
                for (const [uid, pat] of Object.entries(all)) {
                    if (pat.status === 'archived') continue;
                    const info = pat.info || {};
                    if ((info.name && info.name.toLowerCase().includes(q)) || 
                        (info.phone && info.phone.includes(q)) || 
                        (info.mrn && info.mrn.toLowerCase().includes(q))) {
                        results[uid] = PatientAPI.buildUICompatiblePatient(uid, null, null, pat);
                    }
                }
            }

            console.log(`Search returned ${Object.keys(results).length} results`);
            console.groupEnd();
            return results;
        } catch (e) {
            console.error('[SearchAPI] Error:', e);
            console.groupEnd();
            return {};
        }
    }
};

// ══════════════════════════════════════════
//  ENTERPRISE TIMELINE API
// ══════════════════════════════════════════
const TimelineAPI = {
    async pushEvent(uid, eventType, payload) {
        return await PatientAPI.pushTimelineEvent(uid, eventType, payload);
    }
};

// ══════════════════════════════════════════
//  ENTERPRISE MPI ENGINE (Master Patient Index)
// ══════════════════════════════════════════
const MPIEngine = {
    /**
     * Arabic Phonetic Normalizer
     * Strips diacritics, normalizes Alef/Yaa/Taa Marboota, removes family prefixes.
     */
    normalizeArabic(str) {
        if (!str) return '';
        let s = str.trim().toLowerCase();
        
        // Remove diacritics (Tashkeel)
        s = s.replace(/[\u064B-\u065F]/g, '');
        
        // Normalize Alef, Yaa, Waw, Taa Marboota
        s = s.replace(/[أإآ]/g, 'ا');
        s = s.replace(/ة/g, 'ه');
        s = s.replace(/ى/g, 'ي');
        s = s.replace(/ؤ/g, 'و');
        s = s.replace(/ئ/g, 'ي');
        
        // Remove duplicate spaces and common symbols
        s = s.replace(/[^\w\s\u0600-\u06FF]/g, ' ');
        s = s.replace(/\s+/g, ' ');

        // Remove stop words and family prefixes
        const prefixes = ['ابو ', 'ابن ', 'ال ', 'آل ', 'عبد '];
        prefixes.forEach(p => {
            if (s.startsWith(p)) s = s.substring(p.length);
        });

        return s.trim();
    },

    /**
     * Levenshtein Distance Algorithm
     * Returns the minimum number of single-character edits required to change one word into the other.
     */
    levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1) // deletion
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    },

    /**
     * Calculates Name Similarity Percentage (0 to 1) using Levenshtein distance on normalized names
     */
    nameSimilarity(name1, name2) {
        const n1 = this.normalizeArabic(name1);
        const n2 = this.normalizeArabic(name2);
        if (n1 === n2) return 1.0;
        
        const maxLength = Math.max(n1.length, n2.length);
        if (maxLength === 0) return 0;
        
        const distance = this.levenshteinDistance(n1, n2);
        return (maxLength - distance) / maxLength;
    },

    /**
     * Enterprise Smart Match Probability Engine
     */
    calculateMatchProbability(patientA, patientB) {
        const infoA = patientA?.info || {};
        const infoB = patientB?.info || {};

        let score = 0;

        // 1. National ID (Highest Weight - Absolute Match)
        if (infoA.nationalId && infoB.nationalId && infoA.nationalId === infoB.nationalId) {
            return 100; 
        }

        // 2. Phone Match (Strong indicator, but can be family)
        const phoneA = (infoA.phone || '').replace(/\D/g, '');
        const phoneB = (infoB.phone || '').replace(/\D/g, '');
        const phoneMatch = phoneA && phoneB && phoneA === phoneB;
        if (phoneMatch) score += 40;

        // 3. Name Similarity via Levenshtein
        const nameSim = this.nameSimilarity(infoA.name, infoB.name);
        score += (nameSim * 50); // Up to 50 points

        // 4. Demographic Modifiers (Age, Gender)
        if (infoA.gender && infoB.gender) {
            if (infoA.gender === infoB.gender) score += 5;
            else score -= 20; // High penalty for gender mismatch
        }
        
        if (infoA.age && infoB.age) {
            const ageDelta = Math.abs(infoA.age - infoB.age);
            if (ageDelta <= 1) score += 5;
            else if (ageDelta > 10) score -= 15; // Penalty for large age gap (likely father/son)
        }

        // Cap at 100
        const finalScore = Math.min(100, Math.max(0, Math.round(score)));
        
        // Categorize
        let category = 'DIFFERENT_PERSON';
        if (finalScore >= 98) category = 'EXACT_MATCH';
        else if (finalScore >= 90) category = 'HIGH_MATCH';
        else if (finalScore >= 75) category = 'SUGGESTED_MATCH';
        else if (finalScore >= 50) category = 'POSSIBLE_FAMILY';

        return { score: finalScore, category };
    }
};

// Placeholder APIs for Phase 4 & 5
const AttachmentAPI = {};
const AuditAPI = {
    log: ArgonAudit.log // Map to existing audit logger
};

// ══════════════════════════════════════════
//  EXPORT (attach to window for non-module usage)
// ══════════════════════════════════════════
window.ArgonMedical = {
    DB: argonDB,
    Session: ArgonSession,
    License: ArgonLicense,
    Maintenance: ArgonMaintenance,
    Audit: ArgonAudit,
    BruteForce: ArgonBruteForce,
    OfflineQueue: ArgonOfflineQueue,
    AutoSave: ArgonAutoSave,
    Sanitize: ArgonSanitize,
    UI: ArgonUI,
    WhatsApp: ArgonWhatsApp,
    Page: ArgonPage,
    PatientAPI: PatientAPI,
    SearchAPI: SearchAPI,
    TimelineAPI: TimelineAPI,
    MPIEngine: MPIEngine,
    AttachmentAPI: AttachmentAPI,
    AuditAPI: AuditAPI,
    CLINIC_TYPES,
    FEATURES
};

console.log('%c🏥 ARGON Medical OS Core v1.0 Loaded', 'color:#0d9488;font-weight:900;font-size:12px;');
