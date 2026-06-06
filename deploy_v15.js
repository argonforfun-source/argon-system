const { execSync } = require('child_process');
try {
  console.log(execSync('git add .', { cwd: 'd:/git__hub/clinica-system', encoding: 'utf8' }));
  console.log(execSync('git commit -m "Enterprise Billing V1.5 Production Readiness"', { cwd: 'd:/git__hub/clinica-system', encoding: 'utf8' }));
  console.log(execSync('git push', { cwd: 'd:/git__hub/clinica-system', encoding: 'utf8' }));
  console.log('Deployed successfully');
} catch(e) {
  console.log(e.stdout || e.message);
}
