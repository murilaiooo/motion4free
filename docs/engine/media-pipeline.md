# Pipeline audiovisual e contratos

## Pipeline inicial
1. **Probe:** mídia, duração, codec, rotação, FPS, tracks, recursos disponíveis.
2. **Transcrição:** áudio local, Whisper via browser runtime quando viável; palavras e timestamps, incertezas.
3. **Análise:** waveform, VAD, detecção de respiração, silêncio, movimentos de face e safe zones.
4. **Tomadas:** agrupamento por frases completas e seleção sem deturpar significado.
5. **EDL:** segmentos imutáveis associados ao arquivo original, fusões e cortes medidos no áudio real.
6. **Composição:** captions, zoom/framing, template motions, SFX, transições, música.
7. **Sample:** trecho 8–15s com fala, movimento e caso de corte difícil.
8. **Export:** encoder suportado, verificação do arquivo final, relatório de limitação.

## Corte e respiração
Adotar princípios [Editonny WORKFLOW](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/engine/WORKFLOW.md), [tighten_cut.py](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/engine/helpers/tighten_cut.py) e [waveform_cut.py](https://github.com/soumatheusgomes/editonny/blob/main/skills/editonny/engine/helpers/waveform_cut.py).
- Remover somente pausas desnecessárias, falhas, falsos inícios e repetições autorizadas.
- Não cortar sílabas, consoantes baixas, ataques de SFX e pausas expressivas.
- Tratar timestamps do Whisper como candidatos; ajustar com sinais de áudio e grade de frames.
- Voz e imagem permanecem sincronizadas em todas as faixas.
- Nunca compor “nova frase” falsa juntando tomadas sem contexto.

## Motion e áudio
- Cenas surgem de eventos/trechos com prova e constraints do catálogo.
- Render temporal determinístico, suportando seek arbitrário.
- Overlay deve considerar rosto, legenda, contraste e zonas de UI da plataforma.
- Música com ducking e métricas de loudness; referência inicial do Editonny é -14 LUFS, true-peak com headroom, **não universal para todas as plataformas/conteúdos**.
- SFX moderados e cravados no impacto, respeitando licenças.

## Quality gate
- Verificar black frames não intencionais, áudio ausente, bordas do corte, clipping, drift, legenda fora do quadro, mídia ausente, duração/fps/container.
- Verificação semântica de número/negação é adicional a inspeção de waveform.
- Valores de análise são indícios, não “ouvir” automaticamente o vídeo.
- Export não passa como “profissional” só porque é um arquivo MP4 válido.

## Esquema de projeto (proposta)
```text
project/
  project.json (versão, mídias, perfis, edição declarativa)
  media refs (handles / IDs locais, sem cópia obrigatória)
  analysis/ (transcript, waveform summary, face tracks)
  decisions/ (hook, narrative, scene selections, explanations)
  cache/ (proxies, previews e intermediários)
  exports/ (arquivos gerados pelo usuário)
```
Armazenamento físico preferencial OPFS; esta árvore é organização lógica, não promessa de acesso a diretórios do sistema.

## Prioridade de compatibilidade
MVP desktop e arquivos curtos; multicâmera, 4K avançado, HDR complexo e long-form ficam para fases seguintes. Implementações capazes de gerenciar I/O em streaming e memória limitada serão necessárias.
