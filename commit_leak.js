const { execSync } = require('child_process');
execSync('git add .', { cwd: 'd:/git__hub/clinica-system' });
execSync('git commit -m "Fix: Critical clinical data leak matching empty phone strings across unrelated patients"', { cwd: 'd:/git__hub/clinica-system' });
execSync('git push', { cwd: 'd:/git__hub/clinica-system' });
