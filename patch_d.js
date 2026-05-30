const fs = require('fs');
let code = fs.readFileSync('./clinica-repo/index.html', 'utf8');

// 1. Remove my old pNationalId block
const oldNidHtml = `          <div class="fg">
            <label>الرقم الوطني / الهوية *</label>
            <input type="text" id="pNationalId" class="finp" placeholder="أدخل الرقم الوطني (9 أرقام على الأقل)" autocomplete="off" inputmode="numeric">
            <div class="err-msg" id="pNationalIdErr">الرقم الوطني إجباري ويجب أن لا يقل عن 9 أرقام</div>
          </div>
`;
code = code.replace(oldNidHtml, '');

// 2. Insert D1 after pPhone
const phoneHtml = `          <div class="fg">
            <label>رقم الهاتف *</label>
            <input type="tel" id="pPhone" class="finp" placeholder="07XXXXXXXX" autocomplete="tel" dir="ltr">
            <div class="err-msg" id="pPhoneErr">يرجى إدخال رقم هاتف صحيح</div>
          </div>`;

const d1Html = `
          <!-- ── D1: حقل الرقم الوطني في نموذج الحجز (HTML) ── -->
          <div class="fg" id="nidFieldWrap">
            <label for="patNID" style="display:flex;align-items:center;gap:6px;">
              🪪 الرقم الوطني / رقم الهوية
              <span style="background:rgba(239,68,68,0.12);color:#ef4444;font-size:0.65rem;
                           padding:1px 7px;border-radius:10px;font-weight:700;">إجباري</span>
            </label>
            <input
              type="text"
              id="patNID"
              class="finp"
              inputmode="numeric"
              placeholder="أدخل رقمك الوطني المكوّن من 10 أرقام"
              autocomplete="off"
              oninput="this.value=this.value.replace(/\\D/g,'').slice(0,12)"
              style="letter-spacing:2px;font-family:'IBM Plex Mono',monospace;font-size:1rem;"
            >
            <span class="field-hint" id="nidHint" style="display:none;color:#ef4444;font-size:0.75rem;margin-top:4px;">
              ⚠️ يرجى إدخال رقم وطني صالح (9 أرقام على الأقل)
            </span>
          </div>
`;

code = code.replace(phoneHtml, phoneHtml + d1Html);


// 3. Insert D2 validation
const oldValidation = `      const name = sanitize(document.getElementById('pName').value);
      const phone = sanitize(toEngNum(document.getElementById('pPhone').value));
      const nid = sanitize(toEngNum(document.getElementById('pNationalId').value).replace(/\\D/g, ''));
      if (!isName(name) || !isPhone(phone) || nid.length < 9) { toast(T('errData'), 'err'); return; }`;

const newValidation = `      const name = sanitize(document.getElementById('pName').value);
      const phone = sanitize(toEngNum(document.getElementById('pPhone').value));
      if (!isName(name) || !isPhone(phone)) { toast(T('errData'), 'err'); return; }

      // ── D2: التحقق من الرقم الوطني قبل الحفظ ──
      const patNID_val = document.getElementById('patNID')?.value?.trim() || '';
      if (!patNID_val || patNID_val.length < 9 || !/^\\d+$/.test(patNID_val)) {
        const nidHint = document.getElementById('nidHint');
        const patNID = document.getElementById('patNID');
        if(nidHint) nidHint.style.display = 'block';
        if(patNID) {
            patNID.focus();
            patNID.style.borderColor = '#ef4444';
        }
        return; // أوقف عملية الحجز
      }
      if(document.getElementById('nidHint')) document.getElementById('nidHint').style.display = 'none';
      if(document.getElementById('patNID')) document.getElementById('patNID').style.borderColor = '';
      // ── نهاية D2 ──`;

code = code.replace(oldValidation, newValidation);

// 4. Update booking save payload
const oldPayloadLine = `patName: name, patPhone: phone, patNationalId: nid,`;
const newPayloadLine = `patName: name, patPhone: phone, patNationalId: patNID_val,`;
code = code.replace(oldPayloadLine, newPayloadLine);

fs.writeFileSync('./clinica-repo/index.html', code);
console.log('PATCH D APPLIED');
