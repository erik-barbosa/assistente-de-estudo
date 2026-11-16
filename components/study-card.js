import styles from '../app/estudos.module.css';

function Respostas({ itens }) {
  return (
    <dl className={styles.respostas}>
      {itens.map((item) => (
        <div key={item.pergunta} className={styles.resposta}>
          <dt>{item.pergunta}</dt>
          <dd>
            {item.resposta || 'A IA não gerou resposta para esta pergunta.'}
            {item.base ? <span className={styles.base}>Base: {item.base}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PontosPrincipais({ pontos }) {
  return (
    <div className={styles.bloco}>
      <p className={styles.rotulo}>Pontos principais</p>
      <ul className={styles.pontos}>
        {pontos.map((ponto) => (
          <li key={ponto}>{ponto}</li>
        ))}
      </ul>
    </div>
  );
}

function Parte({ parte }) {
  const temConteudo = parte.linhas?.length > 0 || parte.respostas?.length > 0;

  if (!temConteudo) {
    return <p className={styles.parteSimples}>{parte.titulo}</p>;
  }

  return (
    <div className={styles.parte}>
      <h4 className={styles.parteTitulo}>
        {parte.titulo}
        {parte.duracao ? <span className={styles.duracao}>{parte.duracao}</span> : null}
      </h4>

      <ul className={styles.linhas}>
        {parte.linhas.map((linha) => (
          <li key={linha}>{linha}</li>
        ))}
      </ul>

      {parte.pontosPrincipais?.length > 0 ? <PontosPrincipais pontos={parte.pontosPrincipais} /> : null}
      {parte.respostas?.length > 0 ? <Respostas itens={parte.respostas} /> : null}
    </div>
  );
}

function MeioDeSemana({ id, conteudo }) {
  const secoes = conteudo.secoes ?? [];

  return (
    <section id={id} className={styles.reuniao} aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className={styles.reuniaoTitulo}>
        Reunião do meio de semana
      </h2>

      {secoes.length === 0 ? (
        <p className={styles.meta}>A programação desta reunião ainda não foi gerada.</p>
      ) : (
        <>
          {conteudo.fonteUrl ? (
            <p className={styles.meta}>
              <a href={conteudo.fonteUrl} target="_blank" rel="noreferrer">
                Ver programação no jw.org
              </a>
            </p>
          ) : null}

          {secoes.map((secao) => (
            <section key={secao.titulo} className={styles.secao}>
              <h3 className={styles.secaoTitulo}>{secao.titulo}</h3>
              {secao.partes.map((parte) => (
                <Parte key={parte.id} parte={parte} />
              ))}
            </section>
          ))}
        </>
      )}
    </section>
  );
}

function FimDeSemana({ id, sentinela }) {
  return (
    <section id={id} className={styles.reuniao} aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className={styles.reuniaoTitulo}>
        Reunião do fim de semana
      </h2>

      {!sentinela ? (
        <p className={styles.meta}>O estudo de A Sentinela desta semana ainda não foi gerado.</p>
      ) : (
        <>
          <div className={styles.parte}>
            <h3 className={styles.parteTitulo}>
              {sentinela.titulo}
              <span className={styles.duracao}>Estudo de A Sentinela</span>
            </h3>
            {sentinela.textoTema ? <p className={styles.tema}>{sentinela.textoTema}</p> : null}
            {sentinela.objetivo ? (
              <p className={styles.tema}>
                <strong>Objetivo:</strong> {sentinela.objetivo}
              </p>
            ) : null}
            <p className={styles.meta}>
              <a href={sentinela.url} target="_blank" rel="noreferrer">
                Ver artigo no jw.org
              </a>
            </p>
            {sentinela.pontosPrincipais?.length > 0 ? <PontosPrincipais pontos={sentinela.pontosPrincipais} /> : null}
          </div>

          {sentinela.blocos.map((bloco) => (
            <section key={bloco.subtitulo ?? 'introducao'} className={styles.secao}>
              <h4 className={styles.secaoTitulo}>{bloco.subtitulo ?? 'Introdução'}</h4>
              <Respostas itens={bloco.perguntas} />
            </section>
          ))}

          {sentinela.recapitulacao ? (
            <section className={styles.secao}>
              <h4 className={styles.secaoTitulo}>{sentinela.recapitulacao.titulo}</h4>
              <Respostas itens={sentinela.recapitulacao.perguntas} />
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}

export function StudyCard({ estudo, aberto }) {
  const conteudo = estudo.conteudo ?? {};
  const idMeio = `meio-de-semana-${estudo.semana}`;
  const idFim = `fim-de-semana-${estudo.semana}`;
  const geradoEm = new Date(estudo.created_at).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <details className={styles.card} open={aberto}>
      <summary className={styles.resumo}>
        <span className={styles.semana}>Semana de {estudo.titulo}</span>
        {conteudo.leituraSemanal ? <span className={styles.leitura}>{conteudo.leituraSemanal}</span> : null}
      </summary>

      <div className={styles.corpo}>
        <p className={styles.meta}>Gerado em {geradoEm}</p>

        <nav className={styles.atalhos} aria-label={`Reuniões da semana de ${estudo.titulo}`}>
          <a href={`#${idMeio}`}>Meio de semana</a>
          <a href={`#${idFim}`}>Fim de semana</a>
        </nav>

        <MeioDeSemana id={idMeio} conteudo={conteudo} />
        <FimDeSemana id={idFim} sentinela={conteudo.sentinela} />
      </div>
    </details>
  );
}
