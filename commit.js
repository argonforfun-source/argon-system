const { execSync } = require('child_process');
execSync('git add .', { cwd: 'd:/git__hub/clinica-system' });
execSync('git commit -m "Fix: Update draft invoices to unpaid and apply Enterprise Billing"', { cwd: 'd:/git__hub/clinica-system' });
