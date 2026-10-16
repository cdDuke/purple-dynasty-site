/**
 * Копирует библиотеки и шрифты из node_modules в папки сайта
 * и вытаскивает контуры букв P и D из шрифта Anton для 3D-логотипа.
 * Запуск: npm run vendor (нужен один раз после npm install).
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODE_MODULES = join(ROOT, 'node_modules');

const THREE_FILES = [
  ['three/build/three.module.min.js', 'vendor/three/three.module.min.js'],
  ['three/examples/jsm/environments/RoomEnvironment.js', 'vendor/three/addons/environments/RoomEnvironment.js'],
  ['three/examples/jsm/loaders/SVGLoader.js', 'vendor/three/addons/loaders/SVGLoader.js'],
  ['three/examples/jsm/geometries/RoundedBoxGeometry.js', 'vendor/three/addons/geometries/RoundedBoxGeometry.js'],
  ['three/LICENSE', 'vendor/three/LICENSE'],
];

// Anton — латиница и цифры, Oswald Bold (тот же автор) — кириллица: у Anton её нет.
const FONT_FILES = [
  ['@fontsource/anton/files/anton-latin-400-normal.woff2', 'fonts/anton-latin.woff2'],
  ['@fontsource/anton/files/anton-latin-ext-400-normal.woff2', 'fonts/anton-latin-ext.woff2'],
  ['@fontsource/oswald/files/oswald-cyrillic-700-normal.woff2', 'fonts/oswald-cyrillic-700.woff2'],
  ['@fontsource/oswald/files/oswald-cyrillic-ext-700-normal.woff2', 'fonts/oswald-cyrillic-ext-700.woff2'],
  ['@fontsource/anton/LICENSE', 'fonts/LICENSE-anton.txt'],
  ['@fontsource/oswald/LICENSE', 'fonts/LICENSE-oswald.txt'],
];

const ANTON_SOURCE = '@fontsource/anton/files/anton-latin-400-normal.woff';
// Буквы в логотипе стоят вплотную, как на референсе ANTON.
const LOGO_LETTER_GAP = -6;
const SVG_PRECISION = 1;

function copyAll(pairs) {
  for (const [from, to] of pairs) {
    const target = join(ROOT, to);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(NODE_MODULES, from), target);
    console.log(`  ${to}`);
  }
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function extractLogoGlyphs() {
  const font = opentype.parse(toArrayBuffer(readFileSync(join(NODE_MODULES, ANTON_SOURCE))));
  const unitsPerEm = font.unitsPerEm;
  const p = font.charToGlyph('P');
  const d = font.charToGlyph('D');
  const capHeight = font.tables.os2?.sCapHeight || p.getBoundingBox().y2;

  const pBox = p.getBoundingBox();
  const dBox = d.getBoundingBox();
  // P начинается с x = 0, D ставим вплотную к правому краю P.
  const pShift = -pBox.x1;
  const dShift = pShift + pBox.x2 + LOGO_LETTER_GAP - dBox.x1;
  const width = dShift + dBox.x2;

  // getPath(x, baselineY, size): размер = unitsPerEm, чтобы координаты были в единицах шрифта.
  const pPath = p.getPath(pShift, capHeight, unitsPerEm).toPathData(SVG_PRECISION);
  const dPath = d.getPath(dShift, capHeight, unitsPerEm).toPathData(SVG_PRECISION);

  return Object.freeze({ width: Math.round(width), height: capHeight, pPath, dPath });
}

function writeGlyphModule(glyphs) {
  const source = `// Сгенерировано scripts/vendor.mjs из шрифта Anton — не править руками.
// Координаты в единицах шрифта, ось Y вниз (как в SVG), базовая линия = height.
export const PD_GLYPHS = Object.freeze({
  width: ${glyphs.width},
  height: ${glyphs.height},
  p: '${glyphs.pPath}',
  d: '${glyphs.dPath}',
});
`;
  writeFileSync(join(ROOT, 'js/logo/glyphs.js'), source);
  console.log('  js/logo/glyphs.js');
}

function writeLogoSvg(glyphs) {
  const pad = 40;
  const viewBox = `${-pad} ${-pad} ${glyphs.width + pad * 2} ${glyphs.height + pad * 2}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <defs>
    <linearGradient id="m" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4f5f8"/>
      <stop offset=".45" stop-color="#a9adb8"/>
      <stop offset=".55" stop-color="#e6e8ee"/>
      <stop offset="1" stop-color="#6e7280"/>
    </linearGradient>
  </defs>
  <path fill="url(#m)" d="${glyphs.pPath}${glyphs.dPath}"/>
</svg>
`;
  writeFileSync(join(ROOT, 'img/logo.svg'), svg);

  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <rect x="${-pad}" y="${-pad}" width="${glyphs.width + pad * 2}" height="${glyphs.height + pad * 2}" rx="160" fill="#14091f"/>
  <path fill="#c9b6ff" transform="translate(${glyphs.width * 0.1} ${glyphs.height * 0.1}) scale(.8)" d="${glyphs.pPath}${glyphs.dPath}"/>
</svg>
`;
  writeFileSync(join(ROOT, 'img/favicon.svg'), favicon);
  console.log('  img/logo.svg, img/favicon.svg');
}

console.log('three.js:');
copyAll(THREE_FILES);
console.log('шрифты:');
copyAll(FONT_FILES);
console.log('логотип:');
mkdirSync(join(ROOT, 'js/logo'), { recursive: true });
mkdirSync(join(ROOT, 'img'), { recursive: true });
const glyphs = extractLogoGlyphs();
writeGlyphModule(glyphs);
writeLogoSvg(glyphs);
console.log(`готово: логотип ${glyphs.width}×${glyphs.height}`);
