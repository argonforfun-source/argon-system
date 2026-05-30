const fs = require('fs');
let code = fs.readFileSync('./clinica-repo/dashboard.html', 'utf8');

// --- C1 PATCH ---
const c1Old = `(b.docName && b.docName.toLowerCase().includes(sq)) ||
             (b.patNationalId && b.patNationalId.includes(sq));`;
const c1New = `(b.docName && b.docName.toLowerCase().includes(sq))
             // ── C1: بحث بالرقم الوطني في السجل ──
             || (b.patNationalId && ArgonNID.cleanNID(b.patNationalId).includes(ArgonNID.cleanNID(sq)));
             // ── نهاية C1 ──`;
code = code.replace(c1Old, c1New);

// --- C2 PATCH ---
// I need to replace my previous <div class="binfo">📞 ${sanitize(b.patPhone)} ${b.patNationalId ? ... }</div>
// with the user's C2 patch exactly
const c2Regex = /<div class="binfo">📞 \$\{sanitize\(b\.patPhone\)\}.*?<\/div>/;
const c2NewStr = `<div class="binfo">📞 \${sanitize(b.patPhone)}</div>
        // ── C2: عرض الرقم الوطني على الكارت ──
        \${b.patNationalId ? \`<div class="binfo" style="font-family:'IBM Plex Mono',monospace;font-size:.74rem;color:var(--teal)">🪪 \${sanitize(b.patNationalId)}</div>\` : \`<div class="binfo" style="color:rgba(239,68,68,0.7);font-size:.72rem">⚠️ رقم وطني غير مُسجَّل</div>\`}
        // ── نهاية C2 ──`;
code = code.replace(c2Regex, c2NewStr);

// --- C3 PATCH ---
const c3Old = `const bookingName = (b.patName || '').trim();`;
const c3New = `const bookingName = (b.patName || '').trim();
// ── C3: تمرير NID لمحرك المطابقة ──
const bookingNID_C3 = ArgonNID.cleanNID(b.patNationalId || b.nationalId || '');
// ──`;
code = code.replace(c3Old, c3New);

const c3Old2 = `{ name: bookingName, phone: cleanPhone, nationalId: "" }`;
const c3New2 = `{ name: bookingName, phone: cleanPhone, nationalId: bookingNID_C3 }`;
code = code.replace(c3Old2, c3New2);

fs.writeFileSync('./clinica-repo/dashboard.html', code);
console.log('PATCH C APPLIED');
