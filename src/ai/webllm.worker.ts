// Worker do modelo de texto opcional (WebLLM). Carregado só quando a pessoa liga a IA no navegador.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
