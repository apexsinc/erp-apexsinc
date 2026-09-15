const fs = require('fs');
const path = require('path');

// Extract base64 logo data from src/ui/assets/logo.ts
const logoTsPath = path.join(__dirname, 'src', 'ui', 'assets', 'logo.ts');
const logoTsContent = fs.readFileSync(logoTsPath, 'utf8');
const match = logoTsContent.match(/APEXS_LOGO_BASE64\s*=\s*'data:image\/png;base64,([^']+)'/);

if (!match) {
  console.error('Could not extract APEXS_LOGO_BASE64 from ' + logoTsPath);
  process.exit(1);
}

const logoBuffer = Buffer.from(match[1], 'base64');
console.log(`Extracted official Apexs logo (${logoBuffer.length} bytes)`);

// 1. Write to dist/assets
const distAssetsDir = path.join(__dirname, 'dist', 'assets');
if (!fs.existsSync(distAssetsDir)) {
  fs.mkdirSync(distAssetsDir, { recursive: true });
}

fs.writeFileSync(path.join(distAssetsDir, 'logo.png'), logoBuffer);
fs.writeFileSync(path.join(distAssetsDir, 'icon-192.png'), logoBuffer);
fs.writeFileSync(path.join(distAssetsDir, 'icon-512.png'), logoBuffer);
console.log('✓ Generated dist/assets/logo.png, icon-192.png, icon-512.png');

// 2. Write to android resources if android project exists
const androidResDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(androidResDir)) {
  const mipmapDirs = [
    'mipmap-mdpi',
    'mipmap-hdpi',
    'mipmap-xhdpi',
    'mipmap-xxhdpi',
    'mipmap-xxxhdpi'
  ];

  for (const dir of mipmapDirs) {
    const targetDir = path.join(androidResDir, dir);
    if (fs.existsSync(targetDir)) {
      fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), logoBuffer);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), logoBuffer);
      fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), logoBuffer);
    }
  }

  // Splash resource
  const drawableDirs = ['drawable', 'drawable-land-mdpi', 'drawable-land-hdpi', 'drawable-land-xhdpi', 'drawable-land-xxhdpi', 'drawable-port-mdpi', 'drawable-port-hdpi', 'drawable-port-xhdpi', 'drawable-port-xxhdpi'];
  for (const d of drawableDirs) {
    const targetDir = path.join(androidResDir, d);
    if (fs.existsSync(targetDir)) {
      fs.writeFileSync(path.join(targetDir, 'splash.png'), logoBuffer);
    }
  }
  console.log('✓ Updated Android mipmap and splash resources with Apexs logo');
}

console.log('Mobile assets generation complete.');
