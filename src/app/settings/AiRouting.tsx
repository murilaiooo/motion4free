import { useState } from 'react';
import { AI_TASKS, clearResponseCache, DEFAULT_AI_POLICY, routingUsage, useRoutingVersion, type AiPolicy, type AiTask, type RouteChoice, type TaskRoutes } from '../../ai/routing';
import { LOCAL_AI_ENABLED } from '../../ai/local-ai';
import { PROVIDERS } from '../../ai/providers/registry';
import { LLM_MODELS } from '../../core/llm-models';
import { AppError } from '../../core/errors';
import { activeAiScope, setAiSettings, useAiSettings } from '../AiOptions';
import { ErrorBox } from '../ErrorBox';

const LABELS: Record<AiTask, string> = { 'creative-brief': 'Pedido geral e gancho', 'local-revision': 'Revisão de trecho', 'moment-ranking': 'Escolha e títulos de clipes' };
const routeLabel = (choice: RouteChoice | undefined) => !choice ? 'Usa a escolha geral' : choice.kind === 'rules' ? 'Só regras' : choice.kind === 'local' ? LLM_MODELS[choice.model].label : `${choice.remote.label} (${PROVIDERS[choice.provider].name})`;

/** Settings-only controls; task/project overrides contain model metadata, never keys or transcript. */
export function AiRouting({ projectId }: { projectId?: string | null }) {
  const s = useAiSettings();
  useRoutingVersion();
  const [onlyProject, setOnlyProject] = useState(false);
  const policy = s.policy ?? DEFAULT_AI_POLICY;
  const project = onlyProject && projectId ? projectId : null;
  const routes = project ? s.projectRoutes?.[project] ?? {} : s.taskRoutes ?? {};
  const setRoute = (task: AiTask, choice: RouteChoice | null) => {
    const next: TaskRoutes = { ...routes };
    if (choice) next[task] = choice; else delete next[task];
    setAiSettings(project ? { projectRoutes: { ...s.projectRoutes, [project]: next } } : { taskRoutes: next });
  };
  const number = (label: string, key: keyof AiPolicy, values: number[]) => (
    <label className="set-check" key={key}>
      <span>{label}</span>
      <select value={policy[key]} onChange={(event) => setAiSettings({ policy: { ...policy, [key]: Number(event.target.value) } })}>
        {[...new Set([...values, policy[key]])].sort((a, b) => a - b).map((value) => <option value={value} key={value}>{value.toLocaleString('pt-BR')}</option>)}
      </select>
    </label>
  );
  let usage: ReturnType<typeof routingUsage> | null = null;
  let problem: AppError | null = null;
  try { usage = routingUsage(projectId ?? activeAiScope()); }
  catch { problem = new AppError('IA_ORCAMENTO', 'contador local inválido; chamadas externas ficam bloqueadas'); }
  return (
    <details className="set-sub">
      <summary>Avançado: modelos por tarefa, limites e cache</summary>
      <div className="stack">
        <p className="hint">Escolhas explícitas: o app não troca para outro provedor ou modelo pago sozinho. Sem acesso ou orçamento, a edição continua pelas regras. Desempenho de modelos depende da tarefa e aguarda avaliação independente.</p>
        {projectId && <label className="set-check"><input type="checkbox" checked={onlyProject} onChange={(event) => setOnlyProject(event.target.checked)} />Personalizar só o projeto aberto</label>}
        {AI_TASKS.map((task) => <div className="set-sub" key={task}>
          <p><b>{LABELS[task]}</b>: {routeLabel(routes[task])}</p>
          <div className="set-row">
            <button className="sm" onClick={() => setRoute(task, null)}>{project ? 'Herdar padrão da tarefa' : 'Herdar escolha geral'}</button>
            <button className="sm" onClick={() => setRoute(task, { kind: 'rules' })}>Só regras</button>
            {LOCAL_AI_ENABLED && <button className="sm" onClick={() => setRoute(task, { kind: 'local', model: s.model })}>IA local escolhida</button>}
            {s.provider && s.remote && <button className="sm" onClick={() => setRoute(task, { kind: 'provider', provider: s.provider!, remote: { ...s.remote! } })}>Usar {s.remote.label}</button>}
          </div>
        </div>)}
        <p className="set-sub-title">Limites de uso externo neste navegador</p>
        <p className="hint">Valem separadamente por projeto e por sessão da aba. Pedidos de conexão e reparos também contam. Zero pedidos bloqueia novos envios. O limite de texto soma bytes do pedido e o teto da resposta como estimativa conservadora; não é medição de tokens nem limite de cobrança do provedor. Configure também um limite de gasto na conta de API.</p>
        {number('Máximo de pedidos por projeto', 'projectRequests', [0, 5, 20, 50, 100])}
        {number('Orçamento estimado de texto por projeto', 'projectTokens', [0, 25000, 100000, 500000])}
        {number('Máximo de pedidos nesta sessão', 'sessionRequests', [0, 10, 50, 100])}
        {number('Orçamento estimado de texto nesta sessão', 'sessionTokens', [0, 50000, 250000, 1000000])}
        {number('Teto de tokens da resposta por pedido', 'outputTokens', [128, 256, 512, 800, 1024, 2048])}
        {number('Tempo máximo do envio (milissegundos)', 'timeoutMs', [15000, 45000, 90000])}
        {usage && <p className="hint" role="status">Projeto: {usage.project.requests} pedidos; {usage.project.reservedTokens.toLocaleString('pt-BR')} de texto reservado. Sessão: {usage.session.requests} pedidos. Respostas em cache: {usage.cached}; reutilizações: {usage.cacheHits}.</p>}
        {problem && <ErrorBox error={problem} kind="warning" />}
        <p className="hint">Só contadores e preferências ficam no navegador. Respostas ficam até 10 minutos na memória desta aba (até 20 itens), separadas por projeto, tarefa, modelo, versão do app e credencial. Trocar/apagar chave limpa o cache. Em armazenamento bloqueado, contadores duram só nesta aba.</p>
        <button className="sm ghost" onClick={clearResponseCache}>Apagar respostas em cache nesta aba</button>
      </div>
    </details>
  );
}
