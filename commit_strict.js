const { execSync } = require('child_process');
execSync('git add .', { cwd: 'd:/git__hub/clinica-system' });
execSync('git commit -m "Fix: Complete strict clinical isolation - remove all phone fallbacks for diagnostic orders"', { cwd: 'd:/git__hub/clinica-system' });
execSync('git push', { cwd: 'd:/git__hub/clinica-system' });
