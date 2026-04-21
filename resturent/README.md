# 🔐 ARGON SYSTEM v2.0 — دليل الحماية والإعداد الكامل
## نظام إدارة المطاعم الذكي | محمي بطبقات متعددة + PWA

---

## ⚡ الخطوات السريعة (5 خطوات فقط)

### 1️⃣ مشروع Firebase جديد (منفصل)
1. اذهب إلى [console.firebase.google.com](https://console.firebase.google.com)
2. **Add project** → اسمه: `argon-system-v2`
3. فعّل **Realtime Database** → United States → **Test mode** مؤقتاً

### 2️⃣ استبدل firebaseConfig في 3 ملفات
في `index.html` و `dashboard.html` و `super.html`:
```javascript
const firebaseConfig = {
  apiKey: "من Firebase Console",
  authDomain: "argon-system-v2.firebaseapp.com",
  databaseURL: "https://argon-system-v2-default-rtdb.firebaseio.com",
  projectId: "argon-system-v2",
  ...
};
```

### 3️⃣ ضع قواعد الأمان
Firebase Console → Realtime Database → **Rules** → انسخ من `firebase-rules.json`

### 4️⃣ GitHub Repository جديد
```bash
git init
git add .
git commit -m "🔐 Argon System v2.0 — Secured"
git remote add origin https://github.com/YOUR_USER/argon-system.git
git push -u origin main
```

### 5️⃣ نشر على Vercel أو Render
- **Vercel**: [vercel.com](https://vercel.com) → Import → Deploy
- **Render**: [render.com](https://render.com) → New Static Site → Connect GitHub

---

## 🗂️ الملفات

| الملف | الوظيفة |
|-------|---------|
| `index.html` | قائمة الطعام + حجز الطلب (للزبون) — PWA |
| `dashboard.html` | لوحة التحكم (للمطعم) — محمية |
| `super.html` | Super Admin (للأدمن العام) — محمية |
| `sw.js` | Service Worker — Offline + Cache |
| `manifest.json` | PWA — إضافة للشاشة كتطبيق |
| `offline.html` | صفحة بدون إنترنت |
| `firebase-rules.json` | قواعد الأمان |
| `render.yaml` | Security Headers تلقائية |

---

## 🔐 طبقات الحماية المُضافة

### الطبقة 1 — Firebase Security Rules ✅
```
الزبون:       يقرأ الأصناف والإعدادات (بدون كلمة المرور)
              يكتب طلبه فقط مع validation
كلمة المرور: محمية بـ ".read": false — مستحيل قراءتها
الطلبات:     ".read": false — لا يقرأها إلا الداشبورد
```

### الطبقة 2 — Brute Force Protection ✅
```
Dashboard:   5 محاولات خاطئة → قفل 60 ثانية
Super Admin: 5 محاولات خاطئة → قفل 120 ثانية
عداد المحاولات يظهر للمستخدم تحذيراً واضحاً
```

### الطبقة 3 — Session Management ✅
```
Dashboard:  جلسة تنتهي بعد 8 ساعات تلقائياً
Super Admin: جلسة تنتهي بعد 4 ساعات
استعادة الجلسة تلقائياً عند إعادة فتح الصفحة
```

### الطبقة 4 — Input Sanitization ✅
```javascript
_sec.sanitize(s)  // يزيل: < > " ' ` \
_sec.isName(n)    // 1-100 حرف
_sec.isPrice(p)   // رقم موجب < 10,000
_sec.isId(id)     // أحرف/أرقام فقط، بدون مسافات
_sec.isPhone(p)   // رقم هاتف صحيح
```

### الطبقة 5 — Rate Limiting ✅
```
الزبون: 5 طلبات/ساعة كحد أقصى لكل جهاز
يمنع السبام والطلبات الوهمية
```

### الطبقة 6 — Security Headers ✅
```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### الطبقة 7 — Auth Guards على الكتابة ✅
```javascript
// كل دالة كتابة فيها فحص:
if (!isLogged) { toast('⚠️ غير مصرح لك'); return; }
```

---

## 📱 ميزة PWA (تطبيق بدون متجر)

| الميزة | الوصف |
|--------|-------|
| **Install Banner** | يظهر تلقائياً بعد 4 ثوانٍ |
| **Standalone Mode** | يفتح بدون شريط المتصفح |
| **Offline Support** | يعمل جزئياً بدون إنترنت |
| **Auto Update** | إشعار عند وجود تحديث جديد |
| **Smart Cache** | تحميل سريع في الزيارات التالية |

---

## 🔑 بيانات الدخول (غيّرها قبل النشر!)

| اللوحة | بيانات الدخول |
|--------|--------------|
| **Super Admin** | `admin` / `argon_super_2026` |
| **Dashboard** | كلمة مرور كل مطعم (افتراضي: `1122`) |
| **Master Password** | `argon_master_2026` |

> ⚠️ **مهم جداً**: غيّر `ADMIN_PASS` في `super.html` قبل النشر!

---

## 🏗️ هيكل Firebase

```
restaurants/
  {restaurantId}/
    settings/
      name, phone, color, status, hours, acceptOrders
      password  ← محمية بـ .read: false
    
    products/
      {key}/  name, price, img
    
    orders/         ← الزبائن يكتبون فقط
      {key}/  custName, custPhone, items, total,
              status("new"), orderNo, orderType,
              date, time, notes, _tok
    
    completedOrders/ ← محمية بالكامل
      {key}/  ...
```

---

## ❓ أسئلة شائعة

**س: هل يمكن لأي شخص قراءة كلمات المرور؟**
ج: لا. Firebase Rules تمنع قراءة `password` بالكامل.

**س: هل يمكن لشخص حذف الأصناف؟**
ج: لا. `products` لها `.write: false` — فقط من خلال الداشبورد.

**س: ماذا لو نسيت كلمة المرور؟**
ج: استخدم Master Password: `argon_master_2026`

**س: كيف أضيف مطعماً جديداً؟**
ج: من `super.html` → إضافة مطعم → أدخل البيانات.

---

## 🔧 تغيير Master Password

في `dashboard.html` ابحث عن:
```javascript
const MASTER = 'argon_master_2026';
```
وغيّره لكلمة سر قوية.

في `super.html` ابحث عن:
```javascript
const ADMIN_PASS = 'argon_super_2026';
```
وغيّره لكلمة سر قوية.

---

*ARGON SYSTEM v2.0 — Secured & Production Ready*
