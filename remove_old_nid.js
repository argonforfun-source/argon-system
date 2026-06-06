const fs = require('fs');
let code = fs.readFileSync('./clinica-repo/emr-app.js', 'utf8');

const regex = /\s*\/\/ \-\-\- NID SECURITY GUARD \-\-\-[\s\S]*?return;\s*}\s*}/;
const match = code.match(regex);
if (match) {
  code = code.replace(regex, '');
  fs.writeFileSync('./clinica-repo/emr-app.js', code);
  console.log('Removed old NID SECURITY GUARD block successfully.');
} else {
  console.log('Could not find the block.');
}
