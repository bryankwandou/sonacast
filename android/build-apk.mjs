import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const ANDROID_DIR = path.join(ROOT, 'android');
const OUT_APK = path.join(ROOT, 'public', 'downloads', 'sonacast.apk');

// --- Minimal Pure-Node PNG Encoder (zero extra npm dependencies) ---
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodeRgbaPng(width, height, pixelFn) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const px = rowStart + 1 + x * 4;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function drawSonacastLauncherPixel(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const nx = (x - cx) / (w / 2);
  const ny = (y - cy) / (h / 2);
  const dist = Math.hypot(nx, ny);
  if (dist > 0.96) return [0, 0, 0, 0];

  // Dark obsidian rounded background with emerald sonic ring + waveform bars
  let r = 9;
  let g = 13;
  let b = 22;
  if (dist > 0.8 && dist < 0.91) {
    r = 16;
    g = 185;
    b = 129;
  } else {
    const absX = Math.abs(nx);
    const absY = Math.abs(ny);
    const bars = [
      { pos: 0.0, halfH: 0.42 },
      { pos: 0.18, halfH: 0.28 },
      { pos: 0.36, halfH: 0.18 }
    ];
    for (const bar of bars) {
      if (Math.abs(absX - bar.pos) < 0.055 && absY <= bar.halfH) {
        r = 52;
        g = 211;
        b = 153;
        break;
      }
    }
  }
  return [r, g, b, 255];
}

function drawNotificationSmallIconPixel(x, y, w, h) {
  // White monochrome vector-style silhouette on transparent ground
  const nx = (x - w / 2) / (w / 2);
  const ny = (y - h / 2) / (h / 2);
  const dist = Math.hypot(nx, ny);
  if (dist > 0.85 && dist < 0.96) return [255, 255, 255, 255];
  const absX = Math.abs(nx);
  const absY = Math.abs(ny);
  const bars = [
    { pos: 0.0, halfH: 0.5 },
    { pos: 0.24, halfH: 0.33 },
    { pos: 0.48, halfH: 0.2 }
  ];
  for (const bar of bars) {
    if (Math.abs(absX - bar.pos) < 0.07 && absY <= bar.halfH) {
      return [255, 255, 255, 255];
    }
  }
  return [0, 0, 0, 0];
}

// --- Locate Installed Toolchain ---
function resolveBinary(candidates) {
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function resolveSdk() {
  const sdkRoot =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk');

  const platformsDir = path.join(sdkRoot, 'platforms');
  const buildToolsDir = path.join(sdkRoot, 'build-tools');
  if (!fs.existsSync(platformsDir) || !fs.existsSync(buildToolsDir)) {
    throw new Error(`Android SDK not found under ${sdkRoot}`);
  }

  const platforms = fs
    .readdirSync(platformsDir)
    .filter((d) => /^android-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  const buildTools = fs.readdirSync(buildToolsDir).sort().reverse();

  const platformJar = path.join(platformsDir, platforms[0], 'android.jar');
  const btDir = path.join(buildToolsDir, buildTools[0]);

  const jbrBin = 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin';
  const jdkJava = resolveBinary([
    process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'javac.exe') : null,
    'C:\\Program Files\\Java\\jdk-20\\bin\\javac.exe',
    path.join(jbrBin, 'javac.exe')
  ]);
  const javacBin = jdkJava || 'javac';
  const jarBin =
    resolveBinary([
      path.dirname(javacBin) ? path.join(path.dirname(javacBin), 'jar.exe') : null,
      path.join(jbrBin, 'jar.exe')
    ]) || 'jar';
  const keytoolBin =
    resolveBinary([
      path.dirname(javacBin) ? path.join(path.dirname(javacBin), 'keytool.exe') : null,
      path.join(jbrBin, 'keytool.exe')
    ]) || 'keytool';

  return {
    platformJar,
    aapt2: path.join(btDir, 'aapt2.exe'),
    d8Jar: path.join(btDir, 'lib', 'd8.jar'),
    d8Bat: path.join(btDir, 'd8.bat'),
    zipalign: path.join(btDir, 'zipalign.exe'),
    apksignerJar: path.join(btDir, 'lib', 'apksigner.jar'),
    apksignerBat: path.join(btDir, 'apksigner.bat'),
    javaBin: resolveBinary([
      path.dirname(javacBin) ? path.join(path.dirname(javacBin), 'java.exe') : null,
      path.join(jbrBin, 'java.exe')
    ]) || 'java',
    javacBin,
    jarBin,
    keytoolBin
  };
}

function walkFiles(dir, extFilter) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, extFilter));
    } else if (!extFilter || full.endsWith(extFilter)) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const tools = resolveSdk();

  // Ensure crisp PWA + Android PNG icons exist
  fs.mkdirSync(path.join(ANDROID_DIR, 'res', 'mipmap-xhdpi'), { recursive: true });
  fs.mkdirSync(path.join(ANDROID_DIR, 'res', 'drawable-xxhdpi'), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_APK), { recursive: true });

  const icon192 = encodeRgbaPng(192, 192, drawSonacastLauncherPixel);
  const icon512 = encodeRgbaPng(512, 512, drawSonacastLauncherPixel);
  const notifIcon72 = encodeRgbaPng(72, 72, drawNotificationSmallIconPixel);

  fs.writeFileSync(path.join(ROOT, 'public', 'icon-192.png'), icon192);
  fs.writeFileSync(path.join(ROOT, 'public', 'icon-512.png'), icon512);
  fs.writeFileSync(path.join(ANDROID_DIR, 'res', 'mipmap-xhdpi', 'ic_launcher.png'), icon192);
  fs.writeFileSync(path.join(ANDROID_DIR, 'res', 'drawable-xxhdpi', 'ic_notif.png'), notifIcon72);

  const buildTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sonacast-apk-'));
  const resCompiledDir = path.join(buildTmp, 'res-compiled');
  const genSrcDir = path.join(buildTmp, 'gen');
  const classesDir = path.join(buildTmp, 'classes');
  const dexDir = path.join(buildTmp, 'dex');
  fs.mkdirSync(resCompiledDir, { recursive: true });
  fs.mkdirSync(genSrcDir, { recursive: true });
  fs.mkdirSync(classesDir, { recursive: true });
  fs.mkdirSync(dexDir, { recursive: true });

  const unalignedApk = path.join(buildTmp, 'sonacast-unaligned.apk');
  const alignedApk = path.join(buildTmp, 'sonacast-aligned.apk');
  const keystoreDir = path.join(os.homedir(), '.sonacast-signing');
  fs.mkdirSync(keystoreDir, { recursive: true });
  const keystorePath = path.join(keystoreDir, 'sonacast-release.jks');

  if (!fs.existsSync(keystorePath)) {
    execFileSync(tools.keytoolBin, [
      '-genkeypair',
      '-v',
      '-keystore',
      keystorePath,
      '-storepass',
      'sonacast2026',
      '-keypass',
      'sonacast2026',
      '-alias',
      'sonacast',
      '-keyalg',
      'RSA',
      '-keysize',
      '2048',
      '-validity',
      '10000',
      '-dname',
      'CN=Sonacast,O=Sonacast Media,C=ID'
    ], { stdio: 'inherit' });
  }

  // 1. Compile all Android resources via aapt2
  execFileSync(tools.aapt2, [
    'compile',
    '--dir',
    path.join(ANDROID_DIR, 'res'),
    '-o',
    path.join(resCompiledDir, 'res.zip')
  ], { stdio: 'inherit' });

  // 2. Link resources + AndroidManifest.xml -> base unaligned APK + R.java
  execFileSync(tools.aapt2, [
    'link',
    '-o',
    unalignedApk,
    '-I',
    tools.platformJar,
    '--manifest',
    path.join(ANDROID_DIR, 'AndroidManifest.xml'),
    '--java',
    genSrcDir,
    '-R',
    path.join(resCompiledDir, 'res.zip'),
    '--auto-add-overlay'
  ], { stdio: 'inherit' });

  // 3. Compile Java sources + generated R.java cleanly targeting Java 11 bytecode
  const javaSources = [
    ...walkFiles(path.join(ANDROID_DIR, 'src'), '.java'),
    ...walkFiles(genSrcDir, '.java')
  ];
  execFileSync(tools.javacBin, [
    '--release',
    '11',
    '-cp',
    tools.platformJar,
    '-d',
    classesDir,
    ...javaSources
  ], { stdio: 'inherit' });

  // 4. Convert .class -> classes.dex via d8
  const classFiles = walkFiles(classesDir, '.class');
  if (fs.existsSync(tools.d8Jar)) {
    execFileSync(tools.javaBin, [
      '-cp',
      tools.d8Jar,
      'com.android.tools.r8.D8',
      '--release',
      '--min-api',
      '26',
      '--lib',
      tools.platformJar,
      '--output',
      dexDir,
      ...classFiles
    ], { stdio: 'inherit' });
  } else {
    execFileSync('cmd.exe', [
      '/c',
      tools.d8Bat,
      '--release',
      '--min-api',
      '26',
      '--lib',
      tools.platformJar,
      '--output',
      dexDir,
      ...classFiles
    ], { stdio: 'inherit' });
  }

  // 5. Merge classes.dex into base APK while keeping resources.arsc uncompressed
  execFileSync(tools.jarBin, ['uf', unalignedApk, '-C', dexDir, 'classes.dex'], {
    stdio: 'inherit'
  });

  // 6. Align APK on 4-byte boundaries
  execFileSync(tools.zipalign, ['-f', '-p', '4', unalignedApk, alignedApk], {
    stdio: 'inherit'
  });

  // 7. Sign APK (v1 + v2 + v3) directly to final public/downloads/sonacast.apk
  if (fs.existsSync(tools.apksignerJar)) {
    execFileSync(tools.javaBin, [
      '-jar',
      tools.apksignerJar,
      'sign',
      '--v4-signing-enabled',
      'false',
      '--ks',
      keystorePath,
      '--ks-pass',
      'pass:sonacast2026',
      '--key-pass',
      'pass:sonacast2026',
      '--ks-key-alias',
      'sonacast',
      '--out',
      OUT_APK,
      alignedApk
    ], { stdio: 'inherit' });

    execFileSync(tools.javaBin, [
      '-jar',
      tools.apksignerJar,
      'verify',
      '--print-certs',
      OUT_APK
    ], { stdio: 'inherit' });
  } else {
    execFileSync('cmd.exe', [
      '/c',
      tools.apksignerBat,
      'sign',
      '--ks',
      keystorePath,
      '--ks-pass',
      'pass:sonacast2026',
      '--key-pass',
      'pass:sonacast2026',
      '--ks-key-alias',
      'sonacast',
      '--out',
      OUT_APK,
      alignedApk
    ], { stdio: 'inherit' });
  }

  const stats = fs.statSync(OUT_APK);
  console.log(`Built & verified signed APK: ${OUT_APK} (${stats.size} bytes)`);
  fs.rmSync(buildTmp, { recursive: true, force: true });
}

main();

