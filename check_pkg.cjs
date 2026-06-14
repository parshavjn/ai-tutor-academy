const pkg = require('./node_modules/@google/genai/package.json');
console.log('exports:', JSON.stringify(pkg.exports, null, 2));
console.log('main:', pkg.main);
console.log('module:', pkg.module);
console.log('type:', pkg.type);
