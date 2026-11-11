const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');

delete process.env.ELECTRON_SKIP_BINARY_DOWNLOAD;

const electronDir = path.join(__dirname, '../node_modules/electron');
const distDir = path.join(electronDir, 'dist');
const exePath = path.join(distDir, 'electron.exe');

if (fs.existsSync(exePath)) {
  console.log('Electron binary is already installed:', exePath);
  process.exit(0);
}

const { downloadArtifact } = require('@electron/get');
const { version } = require(path.join(electronDir, 'package.json'));
const checksums = require(path.join(electronDir, 'checksums.json'));

// Keep Node 26 event loop alive until extraction finishes
const keepAlive = setInterval(() => {}, 1000);

async function run() {
  console.log(`Ensuring Electron v${version} binary...`);
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    checksums,
    platform: process.platform,
    arch: process.arch,
  });
  console.log('Downloaded zip at:', zipPath);

  fs.mkdirSync(distDir, { recursive: true });
  console.log('Extracting Electron archive...');
  childProcess.execFileSync('tar.exe', ['-xf', zipPath, '-C', distDir], {
    stdio: 'inherit',
  });

  fs.writeFileSync(path.join(electronDir, 'path.txt'), 'electron.exe', 'utf-8');
  console.log('Electron successfully extracted:', fs.existsSync(exePath));
  clearInterval(keepAlive);
}

run().catch((err) => {
  console.error(err);
  clearInterval(keepAlive);
  process.exit(1);
});
