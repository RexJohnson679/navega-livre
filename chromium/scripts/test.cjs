'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const tests = path.resolve(__dirname, '../tests');
const files = fs.readdirSync(tests).filter(name => name.endsWith('.test.cjs')).sort().map(name => path.join(tests, name));
const result = spawnSync(process.execPath, ['--test', ...files], {stdio: 'inherit'});
if (result.error) { console.error(result.error.message); process.exitCode = 1; }
else process.exitCode = result.status ?? 1;
