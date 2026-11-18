'use client';

import { useRef, useState } from 'react';
import styles from '../app/estudos.module.css';

const ABAS = [
  { chave: 'meio', rotulo: 'Meio de semana' },
  { chave: 'fim', rotulo: 'Fim de semana' },
];

export function MeetingTabs({ idBase, rotulo, inicial = 'meio', meio, fim }) {
  const [ativa, setAtiva] = useState(inicial);
  const botoes = useRef({});
  const paineis = { meio, fim };

  function aoTeclar(evento) {
    const atual = ABAS.findIndex((aba) => aba.chave === ativa);
    const destino = { ArrowRight: atual + 1, ArrowLeft: atual - 1, Home: 0, End: ABAS.length - 1 }[evento.key];
    if (destino === undefined) return;

    evento.preventDefault();
    const proxima = ABAS[(destino + ABAS.length) % ABAS.length].chave;
    setAtiva(proxima);
    botoes.current[proxima]?.focus();
  }

  return (
    <>
      <div role="tablist" aria-label={rotulo} className={styles.abas} onKeyDown={aoTeclar}>
        {ABAS.map((aba) => (
          <button
            key={aba.chave}
            ref={(elemento) => {
              botoes.current[aba.chave] = elemento;
            }}
            type="button"
            role="tab"
            id={`aba-${aba.chave}-${idBase}`}
            aria-controls={`painel-${aba.chave}-${idBase}`}
            aria-selected={ativa === aba.chave}
            tabIndex={ativa === aba.chave ? 0 : -1}
            className={styles.aba}
            onClick={() => setAtiva(aba.chave)}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>

      {ABAS.map((aba) => (
        <div
          key={aba.chave}
          role="tabpanel"
          id={`painel-${aba.chave}-${idBase}`}
          aria-labelledby={`aba-${aba.chave}-${idBase}`}
          hidden={ativa !== aba.chave}
        >
          {paineis[aba.chave]}
        </div>
      ))}
    </>
  );
}
