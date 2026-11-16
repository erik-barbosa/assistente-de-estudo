'use server';

import { revalidatePath } from 'next/cache';
import { gerarEstudoDaSemana } from '../lib/estudos';

export async function gerarEstudoAgora() {
  try {
    const resultado = await gerarEstudoDaSemana();
    revalidatePath('/');

    if (!resultado.criado) {
      return { ok: true, mensagem: `Os estudos de ${resultado.titulo} já estão gerados.` };
    }

    const gerado = `${resultado.reunioes.join(' e ')} de ${resultado.titulo}, com ${resultado.totalRespostas} respostas a partir de ${resultado.fontesLidas} textos consultados`;
    if (resultado.avisos.length > 0) {
      return { ok: false, mensagem: `${resultado.avisos.join(' ')} Foi salvo apenas: ${gerado}.` };
    }
    return { ok: true, mensagem: `Gerado: ${gerado}.` };
  } catch (error) {
    console.error('Falha ao gerar o estudo da semana:', error);
    return { ok: false, mensagem: error.message };
  }
}
