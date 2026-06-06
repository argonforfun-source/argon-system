const fs = require('fs');

const code = fs.readFileSync('d:/git__hub/clinica-system/billing-engine.js', 'utf8');

const regex = /printPatientInvoice:\s*function\s*\(\)\s*\{[\s\S]*?const win\s*=\s*window\.open\(''\s*,\s*'_blank'\s*,\s*'width=900,height=700'\);\s*if\s*\(win\)\s*\{\s*win\.document\.write\(printHtml\);\s*win\.document\.close\(\);\s*\}\s*\}/m;

const replacement = `printPatientInvoice: function () {
    const pid = this.activePatientId;
    if (!pid) return;

    const pts = this._patientsRef || {};
    const pat = pts[pid] || {};
    const info = pat.info || {};
    const patName = info.name || 'مريض غير معروف';
    const patPhone = info.phone || '';
    const patNID = info.nationalId || '';
    const fin = this.calculatePatientFinancials(pid);

    // Clinic info from settings
    const clinicName = (typeof _sets !== 'undefined' && _sets.name) ? _sets.name : 'العيادة';
    const clinicPhone = (typeof _sets !== 'undefined' && _sets.phone) ? _sets.phone : '';
    const clinicAddr = (typeof _sets !== 'undefined' && _sets.address) ? _sets.address : '';
    const clinicLogo = (typeof _sets !== 'undefined' && _sets.logo) ? _sets.logo : '';
    const clinicTax = (typeof _sets !== 'undefined' && _sets.taxNumber) ? _sets.taxNumber : 'غير متوفر';

    // Collect ALL items across all invoices for this patient
    const pInvoices = Object.entries(this._invoices)
      .filter(([k, inv]) => inv.patientId === pid)
      .sort((a, b) => (a[1].createdAt || '').localeCompare(b[1].createdAt || ''));

    // Categorize items
    const cats = { consult: [], lab: [], rad: [], pharm: [], other: [] };
    pInvoices.forEach(([k, inv]) => {
      (inv.items || []).forEach(i => {
        const n = (i.name || '').toLowerCase();
        const price = parseFloat(i.price) || 0;
        const item = { name: BillingEngine.sanitize(i.name), price: price, date: inv.createdAt };
        if (n.includes('كشفية') || n.includes('consultation')) cats.consult.push(item);
        else if (n.includes('تحليل') || n.includes('lab')) cats.lab.push(item);
        else if (n.includes('تصوير') || n.includes('أشعة') || n.includes('rad') || n.includes('x-ray') || n.includes('mri') || n.includes('ct')) cats.rad.push(item);
        else if (n.includes('صيدل') || n.includes('دواء') || n.includes('pharm')) cats.pharm.push(item);
        else cats.other.push(item);
      });
    });

    let itemCounter = 1;
    const renderRows = (arr, deptName) => {
      return arr.map(i => \`
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">\${itemCounter++}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:700">\${i.name}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;color:#64748b">\${deptName}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">1</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-family:'IBM Plex Mono',monospace">\${i.price.toFixed(2)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:bold;font-family:'IBM Plex Mono',monospace">\${i.price.toFixed(2)}</td>
        </tr>
      \`).join('');
    };

    let rowsHtml = '';
    rowsHtml += renderRows(cats.consult, 'كشفية طبية');
    rowsHtml += renderRows(cats.lab, 'مختبر');
    rowsHtml += renderRows(cats.rad, 'أشعة');
    rowsHtml += renderRows(cats.pharm, 'صيدلية');
    rowsHtml += renderRows(cats.other, 'أخرى');
    
    if(!rowsHtml) {
        rowsHtml = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8;">لا توجد خدمات طبية مسجلة في هذه الفاتورة</td></tr>';
    }

    const dateNow = new Date().toLocaleDateString('ar-JO', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeNow = new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' });
    const invNum = 'INV-' + (pid || '').substring(0, 8).toUpperCase();

    // QR Code data (JOFOTARA Standard simplified)
    const qrData = encodeURIComponent(\`العيادة: \${clinicName}\\nالرقم الضريبي: \${clinicTax}\\nرقم الفاتورة: \${invNum}\\nالتاريخ: \${dateNow} \${timeNow}\\nالإجمالي: \${fin.total.toFixed(2)} JOD\`);
    const qrUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=\${qrData}\`;

    const logoHtml = clinicLogo ? \`<img src="\${clinicLogo}" style="max-height:70px;max-width:120px;object-fit:contain;border-radius:8px" crossorigin="anonymous">\` : '<div style="width:70px;height:70px;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:2rem;border:2px dashed #cbd5e1">🏥</div>';

    const printHtml = \`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>فاتورة طبية ضريبية - \${BillingEngine.sanitize(patName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Tajawal',sans-serif;color:#1e293b;background:#fff;direction:rtl;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:15mm 12mm}
.inv{max-width:780px;margin:0 auto;padding:20px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0d9488;padding-bottom:18px;margin-bottom:18px}
.hdr-right{display:flex;align-items:center;gap:14px}
.hdr h1{font-size:1.6rem;color:#0d9488;font-weight:900;margin-bottom:4px}
.hdr-left{text-align:left; display:flex; gap: 15px; align-items:flex-start;}
.hdr-left h2{font-size:1.1rem;color:#334155;margin-bottom:4px;font-weight:900;}
.qr-code { width: 90px; height: 90px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; }
.pat-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pat-box b{color:#475569}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead tr{background:#0d9488;color:#fff}
thead th{padding:10px;font-weight:700;font-size:0.85rem;border:1px solid #0f766e;}
tbody td{font-size:0.9rem;}
.summary{display:flex;justify-content:flex-end;margin-bottom:20px}
.summary-box{width:320px;border:2px solid #0d9488;border-radius:10px;overflow:hidden}
.summary-row{display:flex;justify-content:space-between;padding:8px 14px;font-size:0.9rem;border-bottom:1px solid #e2e8f0}
.summary-row:last-child{border-bottom:none;background:#0d9488;color:#fff;font-weight:900;font-size:1.1rem}
.stamp-area{margin-top:30px;display:flex;justify-content:space-between;align-items:flex-end}
.stamp-box{width:200px;text-align:center}
.stamp-box .line{border-bottom:2px dashed #94a3b8;height:60px;margin-bottom:8px}
.stamp-box .label{color:#475569;font-weight:700;font-size:0.85rem}
.footer{margin-top:30px;text-align:center;color:#94a3b8;font-size:0.75rem;border-top:1px solid #e2e8f0;padding-top:14px}
@media print{body{background:#fff}.inv{padding:0}}</style></head>
<body><div class="inv">
<div class="hdr">
  <div class="hdr-right">\${logoHtml}<div>
    <h1>\${BillingEngine.sanitize(clinicName)}</h1>
    <p style="color:#64748b;font-size:0.85rem">\${BillingEngine.sanitize(clinicAddr)}</p>
    <p style="color:#64748b;font-size:0.85rem">هاتف: <span dir="ltr">\${BillingEngine.sanitize(clinicPhone)}</span></p>
    <p style="color:#64748b;font-size:0.85rem;font-weight:bold;margin-top:2px;">الرقم الضريبي: \${BillingEngine.sanitize(clinicTax)}</p>
  </div></div>
  <div class="hdr-left">
    <div>
      <h2>فاتورة طبية ضريبية</h2>
      <p style="color:#64748b;font-size:0.85rem">رقم الفاتورة: \${invNum}</p>
      <p style="color:#64748b;font-size:0.85rem">التاريخ: \${dateNow}</p>
      <p style="color:#64748b;font-size:0.85rem">الوقت: \${timeNow}</p>
    </div>
    <img src="\${qrUrl}" alt="QR Code" class="qr-code" onerror="this.style.display='none'">
  </div>
</div>
<div class="pat-box">
  <div><b>اسم المريض:</b> \${BillingEngine.sanitize(patName)}</div>
  <div><b>رقم الهاتف:</b> <span dir="ltr">\${BillingEngine.sanitize(patPhone) || '—'}</span></div>
  <div><b>الرقم الوطني:</b> \${BillingEngine.sanitize(patNID) || '—'}</div>
  <div><b>الرقم المرجعي (UID):</b> <span dir="ltr" style="font-family:'IBM Plex Mono',monospace;font-size:0.8rem">\${(pid || '').substring(0, 12)}</span></div>
</div>
<table>
  <thead>
    <tr><th>#</th><th>البيان (اسم الخدمة)</th><th>القسم الطبي</th><th>الكمية</th><th>السعر الإفرادي</th><th>المجموع (د.أ)</th></tr>
  </thead>
  <tbody>\${rowsHtml}</tbody>
</table>
<div class="summary"><div class="summary-box">
  <div class="summary-row"><span>المجموع الإجمالي</span><span style="font-family:'IBM Plex Mono',monospace">\${fin.total.toFixed(2)} د.أ</span></div>
  <div class="summary-row"><span>المدفوع مسبقاً</span><span style="font-family:'IBM Plex Mono',monospace;color:#10b981">\${fin.paid.toFixed(2)} د.أ</span></div>
  <div class="summary-row"><span>الرصيد المستحق (الذمم)</span><span style="font-family:'IBM Plex Mono',monospace">\${fin.unpaid.toFixed(2)} د.أ</span></div>
</div></div>
<div class="stamp-area">
  <div style="color:#94a3b8;font-size:0.82rem">ملاحظة: هذه الفاتورة صادرة إلكترونياً من النظام الطبي ومطابقة لمعايير الفوترة الأردنية.<br>يرجى الاحتفاظ بها لأغراض المراجعة والتأمين.</div>
  <div class="stamp-box"><div class="line"></div><div class="label">ختم العيادة والتوقيع</div></div>
</div>
<div class="footer">تم إصدار هذه الفاتورة بواسطة ARGON Medical OS — نظام إدارة العيادات والمجمعات الطبية</div>
</div><script>window.onload=function(){setTimeout(function(){window.print();}, 500); window.onafterprint=function(){window.close();}}</script></body></html>\`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (win) { win.document.write(printHtml); win.document.close(); }
  }`;

if (regex.test(code)) {
    const newCode = code.replace(regex, replacement);
    fs.writeFileSync('d:/git__hub/clinica-system/billing-engine.js', newCode);
    console.log('Successfully updated printPatientInvoice');
} else {
    console.log('Regex did not match');
}
