# 🏥 CLINICA PRO v2.0 — دليل الإعداد الكامل
## نظام حجز عيادات احترافي | حماية متعددة الطبقات + PWA

---

## ⚡ الشغل في 5 خطوات

### 1️⃣ إنشاء مشروع Firebase جديد (منفصل عن المطاعم)

1. اذهب إلى [console.firebase.google.com](https://console.firebase.google.com)
2. **Add project** → اسمه: `clinica-pro-system`
3. فعّل **Realtime Database** → United States → **Test mode** مؤقتاً
4. فعّل **Authentication** → Sign-in method → **Anonymous** (شغّله)

---

### 2️⃣ انسخ بيانات Firebase

في صفحة المشروع → Project Settings → Your apps → **Add Web App**

```javascript
// استبدل هذا في الملفات الثلاثة (index.html, dashboard.html, super.html)
const FB_CFG = {
  apiKey: "AIzaSy...",          // ← من Firebase
  authDomain: "clinica-pro-system.firebaseapp.com",
  databaseURL: "https://clinica-pro-system-default-rtdb.firebaseio.com",
  projectId: "clinica-pro-system",
  storageBucket: "clinica-pro-system.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

### 3️⃣ ضع قواعد الأمان في Firebase

في **Realtime Database → Rules** انسخ الكود من `firebase-rules.json`

> القواعد تضمن:
> - ✅ المرضى يحجزون فقط (لا يقرأون الحجوزات الأخرى)
> - ✅ الأطباء والإعدادات مرئية للجميع (ضرورة للحجز)
> - ✅ كلمة المرور **محمية تماماً** — لا يمكن قراءتها
> - ✅ الحجوزات والسجل محميان بـ Auth

---

### 4️⃣ إنشاء GitHub Repository

```bash
git init
git add .
git commit -m "🏥 Clinica Pro v2.0 — Initial release"
git branch -M main
git remote add origin https://github.com/YOUR_USER/clinica-system.git
git push -u origin main
```

---

### 5️⃣ النشر على Vercel (مجاني)

1. [vercel.com](https://vercel.com) → Import → اختر `clinica-system`
2. Deploy → رابطك: `clinica-system.vercel.app`
3. شغّل الرابط وعدّل `firebaseConfig` في الملفات

---

## 🗂️ هيكل الملفات

```
clinica-v2/
├── index.html          ← صفحة المريض (PWA + حجز)
├── dashboard.html      ← لوحة العيادة (مدير/طبيب)
├── super.html          ← Super Admin (كل العيادات)
├── sw.js               ← Service Worker (offline/cache)
├── manifest.json       ← PWA Manifest
├── offline.html        ← صفحة بدون إنترنت
├── firebase-rules.json ← قواعد الأمان
├── render.yaml         ← نشر Render.com
└── README.md           ← هذا الملف
```

---

## 🔐 طبقات الأمان

### طبقة 1 — Firebase Security Rules
```
المريض:   يقرأ الأطباء والإعدادات ✅ | يكتب حجزه فقط ✅
الداشبورد: يقرأ/يكتب حجوزات عيادته فقط (بعد Auth) ✅
كلمة المرور: محمية بالكامل — لا تُقرأ أبداً ✅
```

### طبقة 2 — حماية Brute Force
```
5 محاولات خاطئة → قفل 60 ثانية
Rate Limiting: 5 حجوزات/ساعة لكل مستخدم
```

### طبقة 3 — تنظيف المدخلات
```javascript
sanitize(input) // يزيل: < > " ' &
isPhone(p)      // يتحقق من صحة رقم الهاتف
isName(n)       // يتحقق: 2-80 حرف
```

### طبقة 4 — Anonymous Auth
```
كل مريض يحصل على UID مجهول تلقائياً
يُرسل مع كل حجز لمنع السبام
```

---

## 📱 تجربة PWA

| الميزة | الوصف |
|--------|-------|
| **إضافة للشاشة** | يظهر بانر تلقائي بعد 3 ثوانٍ |
| **Standalone** | يفتح بدون شريط المتصفح |
| **Offline** | يعمل جزئياً بدون إنترنت |
| **Auto-update** | إشعار تلقائي عند وجود تحديث |
| **سريع** | Cache ذكي للأصول الثابتة |

---

## 🌐 الروابط

| الصفحة | الرابط | من يستخدمها |
|--------|--------|-------------|
| الحجز | `index.html?id=CLINIC_ID` | المرضى |
| الداشبورد | `dashboard.html?id=CLINIC_ID` | مدير العيادة |
| Super Admin | `super.html` | أنت (صاحب النظام) |

---

## 🔑 بيانات الدخول

| اللوحة | المستخدم | كلمة المرور |
|--------|----------|-------------|
| Super Admin | `admin` | `clinica2024` |
| Dashboard (افتراضي) | — | `1122` |
| Master Password | — | `clinica_master_2026` |

> ⚠️ **غيّر كلمات المرور فوراً بعد أول تسجيل دخول**

---

## 🏗️ هيكل قاعدة البيانات

```
clinics/
  {clinicId}/
    settings/
      name, phone, specialty, color, emoji
      status: "open" | "closed" | "suspended"
      acceptBookings: true | false
      hours, password ← محمية، لا تُقرأ خارجياً
    
    doctors/
      {docKey}/
        name, specialty, fee, slotDuration
        workStart, workEnd, img, emoji
        available: true | false
        avgRating, ratingCount
    
    bookings/         ← حجوزات نشطة
      {bookKey}/
        bookNo, docKey, docName, docSpec
        patName, patPhone, patAge, patGender, notes
        date, time, fee, status, createdAt, anonUid
        rating (اختياري)
    
    completedBookings/ ← أُنجزت
      {bookKey}/ ... + completedAt
```

---

## ❓ أسئلة شائعة

**س: هل يمكن لشخص قراءة حجوزات العيادة؟**  
ج: لا. الحجوزات محمية بـ Firebase Auth، فقط من يملك UID العيادة يقرأها.

**س: هل يمكن لشخص حذف الأطباء؟**  
ج: لا. الكتابة على الأطباء تتطلب Auth.

**س: هل كلمة مرور الداشبورد مرئية في الكود؟**  
ج: لا. كلمة المرور مخزنة في Firebase فقط، ومحمية بـ Rule: `".read": false`

**س: كيف أضيف عيادة جديدة؟**  
ج: من super.html → "إضافة عيادة" → أدخل البيانات → ستحصل على الرابطين تلقائياً.

**س: هل يعمل على الجوال؟**  
ج: نعم، متجاوب 100%، PWA يتصرف كتطبيق حقيقي.

---

## 🛡️ Firebase Rules الكاملة

انسخ الكود الموجود في `firebase-rules.json` والصقه في:  
Firebase Console → Realtime Database → Rules → Publish

---

*Powered by CLINICA PRO System — Built with ❤️*
