const fs = require('fs');
function replaceDraft(file) {
  let path = 'd:/git__hub/argon-system/clinica-repo/' + file;
  let code = fs.readFileSync(path, 'utf8');
  let newCode = code.replace(/'draft'/g, "'unpaid'");
  if (code !== newCode) {
    fs.writeFileSync(path, newCode);
    console.log('Replaced in ' + file);
  }
}
['radiology-app.js', 'lab-app.js', 'pharmacy-app.js', 'billing-engine.js'].forEach(replaceDraft);
