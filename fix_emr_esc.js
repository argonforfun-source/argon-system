const fs = require('fs');
let code = fs.readFileSync('./clinica-repo/emr-app.js', 'utf8');

// Fix escaped backticks
code = code.replace(/\\`/g, '`');

// Fix escaped template interpolations
code = code.replace(/\\\$\{/g, '${');

fs.writeFileSync('./clinica-repo/emr-app.js', code);
console.log('Fixed emr-app.js escaping');
