const fs = require('fs');
let code = fs.readFileSync('d:/git__hub/clinica-system/emr-app.js', 'utf8');

// 1. Line 620
code = code.replace(
  /const isMatchPhone = k\.startsWith\('-\'\) && cleanPhone\(p\.info\?\.phone \|\| \'\'\) === phone;/g,
  "const isMatchPhone = phone && k.startsWith('-') && cleanPhone(p.info?.phone || '') === phone;"
);

// 2. Line 1088
code = code.replace(
  /cleanPhone\(p\.info\?\.phone \|\| \'\'\) === phone \|\|\n\s*cleanPhone\(k\) === phone/g,
  "phone && (cleanPhone(p.info?.phone || '') === phone || cleanPhone(k) === phone)"
);

// 3. Line 2040
code = code.replace(
  /return \(p\.info && cleanPhone\(p\.info\.phone\) === cleanP\) \|\| k === cleanP;/g,
  "return cleanP && ((p.info && cleanPhone(p.info.phone) === cleanP) || k === cleanP);"
);

// 4. Line 3773
code = code.replace(
  /return cleanPhone\(p\.info\?\.phone \|\| \'\'\) === phone;/g,
  "return phone && cleanPhone(p.info?.phone || '') === phone;"
);

fs.writeFileSync('d:/git__hub/clinica-system/emr-app.js', code);
console.log('Fixed emr-app.js empty string phone match vulnerabilities');
