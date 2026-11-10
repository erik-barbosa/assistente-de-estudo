'use server';

import { revalidatePath } from 'next/cache';
import { gerarEstudoDaSemana } from '../lib/estudos';

export async function gerarEstudoAgora() {
  try {
    const resultado = await gerarEstudoDaSemana();
    revalidatePath('/');

    if (!resultado.criado) {
      return { ok: true, mensagem: `O estudo de ${resultado.titulo} já está gerado.` };
    }
    return {
      ok: true,
      mensagem: `Estudo de ${resultado.titulo} gerado: ${resultado.totalRespostas} respostas a partir de ${resultado.fontesLidas} textos consultados.`,
    };
  } catch (error) {
    console.error('Falha ao gerar o estudo da semana:', error);
    return { ok: false, mensagem: error.message };
  }
}
