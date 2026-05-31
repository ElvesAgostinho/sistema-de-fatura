const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (['node_modules', '.git', '.next', 'build', 'out'].includes(file)) continue;
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      content = content.replace(/\\u([0-9a-fA-F]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16)));
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed:', fullPath);
      }
    }
  }
}
processDir(process.cwd());
