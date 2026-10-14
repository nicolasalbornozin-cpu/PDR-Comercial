// Reproducible temporary mitigations; original package versions stay visible to npm audit.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const patchDir = path.join(__dirname, 'security-patches');
const patches = require('./security-patches/manifest.json');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const hash = value => crypto.createHash('sha256').update(value.replaceAll('\r\n', '\n')).digest('hex');
for (const patch of patches) {
  const installs = Object.keys(lock.packages).filter(p => p.endsWith('node_modules/' + patch.pkg));
  if (!installs.length) throw Error('Review obsolete security patch: ' + patch.pkg);
  for (const install of installs) {
    const dir = path.join(root, install);
    if (!fs.existsSync(dir)) throw Error('Missing dependency for security patch: ' + install);
    const version = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
    if (version !== patch.version) throw Error('Review security patch for new version: ' + patch.pkg);
    const target = path.join(dir, patch.file);
    const content = fs.readFileSync(target, 'utf8');
    if (hash(content) !== patch.patchedHash) {
      if (hash(content) !== patch.originalHash) throw Error('Unexpected source for security patch: ' + target);
      const updated = content.replace(patch.before, patch.after);
      if (hash(updated) !== patch.patchedHash) throw Error('Invalid security patch: ' + target);
      fs.writeFileSync(target, updated);
    }
    if (patch.pkg === 'braces') fs.copyFileSync(path.join(patchDir, 'braces-safe-ast.cjs'), path.join(dir, 'lib/pdr-safe-ast.js'));
  }
}
console.log('Security mitigations applied and verified (braces / node-forge).');
