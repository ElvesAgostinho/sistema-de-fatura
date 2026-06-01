const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');
const regex = /<style>\{`([\s\S]*?)`\}<\/style>/;
const match = code.match(regex);
if (match) {
  fs.writeFileSync('app/landing.css', match[1].trim());
  code = code.replace(regex, '');
  code = "import './landing.css';\n" + code;
  fs.writeFileSync('app/page.tsx', code);
  console.log('Success');
} else {
  console.log('No match');
}
