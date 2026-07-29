import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const webDir = 'dist/client';
const assetsDir = join(webDir, 'assets');

function findAsset(pattern: RegExp): string | null {
  try {
    const files = readdirSync(assetsDir);
    const match = files.find((f) => pattern.test(f));
    return match ? `assets/${match}` : null;
  } catch {
    return null;
  }
}

function findEntry(prefix: string): string | null {
  const pattern = new RegExp(`^${prefix}-[A-Za-z0-9_-]+\\.js$`);
  return findAsset(pattern);
}

function findIcon(name: string): string | null {
  try {
    const files = readdirSync(webDir);
    const match = files.find((f) => f.startsWith(name));
    return match ? match : null;
  } catch {
    return null;
  }
}

const styles = findAsset(/^styles-[A-Za-z0-9]+\.css$/);
const mainJs = findAsset(/^index-[A-Za-z0-9]+\.js$/);
const clientJs = findAsset(/^client-[A-Za-z0-9]+\.js$/);
const favicon = findIcon('favicon');
const icon192 = findIcon('icon-192');

if (!mainJs) {
  console.error('Could not find main entry JS in dist/client/assets');
  process.exit(1);
}

const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#0F172A" />
  <title>Good-App</title>
  ${favicon ? `<link rel="icon" type="image/png" href="${favicon}" />` : ''}
  ${icon192 ? `<link rel="apple-touch-icon" href="${icon192}" />` : ''}
  ${styles ? `<link rel="stylesheet" href="${styles}" />` : ''}
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${mainJs}"></script>
  ${clientJs && clientJs !== mainJs ? `<script type="module" src="${clientJs}"></script>` : ''}
</body>
</html>
`;

writeFileSync(join(webDir, 'index.html'), html);
console.log(`Generated ${join(webDir, 'index.html')}`);
console.log(`  styles: ${styles}`);
console.log(`  main:   ${mainJs}`);
console.log(`  client: ${clientJs}`);
