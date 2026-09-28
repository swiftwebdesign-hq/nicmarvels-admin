import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(serverDir, '..');
const config = `/* Browser-safe settings only. Generated during Netlify build. */\nwindow.NIKSMARVEL_ADMIN_CONFIG = Object.freeze({\n  endpoint: 'https://fra.cloud.appwrite.io/v1',\n  projectId: '6ab957ac0016eae2fbb1',\n  apiBase: '',\n  publicFormUrl: '/'\n});\n`;
await import('node:fs/promises').then(({ writeFile }) => writeFile(path.resolve(rootDir, 'config.js'), config, 'utf8'));
await build({
  entryPoints: [path.resolve(rootDir, 'admin.js')],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  nodePaths: [path.resolve(rootDir, 'node_modules')],
  outfile: path.resolve(rootDir, 'admin.bundle.js'),
});
