import fs from 'fs';
import path from 'path';

const iconSource = path.resolve('public', 'app-icon-halloween.jpg');
const resDir = path.resolve('android', 'app', 'src', 'main', 'res');

if (fs.existsSync(iconSource) && fs.existsSync(resDir)) {
  const mipmapDirs = fs.readdirSync(resDir).filter(d => d.startsWith('mipmap'));
  for (const dir of mipmapDirs) {
    const targetDir = path.join(resDir, dir);
    const filesToReplace = [
      'ic_launcher.png',
      'ic_launcher_round.png',
      'ic_launcher_foreground.png',
    ];
    for (const f of filesToReplace) {
      const dest = path.join(targetDir, f);
      try {
        fs.copyFileSync(iconSource, dest);
        console.log(`[Halloween Icon] Replaced: ${dest}`);
      } catch (err) {
        console.warn(`[Halloween Icon] Could not replace ${dest}:`, err.message);
      }
    }
  }
} else {
  console.log('[Halloween Icon] Resource directories not found or not yet generated.');
}
