import { useState } from 'react';
import { AI_TASKS, clearResponseCache, DEFAULT_AI_POLICY, routingUsage, useRoutingVersion, type AiPolicy, type AiTask, type RouteChoice, type TaskRoutes } from '../../ai/routing';
import { LOCAL_AI_ENABLED } from '../../ai/local-ai';
import { PROVIDERS } from '../../ai/providers/registry';
import { AppError } from '../../core/errors';
import { activeAiScope, setAiSettings, useAiSettings } from '../AiOptions';
import { ErrorBox } from '../ErrorBox';

const TASK_LABELS: Record<AiTask, string> = {
  'creative-brief': 'Ideias e instruções de edição',
  'local-revision': 'Ajustes em trechos',
  'moment-ranking': 'Escolha dos melhores clipes',
};

function routeValue(choice: RouteChoice | undefined, provider?: string | null, modelId?: string): string {
  if (choice?.kind === 'provider' && (choice.provider !== provider || choice.remote.id !== modelId)) return 'saved-provider';
  return choice?.kind ?? 'default';
}

/** Expert controls are opt-in; existing task/project routing and usage limits remain unchanged. */
export function AiRouting({ projectId }: { projectId?: string | null }) {
  const s = useAiSettings();
  useRoutingVersion();
  const [onlyProject, setOnlyProject] = useState(false);
  const policy = s.policy ?? DEFAULT_AI_POLICY;
  const project = onlyProject && projectId ? projectId : null;
  const routes = project ? s.projectRoutes?.[project] ?? {} : s.taskRoutes ?? {};

  const setRoute = (task: AiTask, choice: RouteChoice | null) => {
    const next: TaskRoutes = { ...routes };
    if (choice) next[task] = choice;
    else delete next[task];
    setAiSettings(project ? { projectRoutes: { ...s.projectRoutes, [project]: next } } : { taskRoutes: next });
  };

  const chooseRoute = (task: AiTask, value: string) => {
    if (value === 'rules') setRoute(task, { kind: 'rules' });
    else if (value === 'local' && LOCAL_AI_ENABLED) setRoute(task, { kind: 'local', model: s.model });
    else if (value === 'provider' && s.provider && s.remote) {
      setRoute(task, { kind: 'provider', provider: s.provider, remote: { ...s.remote } });
    } else setRoute(task, null);
  };

  const number = (label: string, key: keyof AiPolicy, values: number[]) => (
    <label className="set-check" key={key}>
      <span>{label}</span>
      <select value={policy[key]} onChange={(event) => setAiSettings({ policy: { ...policy, [key]: Number(event.target.value) } })}>
        {[...new Set([...values, policy[key]])].sort((a, b) => a - b).map((value) => (
          <option value={value} key={value}>{value.toLocaleString('pt-BR')}</option>
        ))}
      </select>
    </label>
  );

  let usage: ReturnType<typeof routingUsage> | null = null;
  let problem: AppError | null = null;
  try { usage = routingUsage(projectId ?? activeAiScope()); }
  catch { problem = new AppError('IA_ORCAMENTO', 'contador local inválido; chamadas externas ficam bloqueadas'); }

  return (
    <details className="set-sub" data-testid="ai-advanced-settings">
      <summary>Personalizar o uso da IA (opcional)</summary>
      <div className="stack">
        <p className="hint">O padrão já funciona. Só altere se quiser usar uma IA diferente em cada etapa.</p>

        <details className="set-details" data-testid="ai-task-settings">
          <summary>Escolher IA por tipo de tarefa</summary>
          <div className="stack">
            {projectId && (
              <label className="set-check">
                <input type="checkbox" checked={onlyProject} onChange={(event) => setOnlyProject(event.target.checked)} />
                Aplicar apenas a este projeto
              </label>
            )}
            {AI_TASKS.map((task) => (
              <label className="ai-task-choice" key={task}>
                <span>{TASK_LABELS[task]}</span>
                <select
                  aria-label={TASK_LABELS[task]}
                  value={routeValue(routes[task], s.provider, s.remote?.id)}
                  onChange={(event) => chooseRoute(task, event.target.value)}
                >
                  <option value="default">{project ? 'Seguir configuração da tarefa' : 'Seguir configuração principal'}</option>
                  <option value="rules">Sem IA (só regras)</option>
                  {LOCAL_AI_ENABLED && <option value="local">IA local selecionada</option>}
                  {s.provider && s.remote && (
                    <option value="provider">{s.remote.label} ({PROVIDERS[s.provider].name})</option>
                  )}
                  {routes[task]?.kind === 'provider' && (!s.provider || !s.remote || routes[task].provider !== s.provider || routes[task].remote.id !== s.remote.id) && (
                    <option value="saved-provider" disabled>IA escolhida anteriormente</option>
                  )}
                </select>
              </label>
            ))}
            <p className="hint">O app nunca escolhe outro serviço pago sozinho.</p>
          </div>
        </details>

        <details className="set-details" data-testid="ai-usage-settings">
          <summary>Limites de uso e privacidade</summary>
          <div className="stack">
            <p className="hint">Limites locais de segurança para pedidos enviados à sua conta de IA. Não substituem os limites de gastos do serviço.</p>
            {number('Pedidos por projeto', 'projectRequests', [0, 5, 20, 50, 100])}
            {number('Texto estimado por projeto', 'projectTokens', [0, 25000, 100000, 500000])}
            {number('Pedidos por sessão', 'sessionRequests', [0, 10, 50, 100])}
            {number('Texto estimado por sessão', 'sessionTokens', [0, 50000, 250000, 1000000])}
            <details className="set-details">
              <summary>Mais limites</summary>
              <div className="stack">
                {number('Máximo de tokens da resposta', 'outputTokens', [128, 256, 512, 800, 1024, 2048])}
                {number('Tempo de espera (ms)', 'timeoutMs', [15000, 45000, 90000])}
              </div>
            </details>
            {usage && <p className="hint" role="status">Uso: {usage.project.requests} pedidos neste projeto, {usage.session.requests} nesta sessão.</p>}
            {problem && <ErrorBox error={problem} kind="warning" />}
            <details className="set-details">
              <summary>Respostas temporárias</summary>
              <p className="hint">O app reutiliza respostas por até 10 minutos nesta aba. Chaves e vídeos não ficam nesse cache.</p>
              <button className="sm ghost" onClick={clearResponseCache}>Limpar respostas temporárias</button>
            </details>
          </div>
        </details>
      </div>
    </details>
  );
}
