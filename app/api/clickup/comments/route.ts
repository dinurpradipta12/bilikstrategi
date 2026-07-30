import { NextRequest, NextResponse } from 'next/server';
import { getTaskComments, createTaskComment } from '@/lib/clickup/comments';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const comments = await getTaskComments(taskId);
    return NextResponse.json(comments);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil komentar dari ClickUp' },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, commentText } = body;

    if (!taskId || !commentText) {
      return NextResponse.json({ error: 'taskId and commentText are required' }, { status: 400 });
    }

    const comment = await createTaskComment(taskId, commentText);
    return NextResponse.json(comment);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengirim komentar ke ClickUp' },
      { status: error.status || 500 }
    );
  }
}
