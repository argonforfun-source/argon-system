const fs = require('fs');
const { execSync } = require('child_process');

try {
  const files = ['lab-app.js', 'radiology-app.js', 'pharmacy-app.js', 'billing-engine.js', 'firebase-rules.json'];
  files.forEach(f => {
    fs.copyFileSync('d:/git__hub/clinica-system/' + f, 'd:/git__hub/argon-system/clinica-repo/' + f);
  });

  execSync('git add .', { cwd: 'd:/git__hub/argon-system/clinica-repo', stdio: 'inherit' });
  try {
    execSync('git commit -m "Production Readiness for Billing V1.5"', { cwd: 'd:/git__hub/argon-system/clinica-repo', stdio: 'inherit' });
  } catch(e) {} // ignore if no changes

  try {
    execSync('git push origin HEAD', { cwd: 'd:/git__hub/argon-system/clinica-repo', stdio: 'inherit' });
  } catch(e) {
    console.log("Failed to push clinica-repo, pushing argon-system instead.");
  }

  execSync('git add clinica-repo', { cwd: 'd:/git__hub/argon-system', stdio: 'inherit' });
  try {
    execSync('git commit -m "Update clinica-repo submodule for Production Readiness"', { cwd: 'd:/git__hub/argon-system', stdio: 'inherit' });
  } catch(e) {} // ignore if no changes

  execSync('git push origin HEAD', { cwd: 'd:/git__hub/argon-system', stdio: 'inherit' });
  console.log("Deployed successfully to argon-system!");
} catch (error) {
  console.error("Error during deployment:", error.message);
}
