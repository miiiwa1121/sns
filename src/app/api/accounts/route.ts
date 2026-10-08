import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        platformConnections: true,
        projects: {
          include: {
            longFormVideo: true,
            shortClips: true,
            publishLogs: true,
            analytics: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        trendResearches: {
          orderBy: { createdAt: 'desc' },
        },
        agentKnowledges: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, accounts });
  } catch (error: any) {
    console.error('Failed to fetch accounts:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      category,
      concept,
      targetAudience,
      toneOfVoice,
      systemPromptRules,
      youtubeHandle,
      tiktokHandle,
      instagramHandle,
      xHandle,
    } = body;

    if (!name || !concept) {
      return NextResponse.json(
        { success: false, error: '名前とコンセプトは必須です' },
        { status: 400 }
      );
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') || `acc-${Date.now()}`;

    const newAccount = await prisma.account.create({
      data: {
        name,
        slug: `${slug}-${Math.floor(Math.random() * 1000)}`,
        category: category || 'AI・IT',
        concept,
        targetAudience: targetAudience || '一般ユーザー',
        toneOfVoice: toneOfVoice || '丁寧で親しみやすい',
        systemPromptRules: systemPromptRules || '',
        platformConnections: {
          create: [
            { platform: 'youtube', handle: youtubeHandle || '', isConnected: Boolean(youtubeHandle) },
            { platform: 'tiktok', handle: tiktokHandle || '', isConnected: Boolean(tiktokHandle) },
            { platform: 'instagram', handle: instagramHandle || '', isConnected: Boolean(instagramHandle) },
            { platform: 'x', handle: xHandle || '', isConnected: Boolean(xHandle) },
          ],
        },
      },
      include: {
        platformConnections: true,
        projects: true,
        trendResearches: true,
        agentKnowledges: true,
      },
    });

    return NextResponse.json({ success: true, account: newAccount });
  } catch (error: any) {
    console.error('Failed to create account:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
