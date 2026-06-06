const fs = require('fs');
fs.copyFileSync('d:/git__hub/clinica-system/billing-engine.js', 'd:/git__hub/argon-system/clinica-repo/billing-engine.js');
const { execSync } = require('child_process');
execSync('git add .', { cwd: 'd:/git__hub/clinica-system' });
execSync('git commit -m "Feat: JOFOTARA compliant professional invoice printing with QR code and tax number"', { cwd: 'd:/git__hub/clinica-system' });
execSync('git push', { cwd: 'd:/git__hub/clinica-system' });
