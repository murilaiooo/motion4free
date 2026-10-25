# Auditoria de licenças por arquivo — Motion4Free v0.30.2

**Coleta local de 24/10/2026, Windows/Brave, sem GitHub Actions.** Este documento registra arquivos produzidos pelo build; o próximo build pode alterar nomes com hash. Para confirmar outra revisão, execute `npm run build` (bloqueia novos arquivos sem proveniência), depois `node scripts/audit-licenses.mjs --dist --manifest`.

## Decisão e inventário

- **67 arquivos servidos** em dist, incluindo 41 arquivos de fonte, 20 JavaScript, 1 CSS, HTML e notices. Cada arquivo tem SHA-256/bytes registrados abaixo.
- **99 pacotes no grafo de produção do package-lock**, dos quais 20 fontes @fontsource. O grafo inclui binários opcionais de Sharp/libvips e ONNX Runtime para Node, mas **eles não são servidos pelo site**. Não confundir a lista do lock com os módulos efetivamente incorporados no JS minificado.
- **Sem MP3, MP4, imagens de terceiros, 3D, modelos ONNX ou binários desconhecidos incorporados** na distribuição verificada. O único binário autoral de subset é a fonte Noto Emoji OFL com checksum idêntico ao original fonte do projeto.
- **Avisos publicados:** `/licencas-fontes.txt` (OFL + autoria das 20 fontes e do Noto subset), `/licencas-icones.txt` (ISC Lucide + MIT Feather), `/licencas-bibliotecas.txt` (lista de pacotes/versões/licenças/avisos originais disponíveis).
- **Gate fail closed:** alterações em public/src/assets ou novas extensões de distribuição não entram no build antes de revisão. Alterar uma dependência exige atualizar notice localmente e verificar o diff, não basta instalar um pacote.
- **Sem código nem assets copiados de Editonny/OpenReel.** Essas referências de pesquisa têm projetos e catálogos externos; qualquer cópia futura exige revisão específica. Nenhum pacote desses repositórios foi adicionado ao runtime.

## Arquivo original especial

| Caminho de origem controlado | Licença | Fonte / restrição | SHA-256 |
| --- | --- | --- | --- |
| `src/assets/emoji/m4f-emoji.woff2` | OFL-1.1 | Subconjunto Noto Color Emoji (Google), 72 glifos; não vender isoladamente; copyright e OFL em `src/assets/emoji/OFL.txt` e notice público. | `4a94180bd80e397ce112fe05b60943ba03c1c6e779a4226cf4a24fd037b72f0a` |

## Arquivos distribuídos verificados, um por linha

| Arquivo em dist/ | Bytes | Licença / evidência | SHA-256 |
| --- | ---: | --- | --- |
| `_headers` | 902 | MIT próprio | `96c26f7816af6146bb62119d9af487d74f3f0af5a1a5bf2e1f48816b94f042e8` |
| `assets/__vite-browser-external-wwA6K3d-.js` | 94 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `1c287e9896ae1bde3a3fa17f0d2ff9efebf81b702c3ccaa6568b8168896a112e` |
| `assets/anton-latin-400-normal-Byf51wtH.woff2` | 18612 | OFL-1.1 / @fontsource/anton | `d0fa07ff63dd60cbc0e2f58e29c802dca2a5ae0276c999f59c6111ab7bbaec3b` |
| `assets/archivo-black-latin-400-normal-BTVu2TQR.woff2` | 18604 | OFL-1.1 / @fontsource/archivo-black | `25f33e61cf995abd6be62931cf03bf427286259177b43618cc410ee0157cfd30` |
| `assets/bungee-latin-400-normal-Dfnurram.woff2` | 14344 | OFL-1.1 / @fontsource/bungee | `126eec706b7931682dbcf6c6efc274132c603f181fbf912678e6cfeb341e721b` |
| `assets/caveat-latin-700-normal-D8_1Nw6V.woff2` | 51020 | OFL-1.1 / @fontsource/caveat | `15f9638095ad5ec9816f93d66805ca1a87e71dc5a76b596bfce1c78d4704c405` |
| `assets/clip-relink-CEJM1yzB.js` | 370 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `f30dc8d32b18a2a9a0bcb7801a9c9b5627b82d54613314702c44af2d67157be0` |
| `assets/clips-DTHI2pJy.js` | 2811 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `5cbfdca8093e51c95cbe7cad846ef8f2564bc5c4311d59e51f710ba25aa64fb7` |
| `assets/cormorant-garamond-latin-500-italic-Y14P-dkT.woff2` | 23924 | OFL-1.1 / @fontsource/cormorant-garamond | `4fb55a7a6d564d428061fe12c82c896264bcc8b7f0b52840bf88e0db5b91256f` |
| `assets/cormorant-garamond-latin-500-normal-BsRWmXhO.woff2` | 23312 | OFL-1.1 / @fontsource/cormorant-garamond | `8197bf53615ddc8c423f444c7f0eec63b7fa0ba093fcfbec60dfdd28429b0fc8` |
| `assets/cormorant-garamond-latin-600-normal-Co1r35X9.woff2` | 23396 | OFL-1.1 / @fontsource/cormorant-garamond | `ae062b6d5ae308e7edf61b28b07b9984bbb6e961b1f34d9b2c2f4389c33f21ea` |
| `assets/courier-prime-latin-400-normal-BbyBr73r.woff2` | 18640 | OFL-1.1 / @fontsource/courier-prime | `f09844e1f4fe9e67df2cc77474519e68756d559b4648278b9dd4f03c8ac9c31f` |
| `assets/courier-prime-latin-700-normal-D1YCjmaD.woff2` | 19348 | OFL-1.1 / @fontsource/courier-prime | `5c7ae1cc9aae183453565c836b74a1b988f5f2e52b65098decb909b3930957ec` |
| `assets/custom-coder-0gXQvQoL.js` | 134358 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `7f31216bbe41e2fb7677e190e761b6dba123a59283dc33dfdd3abf57808eadc4` |
| `assets/dm-sans-latin-500-normal-B9HHJjqV.woff2` | 14304 | OFL-1.1 / @fontsource/dm-sans | `19bf1984956517c35c2bd35b6cdedac12a21d6fcd3596c614ecdfb88b648909d` |
| `assets/dm-sans-latin-700-normal-DvUfVpUG.woff2` | 14348 | OFL-1.1 / @fontsource/dm-sans | `35c5efa0e5daa52ee5c6500f5be354bf751fb65c4e49e1d6806c6eb5883e8fe9` |
| `assets/errors-CKjpc2Vs.js` | 18062 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `d36df0b8179d520c660cef2cc81d8910bacce76c53c833f7f2f9d881c35288c4` |
| `assets/export.worker-boFz4Epi.js` | 766893 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `58b52150147ae61e19b2e7fcf8726495be5fcdf72dc190a068aaa112cb5aae2f` |
| `assets/ibm-plex-mono-latin-500-normal-DSY6xOcd.woff2` | 14888 | OFL-1.1 / @fontsource/ibm-plex-mono | `01d285447409c8a588692162439a038b8cbd7871309ee20267b0d2d91c6e8e22` |
| `assets/ibm-plex-mono-latin-600-normal-BgSNZQsw.woff2` | 15620 | OFL-1.1 / @fontsource/ibm-plex-mono | `0d1f0b8d0722224e32e9f28261bdc86c79115be73444ae5eceb73976a1bcdf83` |
| `assets/ibm-plex-sans-condensed-latin-600-normal-CRd5VyFf.woff2` | 19816 | OFL-1.1 / @fontsource/ibm-plex-sans-condensed | `3d72a0923c5830358b0a8e25b258aecadbecbf542b6ee9a25f387803e37d56b9` |
| `assets/ibm-plex-sans-condensed-latin-700-normal-D8r4s4aS.woff2` | 19352 | OFL-1.1 / @fontsource/ibm-plex-sans-condensed | `4768878c107d92c528a65bba206a87cdcf2c694514e75907fb91772cf8a388a5` |
| `assets/ibm-plex-sans-latin-500-normal-6ng42L7E.woff2` | 24184 | OFL-1.1 / @fontsource/ibm-plex-sans | `0717336fb31fcdcde4b8deb3675bb4a0f7f6d484864afcd6751ac29975962203` |
| `assets/ibm-plex-sans-latin-600-normal-CuJfVYMP.woff2` | 24252 | OFL-1.1 / @fontsource/ibm-plex-sans | `8960851d691c054ed38e259bdcf1a6190d157b4203ed5bb32c632a863fb8ec2f` |
| `assets/ibm-plex-sans-latin-700-normal-Bxkt5Cjx.woff2` | 22832 | OFL-1.1 / @fontsource/ibm-plex-sans | `42e7b0c143c19df9d99fd896e76b48f846edf0902d200bc29796b34d12c33aa7` |
| `assets/id3-CQBf3QbD.js` | 292728 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `0efa67fa0f2488a7f4ee57229e38766bffe845df89469165fae116618976462e` |
| `assets/index-bnl7bgHt.js` | 994057 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `3b54141c4058f2e6831c65461cea05631fa7d6c488e5b05a8f141d35a1b2c4fc` |
| `assets/index-Dpubt2AI.css` | 107544 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `dfa4365ece6a1e98fe7b24a8ac28e1073b8303a4f5922c50b35ae3275695ddad` |
| `assets/instrument-serif-latin-400-italic-DKMiL14s.woff2` | 22128 | OFL-1.1 / @fontsource/instrument-serif | `5a51946dfffa82972bc98745359c46761515641fda557c25116459a9f83da4a7` |
| `assets/instrument-serif-latin-400-normal-DnYpCC2O.woff2` | 21032 | OFL-1.1 / @fontsource/instrument-serif | `5eb09b5ac0e28b67c2f041c8ba6d244604ca0c0980d65912ab2d47fed84ddc31` |
| `assets/inter-latin-400-normal-C38fXH4l.woff2` | 23664 | OFL-1.1 / @fontsource/inter | `8909904ab6c872eb994093482a88a28eca2cd95912d7b6fecd72103b0dc07edc` |
| `assets/inter-latin-500-normal-Cerq10X2.woff2` | 24272 | OFL-1.1 / @fontsource/inter | `f3779f1efccc4bdcdf9c0a02ab95bf6bd092ed09c48c08cedc725889edd1d19f` |
| `assets/inter-latin-600-normal-LgqL8muc.woff2` | 24452 | OFL-1.1 / @fontsource/inter | `f9a06e79cd3a2a20951c0f0e28f66dd0e6d3fda73911d640a2125c8fcb78f21a` |
| `assets/inter-latin-700-normal-Yt3aPRUw.woff2` | 24356 | OFL-1.1 / @fontsource/inter | `6f56409fd3d64bb85f7d070bce20749db2d66b6d63cec586cc22d1c761be2491` |
| `assets/inter-latin-800-normal-BYj_oED-.woff2` | 24400 | OFL-1.1 / @fontsource/inter | `a7d0a50f15d389cad679238466bdb5fc9787aa0715719064ce25abaff042820d` |
| `assets/kalam-latin-700-normal-D2H-9ISU.woff2` | 22144 | OFL-1.1 / @fontsource/kalam | `252063af6ade8b9a744cde4ddad0fc21ea53b8ba711eed121a0c2e8610ea9c93` |
| `assets/lib-DL8aLXmX.js` | 6038373 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `81ba45c2f127c523911ee10d0b8a7fc99986c9670707d248c886eac5e2d3af50` |
| `assets/m4f-emoji-Bq_UG0Z8.woff2` | 49956 | OFL-1.1 / Noto Color Emoji (subconjunto) | `4a94180bd80e397ce112fe05b60943ba03c1c6e779a4226cf4a24fd037b72f0a` |
| `assets/mediabunny-aac-encoder-bDseywo7.js` | 992479 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `c43cd27e4892ecec550b75ace267dd335fe952133db2db226928a692278855ea` |
| `assets/mediabunny-aac-encoder-CYXTMtWM.js` | 992518 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `65c934dcc0b62da6bea6049b3200c52378b6f0b20361e52d335e1ca23905dfbd` |
| `assets/montserrat-latin-700-normal-BdjcYUrC.woff2` | 18824 | OFL-1.1 / @fontsource/montserrat | `f9d9e65b15372cebcafc3acd1e664a564c5c4b23278de4d5760de9a13c530371` |
| `assets/montserrat-latin-800-normal-axpkC1rd.woff2` | 19012 | OFL-1.1 / @fontsource/montserrat | `ba826fb84c2e961578adf3a08b5778b87905d4443445d1d56d84f9f157d5ea4b` |
| `assets/montserrat-latin-900-normal-B0TD3Qnu.woff2` | 18020 | OFL-1.1 / @fontsource/montserrat | `5b6958520638bb8609f9eacb17c4d189563efeae96d5da49f7c2043988697205` |
| `assets/music-DvjQnWU_.js` | 564 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `f06ad5e28f0c830215f91c854b367302347770db8b8436694d882267a0b4cde0` |
| `assets/nunito-latin-800-normal-Dz8SOQK_.woff2` | 16520 | OFL-1.1 / @fontsource/nunito | `2363d3ed037283ebb961e8c4b4917e40a8bc8853cf9965cf1ea7b4daa1df630a` |
| `assets/nunito-latin-900-normal-BVB1fGs6.woff2` | 16676 | OFL-1.1 / @fontsource/nunito | `9ca32f5d8334579387361096944286df451272a557bb09bd906254a623aba99e` |
| `assets/oswald-latin-500-normal-B-eyT0Dw.woff2` | 12704 | OFL-1.1 / @fontsource/oswald | `541b12882301dc44b73eaaed9e230709df1d299379c3594695870fc2f9e3ff0a` |
| `assets/oswald-latin-700-normal-vy6hmKSr.woff2` | 12672 | OFL-1.1 / @fontsource/oswald | `aae665c75af89ea7cb7d8ccc8b0911ea72267442ebcd84f6e3efa041ad3b3c16` |
| `assets/playfair-display-latin-400-italic-LeeEXsx5.woff2` | 21884 | OFL-1.1 / @fontsource/playfair-display | `eabce94d4a69e439cd050755c31f9894ac8a78f93e58b063c6c01f370474e1de` |
| `assets/playfair-display-latin-400-normal-CFtfchNt.woff2` | 21856 | OFL-1.1 / @fontsource/playfair-display | `1fe9ad5d8b2ebd8ecb8fbd05bed1e3fdfa52dae3f1a04e1c219918442fe9394d` |
| `assets/presets-Bf-8olB3.js` | 118426 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `2661645f2f73edb2f000d9ae9e272e346dd47dbc50e6326b9c416c78bae000a8` |
| `assets/rolldown-runtime-COiEfhsA.js` | 1116 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `174e7e98105b02138bee9b4c62dfc8a01980db395f9e6c916db999c091115562` |
| `assets/rolldown-runtime-FCrsKEuO.js` | 1005 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `ce6c73f97cc2e14e10f7f9dbf0fabe5c3e3eefde0bd9c52cdfec9cfaed2ce48b` |
| `assets/rubik-latin-800-italic-D1Su27dq.woff2` | 19224 | OFL-1.1 / @fontsource/rubik | `bad087a4713159824858683eef307bb0a6b73ddbe2fc00e656924820e8b71858` |
| `assets/rubik-latin-900-italic-DJJTaqDK.woff2` | 18204 | OFL-1.1 / @fontsource/rubik | `f8054480da6a9b256902835bb30990edc568c98de8d121c083b7d00381b16325` |
| `assets/schema-4amkCSVR.js` | 6003 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `270c3d8f33c5c1f93c81ed9d5254a08db2c77430a92f0c57ef647af807223550` |
| `assets/selector-DV6nNt4K.js` | 19998 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `aaa06b3939ba9f7d8c51aa51a9bb4977be87130567b96e0561c8fdf7726f8b79` |
| `assets/space-grotesk-latin-500-normal-lFbtlQH6.woff2` | 13312 | OFL-1.1 / @fontsource/space-grotesk | `1b1a8131d9edf975d9decee81e2f2bf504812f7a4f498e5500f28a613e22e64c` |
| `assets/space-grotesk-latin-700-normal-RjhwGPKo.woff2` | 12840 | OFL-1.1 / @fontsource/space-grotesk | `35f8aec56cfd5cbfdb03cc68733a54a0b05bb3617ffcd5fd332badc0b045ca55` |
| `assets/timeline-DsGLtRLX.js` | 32012 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `0352019b175b059abea588c3aef59fa2d8666174a2cc791a8f40089c3cb089f0` |
| `assets/vt323-latin-400-normal-wDgJuOC9.woff2` | 17936 | OFL-1.1 / @fontsource/vt323 | `8ddbebcc1048154132e1d78eb9b1f7850bca1b7d857035ccf1cb4318ebc615b6` |
| `assets/webllm.worker-CF49SGCe.js` | 6025487 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `8c47fe977e5460f7f8b51fa5e23a00da4fdd7b65c8bf0d8022da2a0dd5371341` |
| `assets/whisper.worker-DrDDXQl9.js` | 569430 | MIT (Motion4Free) + dependências em licencas-bibliotecas.txt | `348d893fc72dd0597e36afbadc034a12681105988e34f5795b75d52e76727170` |
| `index.html` | 1626 | MIT próprio | `be1fc04731c05e4d1905049f0c26ac90ee2fc8e756faac8599e7d0b1c65abaf6` |
| `licencas-bibliotecas.txt` | 194646 | aviso bibliotecas | `a51f2f2d6152032e5d39a9f02fdc95af806a647e606fce855e4dd6a44c4b723d` |
| `licencas-fontes.txt` | 11293 | OFL-1.1 / avisos | `bfb39ead28af3260a7d45591366fb0f857a9461bcee6e2668584a799ce87c68a` |
| `licencas-icones.txt` | 3439 | ISC/MIT / avisos | `0c08f9bab5f7d18362a295668a32fcccd3226a634855a9148010f91dc144256d` |

## Modelos e licenças de terceiros obtidos sob demanda (NÃO contidos no dist)

| Objeto baixado somente pela pessoa | Origem e licença relacionada | Atribuição e limitação |
| --- | --- | --- |
| Whisper base/small/large-v3-turbo convertido para ONNX com timestamps | `onnx-community/whisper-*_timestamped` em Hugging Face; originais `openai/whisper-*` MIT | Original do Whisper: Copyright OpenAI, pesos/código MIT. A licença do repositório de conversão pode não estar explicitada no cartão ONNX; conferir antes de redistribuir pesos, que **não são distribuídos pelo site**. Cache local após download. |
| Qwen2.5-0.5B-Instruct, Qwen2.5-1.5B-Instruct, Qwen3-4B compilados pela MLC | `mlc-ai/Qwen*-MLC`; originais Qwen da Alibaba Cloud, Apache-2.0 | Pesos sob demanda pelo Hugging Face. Origem/licença dos modelos base confirmada pelos cartões Qwen oficiais; a conversão e WebGPU libraries devem ser reconferidas antes de redistribuição própria. |
| Bibliotecas WASM de Qwen/WebLLM | `mlc-ai/binary-mlc-llm-libs`, Apache-2.0 | Sob demanda pela origem/espelho; nenhuma dessas bibliotecas WASM foi incluída no dist auditado. |
| Modelo ONNX / runtime WASM de ASR | Transformadores: Apache-2.0, ONNX Runtime MIT (de metadados npm) | O arquivo de ONNX Runtime >25MiB é removido do build e servido por origem remota. E2E agora executa o mesmo prune+audit para não simular um pacote diferente. |

A ausência de arquivo de modelo no site **não significa** que todo download externo esteja certificado legal ou tecnicamente; licenças externas mudam. A conferência manual dos cartões e termos continua exigida se no futuro optarmos por hospedar/reempacotar modelos em servidor próprio.

## Escopo de confiança e restrições

- Este é um gate de **recursos distribuídos e metadados de pacotes**. Não substitui parecer jurídico sobre patentes, marcas, dataset de modelos ou termos externos. Arquivos de mídia dos usuários têm direitos próprios, nunca são liberados automaticamente pelo app.
- A verificação por arquivo captura novas extensões e fontes desconhecidas; não faz prova formal da origem de cada instrução JavaScript minificada. O módulo JS combina código próprio MIT e pacotes listados no notice.
- Licenças permissivas (MIT/BSD/ISC/Apache) exigem preservar avisos; MPL-2.0 do Mediabunny é copyleft por arquivo e o app usa a biblioteca sem alterar seus fontes. Noto/Fontsource OFL proíbe vender arquivos de fonte sozinhos; nomes reservados devem ser observados ao modificar.
- O notice npm cobre, por transparência, dependências nativas opcionais do lockfile que não são publicadas. Quando uma dependência é instalada só em outra plataforma, a licença é verificada pelo lockfile e o texto completo pode depender do respectivo pacote. Isso não é autorização para distribuir DLL/binário sem revisão.

## Como reproduzir (PC Windows)

1. `npm run licenses:check` — confere metadados/notice determinístico, assets rastreados e fontes.
2. `npm run typecheck && npm test` — suíte com testes de rejeição de MP3 sem licença, fonte desconhecida e emoji modificado.
3. `npm run build` — aplica prune ONNX e bloqueia qualquer arquivo estático sem origem aprovada.
4. `npx playwright test e2e/issue2-license-notices.spec.ts` — acessa os três avisos no Brave, confere presença de Mediabunny/MPL, Transformers/Apache e render sem exceções.
5. Se quiser adicionar asset/dependência, **primeiro revisar a licença/procedência**, depois atualizar o gate (manifesto e teste), executar `npm run licenses:update` e revisar notice, e repetir todos os testes. Nunca desligar o gate para acelerar um merge.

Não foram usados GitHub Actions, credenciais, vídeo pessoal ou upload de projeto para produzir este relatório.
