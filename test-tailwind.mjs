import tailwindcss from 'tailwindcss';
import postcss from 'postcss';
import config from './tailwind.config.ts';

const css = `
@tailwind base;
@tailwind components;
@tailwind utilities;
`;

postcss([tailwindcss(config)])
  .process(css, { from: undefined })
  .then((result) => {
    const lines = result.css.split('\n');
    const bgPrimaryLine = lines.findIndex(line => line.includes('.bg-primary'));
    if (bgPrimaryLine !== -1) {
      console.log(lines.slice(bgPrimaryLine, bgPrimaryLine + 5).join('\n'));
    } else {
      console.log('.bg-primary not found');
    }
  })
  .catch(err => console.error(err));
