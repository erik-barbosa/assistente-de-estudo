import { createClient } from '@supabase/supabase-js';
import { baixarMaterial, dataAlvo, lerProgramacao, localizarSemana } from './programacao';
import { gerarRespostas } from './respostas';

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error('As variáveis de ambiente do Supabase não estão configuradas neste projeto.');
  }
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function listarEstudos() {
  const { data, error } = await supabaseAdmin()
    .from('estudos')
    .select('id, semana, titulo, conteudo, created_at')
    .order('semana', { ascending: false })
    .limit(12);

  if (error) throw new Error(`Não foi possível carregar os estudos: ${error.message}`);
  return data ?? [];
}

/**
 * Gera o estudo de uma semana no máximo uma vez: chamadas repetidas devolvem o que já está salvo,
 * o que limita o gasto com IA mesmo que a rota seja acionada várias vezes.
 */
export async function gerarEstudoDaSemana({ data, forcar = false } = {}) {
  const supabase = supabaseAdmin();
  const semana = await localizarSemana(dataAlvo(data));
  const semanaIso = new Date(semana.inicio).toISOString().slice(0, 10);

  if (!forcar) {
    const { data: existente, error } = await supabase
      .from('estudos')
      .select('titulo')
      .eq('semana', semanaIso)
      .maybeSingle();
    if (error) throw new Error(`Não foi possível consultar o banco: ${error.message}`);
    if (existente) return { criado: false, semana: semanaIso, titulo: existente.titulo };
  }

  const programacao = await lerProgramacao(semana.url);
  const material = await baixarMaterial(programacao.referencias);
  const { respostas, modelo } = await gerarRespostas(programacao, material);

  const conteudo = {
    leituraSemanal: programacao.leituraSemanal,
    fonteUrl: programacao.url,
    modelo,
    fontes: material.map(({ titulo, url }) => ({ titulo, url })),
    secoes: programacao.secoes.map((secao) => ({
      titulo: secao.titulo,
      partes: secao.partes.map((parte) => ({
        ...parte,
        pontosPrincipais: respostas.get(parte.id)?.pontosPrincipais ?? [],
        respostas: respostas.get(parte.id)?.respostas ?? [],
      })),
    })),
  };

  const { error } = await supabase.from('estudos').upsert(
    {
      semana: semanaIso,
      titulo: programacao.periodo,
      conteudo,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'semana' },
  );
  if (error) throw new Error(`Não foi possível salvar o estudo: ${error.message}`);

  const totalRespostas = conteudo.secoes
    .flatMap((secao) => secao.partes)
    .reduce((total, parte) => total + parte.respostas.length, 0);

  return {
    criado: true,
    semana: semanaIso,
    titulo: programacao.periodo,
    totalRespostas,
    fontesLidas: material.length,
  };
}
