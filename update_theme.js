const fs = require('fs');

// Helper to convert HSL to RGB
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return `${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}`;
}

// 1. Process globals.css
let css = fs.readFileSync('app/globals.css', 'utf8');

css = css.replace(/:\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%;/g, (match, h, s, l) => {
  return `: ${hslToRgb(parseFloat(h), parseFloat(s), parseFloat(l))};`;
});

// Also fix the scrollbar color fallback
css = css.replace(/hsl\(var\(--muted-foreground\)\s*\/\s*0\.4\)/g, 'rgba(var(--muted-foreground), 0.4)');

fs.writeFileSync('app/globals.css', css);

// 2. Process tailwind.config.ts
let tw = fs.readFileSync('tailwind.config.ts', 'utf8');

tw = tw.replace(/hsl\(var\(--([a-zA-Z0-9-]+)\)\)/g, 'rgba(var(--$1), <alpha-value>)');

fs.writeFileSync('tailwind.config.ts', tw);

console.log('Successfully updated theme to RGB comma-separated values.');
