import { useEffect, useRef } from 'react';
import { Captions, ChevronRight, HardDrive, Info, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { StorageDeps } from '../../core/storage-report';
import { Dialog } from '../Dialog';
import { StoragePanel } from '../Storage';
import type { AsrPrecision } from '../asr-precision';
import { AiSection } from './AiSection';
import { AboutSection, AppearanceSection, PrivacySection, TranscriptionSection } from './SettingsSections';
import { closeSettings, openSettings, useSettingsRoute, type SettingsSection } from './route';
import './settings.css';

const NAV: { id: SettingsSection; title: string; sub: string; Icon: typeof Info }[] = [
  { id: 'ia', title: 'IA e provedores', sub: 'Como o app entende seus pedidos, chaves e modelos', Icon: Sparkles },
  { id: 'transcricao', title: 'Transcrição', sub: 'Precisão da legenda e modelos locais', Icon: Captions },
  { id: 'armazenamento', title: 'Armazenamento', sub: 'Projetos, downloads e espaço usado', Icon: HardDrive },
  { id: 'editor', title: 'Editor e aparência', sub: 'Tema, painéis e atalhos', Icon: SlidersHorizontal },
  { id: 'privacidade', title: 'Privacidade e segurança', sub: 'O que sai do computador, chaves e autorizações', Icon: ShieldCheck },
  { id: 'sobre', title: 'Sobre e diagnóstico', sub: 'Versão, recursos do navegador e erros', Icon: Info },
];

interface Props {
  precision: AsrPrecision;
  storage: StorageDeps;
  currentProjectId: string | null;
  onProjectDeleted: (id: string) => void;
  onEverythingDeleted: () => void;
}

/**
 * Configurações (v0.27, issue #73): tudo o que não é editar o vídeo sai da mesa e mora aqui.
 * Abre por cima da tela atual (início, clipes ou editor), então o projeto, a análise e a linha do tempo
 * continuam exatamente como estavam ao fechar.
 */
export function SettingsHost(props: Props) {
  const { open } = useSettingsRoute();
  return open ? <SettingsScreen {...props} /> : null;
}

function SettingsScreen({ precision, storage, currentProjectId, onProjectDeleted, onEverythingDeleted }: Props) {
  const { section } = useSettingsRoute();
  const body = useRef<HTMLDivElement>(null);
  const current = NAV.find((n) => n.id === section)!;
  useEffect(() => {
    body.current?.scrollTo?.({ top: 0 });
  }, [section]);
  return (
    <Dialog title="Configurações" onClose={closeSettings} className="settings" testId="settings-screen">
      <div className="set-layout">
        <nav className="set-nav" aria-label="Seções das configurações">
          {NAV.map(({ id, title, sub, Icon }) => (
            <button key={id} className={`set-nav-item ${id === section ? 'on' : ''}`} aria-current={id === section ? 'page' : undefined} onClick={() => openSettings(id)} data-testid={`settings-nav-${id}`}>
              <Icon size={18} aria-hidden />
              <span>
                <b>{title}</b>
                <small>{sub}</small>
              </span>
              <ChevronRight size={15} aria-hidden className="set-nav-arrow" />
            </button>
          ))}
        </nav>
        <section className="set-body" ref={body} aria-label={current.title} data-testid={`settings-section-${section}`}>
          <header className="set-head">
            <h3>{current.title}</h3>
            <p className="hint">{current.sub}</p>
          </header>
          {section === 'ia' && <AiSection currentProjectId={currentProjectId} />}
          {section === 'transcricao' && <TranscriptionSection precision={precision} />}
          {section === 'armazenamento' && <StoragePanel deps={storage} currentProjectId={currentProjectId} onProjectDeleted={onProjectDeleted} onEverythingDeleted={onEverythingDeleted} />}
          {section === 'editor' && <AppearanceSection />}
          {section === 'privacidade' && <PrivacySection />}
          {section === 'sobre' && <AboutSection />}
        </section>
      </div>
    </Dialog>
  );
}
