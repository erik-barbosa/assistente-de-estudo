import { createClient } from '@supabase/supabase-js';
import { baixarMaterial, dataAlvo, inicioDaSemana, lerProgramacao, localizarSemana, UM_DIA } from './programacao';
import { gerarRespostas, gerarRespostasDaSentinela } from './respostas';
import { baixarTextosBiblicos, lerArtigo, localizarArtigo } from './sentinela';

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

function rotuloDaSemana(inicio) {
  const partes = (data) => ({
    dia: new Date(data).getUTCDate(),
    mes: new Date(data).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' }),
  });
  const de = partes(inicio);
  const ate = partes(inicio + 6 * UM_DIA);
  return de.mes === ate.mes ? `${de.dia}-${ate.dia} de ${ate.mes}` : `${de.dia} de ${de.mes}–${ate.dia} de ${ate.mes}`;
}

async function gerarMeioDeSemana(alvo) {
  const semana = await localizarSemana(alvo);
  const programacao = await lerProgramacao(semana.url);
  const material = await baixarMaterial(programacao.referencias);
  const { respostas, modelo } = await gerarRespostas(programacao, material);

  const secoes = programacao.secoes.map((secao) => ({
    titulo: secao.titulo,
    partes: secao.partes.map((parte) => ({
      ...parte,
      pontosPrincipais: respostas.get(parte.id)?.pontosPrincipais ?? [],
      respostas: respostas.get(parte.id)?.respostas ?? [],
    })),
  }));

  return {
    titulo: programacao.periodo,
    conteudo: {
      leituraSemanal: programacao.leituraSemanal,
      fonteUrl: programacao.url,
      modelo,
      fontes: material.map(({ titulo, url }) => ({ titulo, url })),
      secoes,
    },
    totalRespostas: secoes
      .flatMap((secao) => secao.partes)
      .reduce((total, parte) => total + parte.respostas.length, 0),
    fontesLidas: material.length,
  };
}

async function gerarFimDeSemana(alvo) {
  const { url } = await localizarArtigo(alvo);
  const artigo = await lerArtigo(url);
  const textosBiblicos = await baixarTextosBiblicos(artigo.perguntas);
  const { respostas, pontosPrincipais, modelo } = await gerarRespostasDaSentinela(artigo, textosBiblicos);

  const responder = ({ id, pergunta }) => ({
    pergunta,
    resposta: respostas.get(id)?.resposta ?? '',
    base: respostas.get(id)?.base ?? '',
  });

  const blocos = [];
  for (const pergunta of artigo.perguntas) {
    const ultimo = blocos.at(-1);
    if (ultimo && ultimo.subtitulo === pergunta.subtitulo) {
      ultimo.perguntas.push(responder(pergunta));
    } else {
      blocos.push({ subtitulo: pergunta.subtitulo, perguntas: [responder(pergunta)] });
    }
  }

  return {
    sentinela: {
      titulo: artigo.titulo,
      url: artigo.url,
      textoTema: artigo.textoTema,
      objetivo: artigo.objetivo,
      modelo,
      pontosPrincipais,
      blocos,
      recapitulacao: artigo.recapitulacao
        ? { titulo: artigo.recapitulacao.titulo, perguntas: artigo.recapitulacao.perguntas.map(responder) }
        : null,
    },
    totalRespostas: respostas.size,
    fontesLidas: 1 + textosBiblicos.length,
  };
}

/**
 * Gera cada reunião de uma semana no máximo uma vez: chamadas repetidas só completam o que ainda falta,
 * o que limita o gasto com IA mesmo que a rota seja acionada várias vezes.
 * Uma reunião que falha não impede que a outra seja salva.
 */
export async function gerarEstudoDaSemana({ data, forcar = false } = {}) {
  const supabase = supabaseAdmin();
  const alvo = dataAlvo(data);
  const inicio = inicioDaSemana(alvo);
  const semanaIso = new Date(inicio).toISOString().slice(0, 10);

  const { data: existente, error: erroDaConsulta } = await supabase
    .from('estudos')
    .select('titulo, conteudo')
    .eq('semana', semanaIso)
    .maybeSingle();
  if (erroDaConsulta) throw new Error(`Não foi possível consultar o banco: ${erroDaConsulta.message}`);

  const salvo = existente?.conteudo ?? {};
  const faltaMeioDeSemana = forcar || !(salvo.secoes?.length > 0);
  const faltaFimDeSemana = forcar || !salvo.sentinela;

  if (!faltaMeioDeSemana && !faltaFimDeSemana) {
    return { criado: false, semana: semanaIso, titulo: existente.titulo };
  }

  const [meioDeSemana, fimDeSemana] = await Promise.allSettled([
    faltaMeioDeSemana ? gerarMeioDeSemana(alvo) : null,
    faltaFimDeSemana ? gerarFimDeSemana(alvo) : null,
  ]);

  const avisos = [];
  if (meioDeSemana.status === 'rejected') {
    console.error('Falha ao gerar a reunião do meio de semana:', meioDeSemana.reason);
    avisos.push(`Reunião do meio de semana: ${meioDeSemana.reason.message}`);
  }
  if (fimDeSemana.status === 'rejected') {
    console.error('Falha ao gerar o estudo de A Sentinela:', fimDeSemana.reason);
    avisos.push(`Estudo de A Sentinela: ${fimDeSemana.reason.message}`);
  }

  const meio = meioDeSemana.value ?? null;
  const fim = fimDeSemana.value ?? null;
  if (!meio && !fim) throw new Error(avisos.join(' '));

  const titulo = meio?.titulo ?? existente?.titulo ?? rotuloDaSemana(inicio);
  const { error } = await supabase.from('estudos').upsert(
    {
      semana: semanaIso,
      titulo,
      conteudo: { ...salvo, ...meio?.conteudo, ...(fim ? { sentinela: fim.sentinela } : {}) },
      created_at: new Date().toISOString(),
    },
    { onConflict: 'semana' },
  );
  if (error) throw new Error(`Não foi possível salvar o estudo: ${error.message}`);

  return {
    criado: true,
    semana: semanaIso,
    titulo,
    reunioes: [meio ? 'reunião do meio de semana' : null, fim ? 'estudo de A Sentinela' : null].filter(Boolean),
    totalRespostas: (meio?.totalRespostas ?? 0) + (fim?.totalRespostas ?? 0),
    fontesLidas: (meio?.fontesLidas ?? 0) + (fim?.fontesLidas ?? 0),
    avisos,
  };
}
