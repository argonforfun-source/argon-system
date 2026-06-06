const { execSync } = require('child_process');
execSync('git add .', { cwd: 'd:/git__hub/clinica-system' });
execSync('git commit -m "Fix: Add 25 and 10 fallback rates for diagnostic items"', { cwd: 'd:/git__hub/clinica-system' });
execSync('git push', { cwd: 'd:/git__hub/clinica-system' });
