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
    CLINIC_TYPES,
    FEATURES
};

console.log('%c🏥 ARGON Medical OS Core v1.0 Loaded', 'color:#0d9488;font-weight:900;font-size:12px;');
