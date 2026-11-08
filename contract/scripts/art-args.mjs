// Build the contract's init args: the default kitchen plus Mochi's wallet pictures from design/,
// minified and encoded as data URIs. Usage: node contract/scripts/art-args.mjs <kitchen-account> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const design = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'design');
const [kitchen, out] = process.argv.slice(2);
if (!kitchen || !out) {
  console.error('Usage: node contract/scripts/art-args.mjs <kitchen-account> <out.json>');
  process.exit(1);
}

const minify = (svg) => svg.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
// Percent-encode only what a data URI needs, which keeps it far smaller than base64.
const dataUri = (path) =>
  'data:image/svg+xml;charset=utf-8,' +
  minify(readFileSync(join(design, path), 'utf8')).replace(/[%#<>"\n]/g, (c) => encodeURIComponent(c));

const art = {
  egg: dataUri('mochi/svg/egg/content.svg'),
  baby: dataUri('mochi/svg/baby/content.svg'),
  child: dataUri('mochi/svg/child/content.svg'),
  teen: dataUri('mochi/svg/teen/content.svg'),
  adult: dataUri('mochi/svg/adult/content.svg'),
  asleep: dataUri('mochi/svg/child/hibernating.svg'),
  icon: dataUri('brand/app-icon.svg'),
};
for (const [k, v] of Object.entries(art)) console.log(`${k}: ${v.length} chars`);
writeFileSync(out, JSON.stringify({ default_kitchen: kitchen, art }));
