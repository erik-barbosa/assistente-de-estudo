import styles from '../app/estudos.module.css';

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

      {parte.pontosPrincipais?.length > 0 ? (
        <div className={styles.bloco}>
          <p className={styles.rotulo}>Pontos principais</p>
          <ul className={styles.pontos}>
            {parte.pontosPrincipais.map((ponto) => (
              <li key={ponto}>{ponto}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {parte.respostas?.length > 0 ? (
        <dl className={styles.respostas}>
          {parte.respostas.map((item) => (
            <div key={item.pergunta} className={styles.resposta}>
              <dt>{item.pergunta}</dt>
              <dd>
                {item.resposta}
                {item.base ? <span className={styles.base}>Base: {item.base}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export function StudyCard({ estudo, aberto }) {
  const conteudo = estudo.conteudo ?? {};
  const secoes = conteudo.secoes ?? [];
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
        <p className={styles.meta}>
          Gerado em {geradoEm}
          {conteudo.fonteUrl ? (
            <>
              {' · '}
              <a href={conteudo.fonteUrl} target="_blank" rel="noreferrer">
                Ver programação no jw.org
              </a>
            </>
          ) : null}
        </p>

        {secoes.length === 0 ? (
          <p className={styles.meta}>Este estudo não tem a programação detalhada.</p>
        ) : (
          secoes.map((secao) => (
            <section key={secao.titulo} className={styles.secao}>
              <h3 className={styles.secaoTitulo}>{secao.titulo}</h3>
              {secao.partes.map((parte) => (
                <Parte key={parte.id} parte={parte} />
              ))}
            </section>
          ))
        )}
      </div>
    </details>
  );
}
