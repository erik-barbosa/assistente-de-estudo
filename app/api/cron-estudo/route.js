import { NextResponse } from 'next/server';
import { gerarEstudoDaSemana } from '../../../lib/estudos';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request) {
  const segredo = process.env.CRON_SECRET;
  const autorizado = Boolean(segredo) && request.headers.get('authorization') === `Bearer ${segredo}`;

  if (segredo && !autorizado) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado.' }, { status: 401 });
  }

  // Escolher outra semana ou refazer um estudo custa uma nova chamada de IA, então exige o CRON_SECRET.
  const parametros = new URL(request.url).searchParams;
  const data = parametros.get('data');
  const opcoes = {};
  if (autorizado) {
    if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return NextResponse.json({ sucesso: false, erro: 'Use data no formato AAAA-MM-DD.' }, { status: 400 });
    }
    if (data) opcoes.data = data;
    opcoes.forcar = parametros.get('forcar') === '1';
  }

  try {
    const resultado = await gerarEstudoDaSemana(opcoes);
    return NextResponse.json({
      sucesso: true,
      mensagem: resultado.criado
        ? 'Programação lida e respostas geradas com sucesso.'
        : 'O estudo desta semana já estava gerado.',
      ...resultado,
    });
  } catch (error) {
    console.error('Falha ao gerar o estudo da semana:', error);
    return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
}
