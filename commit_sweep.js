const { execSync } = require('child_process');
execSync('git add .', { cwd: 'd:/git__hub/clinica-system' });
execSync('git commit -m "Fix: Extensive sweep of all empty phone matching vulnerabilities in EMR"', { cwd: 'd:/git__hub/clinica-system' });
execSync('git push', { cwd: 'd:/git__hub/clinica-system' });
