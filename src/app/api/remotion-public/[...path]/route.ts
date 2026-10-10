import fs from 'fs';
import path from 'path';

// 動画テンプレートの固定素材（remotion/public/）を返す。管理画面の試作プレビュー（ブラウザ上の Remotion Player）が使う。
// Player の staticFile('brand/…') は /brand/… を指すため、next.config.ts の rewrites でここへ回す。
const PUBLIC_DIR = path.resolve(process.cwd(), 'remotion/public');
const ALLOWED = /^brand\/[A-Za-z0-9_-]+\.(png|svg)$/;
const TYPES: Record<string, string> = { '.png': 'image/png', '.svg': 'image/svg+xml' };

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const rel = (await params).path.join('/');
  if (!ALLOWED.test(rel)) return new Response('Not Found', { status: 404 });
  const file = path.join(PUBLIC_DIR, rel);
  if (!fs.existsSync(file)) return new Response('Not Found', { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { 'Content-Type': TYPES[path.extname(file)], 'Cache-Control': 'public, max-age=3600' },
  });
}
