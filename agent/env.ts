import fs from 'fs';

// Next.js は .env.local を自動で読むが、tsx で動く CLI は読まないため明示的に読む。
// 他モジュールが import 時に process.env を参照するので、cli.ts の先頭で import すること。
for (const file of ['.env.local', '.env']) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
