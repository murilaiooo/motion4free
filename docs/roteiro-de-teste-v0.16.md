# Roteiro de teste da v0.16.0

Sem terminal e sem instalar nada. Use o Chrome ou o Edge no computador. Confira primeiro, no rodapé, se está escrito **v0.16.0**. Se aparecer um aviso com código (M4F-…), aperte **Copiar detalhes** e mande junto.

## 1. Projeto não se perde ao fechar a aba (o problema principal)
1. Abra um vídeo grande (1 minuto ou mais).
2. Quando o editor aparecer, **feche a aba em até 2 segundos**, antes de aparecer "Salvo" no alto.
3. Abra o app de novo.
   - **Certo:** aparece o aviso **M4F-604** pedindo o mesmo vídeo (suas edições estão guardadas). Escolha o mesmo arquivo: o editor volta como estava.
   - **Errado:** aparecer "Projeto que não abre".
4. Se a aba fechou muito cedo, antes até do primeiro salvamento, pode aparecer o aviso **M4F-617** e um cartão **"Importação interrompida"** em Meus projetos. Isso também está certo: apague o cartão e abra o vídeo de novo. Nada do vídeo original se perde.

## 2. Volume igual entre clipes
1. Escolha 2 ou 3 vídeos de uma vez, um gravado de perto e outro de longe (um mais baixo que o outro).
2. Aperte **Assistir** e depois **Exportar**.
   - **Certo:** a fala tem volume parecido em todos os clipes, sem chiado nem estouro, na prévia e no MP4.
3. Feche o projeto, abra de novo pela lista (Meus projetos) e confira se o volume continua igual.

## 3. Enquadramento (vídeo deitado no Reels)
1. Abra um vídeo **deitado** (horizontal). O formato padrão é 9:16.
2. No painel da direita, em **Enquadramento**, aperte **Mostrar inteiro**.
   - **Certo:** o vídeo aparece todo, com ele mesmo desfocado atrás.
3. Volte para **Preencher a tela** e arraste **Esquerda ↔ direita** até a pessoa ficar no meio. Solte e exporte.
   - **Certo:** o MP4 mostra o mesmo recorte da prévia.
4. Com vários clipes, escolha **Só o clipe 2**, mude o enquadramento dele e confira que o clipe 1 não mudou.
5. **Ctrl+Z** desfaz o enquadramento.

## 4. Detalhes do editor
- Um aviso amarelo tem um **X** para sumir.
- Com o editor aberto (sem clicar em nenhum campo), as **setas ← →** andam um quadro, **Shift + seta** anda 1 s, **Home** vai ao início.
- Na janela de apagar projeto, a tecla **Tab** não sai da janela.
- Um vídeo que começa com "Oi gente, tudo bem?" não ganha um título gigante "Oi gente".
- A exportação deve estar mais rápida que na v0.15.1. Se puder, anote quanto tempo um mesmo vídeo levou nas duas versões.

## 5. Qualidade (opcional, quando der)
Siga o [kit de avaliação cega](qualidade/avaliacao-cega.md) e mande as notas.
