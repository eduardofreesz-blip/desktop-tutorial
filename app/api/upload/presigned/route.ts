import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { generatePresignedUploadUrl } from '@/lib/s3';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { fileName, contentType, isPublic } = body;

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'fileName e contentType são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await generatePresignedUploadUrl(fileName, contentType, isPublic ?? true);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao gerar URL de upload:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar URL de upload' },
      { status: 500 }
    );
  }
}
