const { execSync } = require('child_process');
try {
  execSync('git add .', { cwd: 'd:/git__hub/argon-system', stdio: 'inherit' });
  try {
    execSync('git commit -m "Save unstaged changes before rebase"', { cwd: 'd:/git__hub/argon-system', stdio: 'inherit' });
  } catch(e) {}
  execSync('git pull origin backup/pre-emr-integrity-lock --rebase', { cwd: 'd:/git__hub/argon-system', stdio: 'inherit' });
  execSync('git push origin HEAD', { cwd: 'd:/git__hub/argon-system', stdio: 'inherit' });
  console.log('Push succeeded after commit and rebase!');
} catch(e) { console.error(e.message); }
