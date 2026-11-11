'use client';

import { useActionState } from 'react';
import { gerarEstudoAgora } from '../app/actions';
import styles from '../app/estudos.module.css';

export function GenerateStudyButton() {
  const [estado, acionar, gerando] = useActionState(gerarEstudoAgora, null);

  return (
    <form action={acionar} className={styles.gerar}>
      <button type="submit" className={styles.botao} disabled={gerando}>
        {gerando ? 'Lendo a programação e gerando respostas…' : 'Gerar estudo da semana'}
      </button>
      <p role="status" aria-live="polite" className={estado?.ok === false ? styles.erro : styles.aviso}>
        {gerando
          ? 'Isso pode levar até um minuto.'
          : estado
            ? `${estado.ok ? '' : 'Erro: '}${estado.mensagem}`
            : ''}
      </p>
    </form>
  );
}
