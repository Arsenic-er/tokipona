const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { execFile, execFileSync } = require('node:child_process');
const packageFile = require.resolve('electron/package.json');
const electronRequire = createRequire(packageFile);
const folder = path.dirname(packageFile);
const { version } = electronRequire('./package.json');
const dist = path.join(folder, 'dist');
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This local build targets Windows x64');
async function main() {
if (fs.existsSync(path.join(dist, 'electron.exe')) && fs.existsSync(path.join(folder, 'path.txt')) &&
    fs.readFileSync(path.join(dist, 'version'), 'utf8').trim().replace(/^v/, '') === version) {
  console.log('Electron runtime ready: ' + version);
} else {
  const name = `electron-v${version}-win32-x64.zip`;
  const cache = path.resolve('.codex-tmp/desktop-runtime');
  fs.mkdirSync(cache, { recursive: true });
  const archive = path.join(cache, name);
  const expected = electronRequire('./checksums.json')[name];
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('Official runtime checksum is unavailable');
  const valid = () => fs.existsSync(archive) && crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex') === expected;
  if (!valid()) {
    const url = `https://github.com/electron/electron/releases/download/v${version}/${name}`;
    const headers = execFileSync('curl.exe', ['--fail', '--head', '--location', '--silent', '--show-error', '--max-time', '30', url],
      { encoding: 'utf8', windowsHide: true });
    const size = Number([...headers.matchAll(/content-length:\s*(\d+)/gi)].at(-1)?.[1]);
    if (!Number.isSafeInteger(size) || size < 1000000 || size > 500000000) throw new Error('Unexpected Electron download size');
    const partSize = Math.ceil(size / 8);
    const files = Array.from({ length: 8 }, (_, index) => archive + '.part' + index);
    console.log(`Downloading verified runtime in 8 ranges (${size} bytes)`);
    const downloads = await Promise.allSettled(files.map((file, index) => {
      const start = index * partSize, end = Math.min(size - 1, start + partSize - 1);
      if (fs.existsSync(file) && fs.statSync(file).size === end - start + 1) return Promise.resolve();
      return new Promise((resolve, reject) => execFile('curl.exe', ['--fail', '--location', '--silent', '--show-error',
        '--retry', '2', '--max-time', '240', '--range', `${start}-${end}`, '--output', file, url],
        { windowsHide: true }, error => {
          if (error) reject(error);
          else if (fs.statSync(file).size !== end - start + 1) reject(new Error('Runtime range length mismatch'));
          else { console.log(`Runtime range ${index + 1}/8 ready`); resolve(); }
        }));
    }));
    const failed = downloads.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    fs.writeFileSync(archive, Buffer.concat(files.map(file => fs.readFileSync(file))));
    if (!valid()) throw new Error('Official Electron runtime checksum mismatch');
    for (const file of files) fs.unlinkSync(file);
  }
  if (!valid()) throw new Error('Official Electron runtime checksum mismatch');
  await electronRequire('@electron-internal/extract-zip').extract(archive, { dir: dist });
  fs.writeFileSync(path.join(folder, 'path.txt'), 'electron.exe');
  console.log('Electron runtime verified: ' + version);
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });
