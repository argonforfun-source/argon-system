const fs = require('fs');
let code = fs.readFileSync('./clinica-repo/argon-nid-gate.js', 'utf8');

// Fix escaped backticks
code = code.replace(/\\`/g, '`');

// Fix escaped template interpolations
code = code.replace(/\\\$\{/g, '${');

// Fix double backslashes in regex
code = code.replace(/\\\\d/g, '\\d');
code = code.replace(/\\\\s/g, '\\s');
code = code.replace(/\\\\-/g, '\\-');

fs.writeFileSync('./clinica-repo/argon-nid-gate.js', code);
console.log('Fixed argon-nid-gate.js escaping');
