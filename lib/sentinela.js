import { baixarPagina, limpar, MESES, normalizarSlug, ORIGEM, UM_DIA } from './programacao';

const INDICE_REVISTAS = `${ORIGEM}/pt/biblioteca/revistas/`;
const MAX_TEXTOS_BIBLICOS = 12;

// Os artigos de uma edição são estudados cerca de dois meses depois do mês da capa.
const ANTECEDENCIA_MINIMA = 20 * UM_DIA;
const ANTECEDENCIA_TIPICA = 75 * UM_DIA;
const ANTECEDENCIA_MAXIMA = 125 * UM_DIA;

const PERIODO =
  /(\d{1,2})(?: de ([a-z]+))?(?: (?:de )?(\d{4}))?\s?[-–—]\s?(\d{1,2}) de ([a-z]+) (?:de )?(\d{4})/;

/** Entende "9-15 DE NOVEMBRO DE 2026", "26 de outubro–1.º de novembro de 2026" e variações. */
function periodoDoTexto(texto) {
  const partes = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.?[º°]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .match(PERIODO);
  if (!partes) return null;

  const [, diaInicio, mesInicio, anoInicio, diaFim, mesFim, anoFim] = partes;
  const indiceMesFim = MESES.indexOf(mesFim);
  const indiceMesInicio = mesInicio ? MESES.indexOf(mesInicio) : indiceMesFim;
  if (indiceMesFim < 0 || indiceMesInicio < 0) return null;

  const viradaDeAno = indiceMesInicio > indiceMesFim;
  return {
    inicio: Date.UTC(Number(anoInicio ?? (viradaDeAno ? anoFim - 1 : anoFim)), indiceMesInicio, Number(diaInicio)),
    fim: Date.UTC(Number(anoFim), indiceMesFim, Number(diaFim)),
  };
}

async function listarEdicoes(alvo) {
  const anos = new Set(
    [alvo - ANTECEDENCIA_MAXIMA, alvo - ANTECEDENCIA_MINIMA].map((data) => new Date(data).getUTCFullYear()),
  );
  const edicoes = new Map();

  for (const ano of anos) {
    const $ = await baixarPagina(`${INDICE_REVISTAS}?contentLanguageFilter=pt&pubFilter=w&yearFilter=${ano}`);
    $('a[href]').each((_, link) => {
      const href = $(link).attr('href');
      const partes = normalizarSlug(href).match(/\/revistas\/(?:a-)?sentinela-estudo-([a-z]+)-(\d{4})\/?$/);
      const mes = MESES.indexOf(partes?.[1]);
      if (mes < 0) return;

      const capa = Date.UTC(Number(partes[2]), mes, 1);
      if (alvo - capa >= ANTECEDENCIA_MINIMA && alvo - capa <= ANTECEDENCIA_MAXIMA) {
        edicoes.set(href, Math.abs(alvo - ANTECEDENCIA_TIPICA - capa));
      }
    });
  }

  return [...edicoes.entries()].sort((a, b) => a[1] - b[1]).map(([href]) => href);
}

export async function localizarArtigo(alvo) {
  for (const edicao of await listarEdicoes(alvo)) {
    const $ = await baixarPagina(new URL(edicao, ORIGEM).href);

    for (const sinopse of $('.synopsis').toArray()) {
      const $sinopse = $(sinopse);
      const href = $sinopse.find('a[href]').first().attr('href');
      const periodo = periodoDoTexto(
        $sinopse
          .find('.contextTitle, .desc')
          .map((_, elemento) => $(elemento).text())
          .get()
          .join(' | '),
      );
      if (href && periodo && alvo >= periodo.inicio && alvo <= periodo.fim) {
        return { url: new URL(href, ORIGEM).href, ...periodo };
      }
    }
  }

  const dataLegivel = new Date(alvo).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  throw new Error(`Não encontrei no jw.org o artigo de A Sentinela da semana de ${dataLegivel}.`);
}

function textosCitados($, $pergunta) {
  const textos = [];

  $pergunta.find('a.jsBibleLink[href]').each((_, link) => {
    const destino = new URL($(link).attr('href'), ORIGEM);
    const versiculos = destino.hash.match(/^#v(\d+)(?:-v(\d+))?$/);
    if (!versiculos || destino.origin !== ORIGEM) return;
    destino.hash = '';

    // "2 Crônicas 20:5, 6, 10-12" vem em dois links, e o segundo ("10-12") não repete o livro.
    let rotulo = limpar($(link).text()).replace(/[,;]$/, '');
    const capituloAnterior = textos.at(-1)?.rotulo.match(/^(.*?\d+):/)?.[1];
    if (!/[a-zà-ú]/i.test(rotulo) && capituloAnterior) rotulo = `${capituloAnterior}:${rotulo}`;

    textos.push({
      rotulo,
      url: destino.href,
      de: Number(versiculos[1]),
      ate: Number(versiculos[2] ?? versiculos[1]),
    });
  });

  return textos;
}

export async function lerArtigo(url) {
  const $ = await baixarPagina(url);
  const artigo = $('article').first();
  artigo.find('.gen-field, a.footnoteLink, script, style, noscript').remove();

  const corpo = artigo.find('.bodyTxt').first();
  const rotuloObjetivo = artigo.find('p').filter((_, p) => /^objetivo$/i.test(limpar($(p).text()))).first();

  const perguntas = [];
  let subtitulo = null;

  corpo.find('h2, p').each((_, elemento) => {
    const $elemento = $(elemento);
    const texto = limpar($elemento.text());
    if (!texto) return;

    if (elemento.tagName === 'h2') {
      // Subtítulos do artigo são filhos diretos do corpo; os de quadros ficam aninhados.
      if (elemento.parent === corpo[0]) subtitulo = texto;
      return;
    }

    if ($elemento.hasClass('qu')) {
      perguntas.push({
        id: perguntas.length + 1,
        subtitulo,
        pergunta: texto,
        paragrafos: [],
        textos: textosCitados($, $elemento),
      });
      return;
    }

    const legenda = $elemento.closest('figcaption').length > 0;
    perguntas.at(-1)?.paragrafos.push(legenda ? `Legenda da imagem: ${texto}` : texto);
  });

  if (perguntas.length === 0) {
    throw new Error(`A página ${url} não tem o formato esperado de artigo de estudo de A Sentinela.`);
  }

  const quadro = artigo
    .find('aside')
    .filter((_, aside) => $(aside).closest('.bodyTxt').length === 0 && $(aside).find('li').length > 0)
    .first();
  const perguntasDoQuadro = quadro
    .find('li')
    .map((_, item) => limpar($(item).text()))
    .get()
    .filter(Boolean)
    .map((pergunta, indice) => ({ id: perguntas.length + indice + 1, pergunta }));

  return {
    url,
    titulo: limpar(artigo.find('header h1').first().text()),
    periodo: limpar(artigo.find('header .contextTtl').first().text()),
    textoTema: limpar(artigo.find('p.themeScrp').first().text()),
    objetivo: limpar(rotuloObjetivo.next('p').text()),
    perguntas,
    recapitulacao:
      perguntasDoQuadro.length > 0
        ? { titulo: limpar(quadro.find('h2').first().text()) || 'Recapitulação', perguntas: perguntasDoQuadro }
        : null,
  };
}

/** Só os versículos citados nas perguntas. Um texto que falha ao baixar não impede a geração. */
export async function baixarTextosBiblicos(perguntas) {
  const referencias = perguntas
    .flatMap((pergunta) => pergunta.textos.map((texto) => ({ ...texto, pergunta: pergunta.id })))
    .slice(0, MAX_TEXTOS_BIBLICOS);

  const capitulos = new Map();
  const abrirCapitulo = (url) => {
    if (!capitulos.has(url)) {
      capitulos.set(
        url,
        baixarPagina(url).then(($) => {
          $('#bibleText a.xrefLink, #bibleText a.footnoteLink').remove();
          // Versos poéticos vêm em spans colados; sem o espaço, as palavras de linhas vizinhas se juntam.
          $('#bibleText .verse span').append(' ');
          return $;
        }),
      );
    }
    return capitulos.get(url);
  };

  const resultados = await Promise.allSettled(
    referencias.map(async (referencia) => {
      const $ = await abrirCapitulo(referencia.url);
      const texto = $('#bibleText .verse')
        .filter((_, versiculo) => {
          const numero = Number(($(versiculo).attr('id') ?? '').slice(1));
          return numero >= referencia.de && numero <= referencia.ate;
        })
        .map((_, versiculo) => limpar($(versiculo).text()))
        .get()
        .join(' ');
      return { pergunta: referencia.pergunta, rotulo: referencia.rotulo, texto };
    }),
  );

  return resultados
    .filter((resultado) => resultado.status === 'fulfilled' && resultado.value.texto)
    .map((resultado) => resultado.value);
}
