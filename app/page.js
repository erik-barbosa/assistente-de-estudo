import { GenerateStudyButton } from '../components/generate-study-button';
import { StudyCard } from '../components/study-card';
import { listarEstudos } from '../lib/estudos';
import styles from './estudos.module.css';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** No sábado e no domingo o estudo mais novo já é o da semana seguinte, mas a reunião do fim de semana é a da semana atual. */
function indiceDaSemanaAtual(estudos) {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const indice = estudos.findIndex((estudo) => {
    const domingo = new Date(Date.parse(estudo.semana) + 6 * 86_400_000).toISOString().slice(0, 10);
    return estudo.semana <= hoje && hoje <= domingo;
  });
  return Math.max(indice, 0);
}

export default async function Home() {
  let estudos = [];
  let erro = null;

  try {
    estudos = await listarEstudos();
  } catch (error) {
    console.error('Falha ao carregar os estudos:', error);
    erro = error.message;
  }

  const indiceAberto = indiceDaSemanaAtual(estudos);

  return (
    <main className={styles.pagina}>
      <header className={styles.cabecalho}>
        <h1 className={styles.titulo}>📖 Assistente de Estudos</h1>
        <p className={styles.subtitulo}>
          Reunião do meio de semana e estudo de A Sentinela do fim de semana, com respostas e pontos de estudo gerados
          por Inteligência Artificial
        </p>
        <GenerateStudyButton />
      </header>

      {erro ? (
        <p className={`${styles.vazio} ${styles.erro}`} role="alert">
          {erro}
        </p>
      ) : estudos.length === 0 ? (
        <p className={styles.vazio}>
          Nenhum estudo gerado ainda. Use o botão acima para ler a programação desta semana.
        </p>
      ) : (
        <div className={styles.lista}>
          {estudos.map((estudo, indice) => (
            <StudyCard key={estudo.id} estudo={estudo} aberto={indice === indiceAberto} />
          ))}
        </div>
      )}

      <p className={styles.rodape}>
        As respostas são sugestões geradas por IA a partir da programação e dos textos indicados nela. Confira sempre
        na Bíblia e nas publicações antes de usar.
      </p>
    </main>
  );
}
