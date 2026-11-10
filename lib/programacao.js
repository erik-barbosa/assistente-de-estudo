import * as cheerio from 'cheerio';

const ORIGEM = 'https://www.jw.org';
const INDICE_APOSTILAS = `${ORIGEM}/pt/biblioteca/jw-apostila-do-mes/`;
const MESES = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const UM_DIA = 86_400_000;
const MAX_REFERENCIAS = 16;
const LIMITE_POR_REFERENCIA = 14_000;
const DOWNLOADS_SIMULTANEOS = 4;

const limpar = (texto) => texto.replace(/\s+/g, ' ').trim();

function normalizarSlug(href) {
  let slug = href;
  try {
    slug = decodeURIComponent(href);
  } catch {
    // href com escape inválido: segue com o valor original
  }
  return slug
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function baixarPagina(url) {
  const resposta = await fetch(url, {
    cache: 'no-store',
    headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resposta.ok) {
    throw new Error(`O jw.org respondeu ${resposta.status} ao abrir ${url}`);
  }
  return cheerio.load(await resposta.text());
}

/**
 * Sem data explícita, a partir de sábado o alvo já é a semana seguinte:
 * o cron roda no domingo 00:00 UTC (sábado à noite no Brasil) para preparar a próxima reunião.
 */
export function dataAlvo(dataIso) {
  if (dataIso) {
    const [ano, mes, dia] = dataIso.split('-').map(Number);
    return Date.UTC(ano, mes - 1, dia);
  }
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
    .format(new Date())
    .split('-')
    .map(Number);
  return Date.UTC(ano, mes - 1, dia) + 2 * UM_DIA;
}

function periodoDaApostila(href) {
  const slug = normalizarSlug(href).match(/\/([^/]+)-mwb\/?$/)?.[1];
  const ano = Number(slug?.match(/(\d{4})$/)?.[1]);
  if (!slug || !ano) return null;

  const meses = slug
    .split('-')
    .map((parte) => MESES.indexOf(parte))
    .filter((indice) => indice >= 0);
  if (meses.length === 0) return null;

  return {
    inicio: Date.UTC(ano, Math.min(...meses), 1) - 7 * UM_DIA,
    fim: Date.UTC(ano, Math.max(...meses) + 1, 0) + 7 * UM_DIA,
  };
}

function periodoDaSemana(href) {
  const partes = normalizarSlug(href).match(
    /para-(\d{1,2})(?:-de-([a-z]+))?(?:-de-(\d{4}))?-(\d{1,2})-de-([a-z]+)-de-(\d{4})\/?$/,
  );
  if (!partes) return null;

  const [, diaInicio, mesInicio, anoInicio, diaFim, mesFim, anoFim] = partes;
  const indiceMesFim = MESES.indexOf(mesFim);
  const indiceMesInicio = mesInicio ? MESES.indexOf(mesInicio) : indiceMesFim;
  if (indiceMesFim < 0 || indiceMesInicio < 0) return null;

  return {
    inicio: Date.UTC(Number(anoInicio ?? anoFim), indiceMesInicio, Number(diaInicio)),
    fim: Date.UTC(Number(anoFim), indiceMesFim, Number(diaFim)),
  };
}

function linksUnicos($, filtro) {
  const hrefs = new Set();
  $('a[href]').each((_, link) => {
    const href = $(link).attr('href');
    if (filtro(href)) hrefs.add(href);
  });
  return [...hrefs];
}

export async function localizarSemana(alvo) {
  const $indice = await baixarPagina(INDICE_APOSTILAS);
  const apostilas = linksUnicos($indice, (href) => /\/jw-apostila-do-mes\/[^/]+-mwb\/?$/.test(href))
    .map((href) => ({ href, periodo: periodoDaApostila(href) }))
    .filter(({ periodo }) => periodo && alvo >= periodo.inicio && alvo <= periodo.fim);

  for (const apostila of apostilas) {
    const $apostila = await baixarPagina(new URL(apostila.href, ORIGEM).href);
    const semanas = linksUnicos($apostila, (href) => href.includes('-mwb/'))
      .map((href) => ({ href, periodo: periodoDaSemana(href) }))
      .filter(({ periodo }) => periodo);

    const semana = semanas.find(({ periodo }) => alvo >= periodo.inicio && alvo <= periodo.fim);
    if (semana) {
      return { url: new URL(semana.href, ORIGEM).href, ...semana.periodo };
    }
  }

  const dataLegivel = new Date(alvo).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  throw new Error(`Não encontrei no jw.org a programação da semana de ${dataLegivel}.`);
}

function classificarReferencia($link) {
  const classes = $link.attr('class') ?? '';
  if (classes.includes('jsBibleLink')) return 'biblia';
  if (/\bpub-(?!sjj\b)/.test(classes)) return 'publicacao';
  return null;
}

export async function lerProgramacao(url) {
  const $ = await baixarPagina(url);
  const corpo = $('article .bodyTxt').first();
  const periodo = limpar($('article h1').first().text());
  const leituraSemanal = limpar($('article h2').first().text());

  const secoes = [];
  const referencias = new Map();
  let secaoAtual = null;
  let parteAtual = null;
  let proximoId = 1;

  const abrirSecao = (titulo) => {
    secaoAtual = { titulo, partes: [] };
    secoes.push(secaoAtual);
  };

  corpo.find('h2, h3, p').each((_, elemento) => {
    const $elemento = $(elemento);
    const texto = limpar($elemento.text());
    if (!texto) return;

    if (elemento.tagName === 'h2') {
      if (texto !== leituraSemanal) abrirSecao(texto);
      return;
    }

    if (elemento.tagName === 'h3') {
      if (!secaoAtual) abrirSecao('Abertura');
      parteAtual = { id: proximoId++, titulo: texto, duracao: '', linhas: [] };
      secaoAtual.partes.push(parteAtual);
      return;
    }

    if (!parteAtual) return;

    let linha = texto;
    const duracao = linha.match(/^\((\d+)\s*min\)\s*/);
    if (duracao && !parteAtual.duracao) {
      parteAtual.duracao = `${duracao[1]} min`;
      linha = linha.slice(duracao[0].length);
    }
    if (linha) parteAtual.linhas.push(linha);

    $elemento.find('a[href]').each((__, link) => {
      const $link = $(link);
      const tipo = classificarReferencia($link);
      if (!tipo) return;

      const destino = new URL($link.attr('href'), ORIGEM);
      if (destino.origin !== ORIGEM) return;
      destino.hash = '';

      const referencia = referencias.get(destino.href) ?? {
        url: destino.href,
        tipo,
        rotulo: limpar($link.text()),
        partes: new Set(),
      };
      referencia.partes.add(parteAtual.id);
      referencias.set(destino.href, referencia);
    });
  });

  if (secoes.length === 0) {
    throw new Error(`A página ${url} não tem o formato esperado de programação da reunião.`);
  }

  return {
    url,
    periodo,
    leituraSemanal,
    secoes,
    referencias: [...referencias.values()].map((referencia) => ({
      ...referencia,
      partes: [...referencia.partes],
    })),
  };
}

async function baixarReferencia(referencia) {
  const $ = await baixarPagina(referencia.url);
  const titulo = limpar($('article h1').first().text()) || referencia.rotulo;
  let linhas;

  if (referencia.tipo === 'biblia') {
    $('#bibleText a.xrefLink, #bibleText a.footnoteLink').remove();
    // Versos poéticos vêm em spans colados; sem o espaço, as palavras de linhas vizinhas se juntam.
    $('#bibleText .verse span').append(' ');
    linhas = $('#bibleText .verse')
      .map((_, versiculo) => limpar($(versiculo).text()))
      .get();
  } else {
    const corpo = $('article .bodyTxt').first();
    corpo.find('.gen-field, figure, script, style, noscript').remove();
    linhas = corpo
      .find('h2, h3, p')
      .map((_, elemento) => limpar($(elemento).text()))
      .get();
  }

  const texto = linhas.filter(Boolean).join('\n').slice(0, LIMITE_POR_REFERENCIA);
  return { ...referencia, titulo, texto };
}

/** Uma referência que falha ao baixar não impede a geração: a IA apenas fica sem aquele texto. */
export async function baixarMaterial(referencias) {
  const fila = referencias.slice(0, MAX_REFERENCIAS);
  const material = [];

  for (let i = 0; i < fila.length; i += DOWNLOADS_SIMULTANEOS) {
    const lote = fila.slice(i, i + DOWNLOADS_SIMULTANEOS);
    const resultados = await Promise.allSettled(lote.map(baixarReferencia));
    for (const resultado of resultados) {
      if (resultado.status === 'fulfilled' && resultado.value.texto) {
        material.push(resultado.value);
      }
    }
  }

  return material;
}
