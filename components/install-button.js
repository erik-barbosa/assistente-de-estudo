'use client';

import { useEffect, useState } from 'react';
import styles from '../app/estudos.module.css';

export function InstallButton() {
  const [convite, setConvite] = useState(null);

  useEffect(() => {
    const guardar = (evento) => {
      evento.preventDefault();
      setConvite(evento);
    };
    const limpar = () => setConvite(null);

    window.addEventListener('beforeinstallprompt', guardar);
    window.addEventListener('appinstalled', limpar);
    return () => {
      window.removeEventListener('beforeinstallprompt', guardar);
      window.removeEventListener('appinstalled', limpar);
    };
  }, []);

  if (!convite) return null;

  async function instalar() {
    await convite.prompt();
    setConvite(null);
  }

  return (
    <button type="button" className={styles.botaoSecundario} onClick={instalar}>
      Instalar aplicativo
    </button>
  );
}
