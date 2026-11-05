# Athenes — Notas Permanentes para Agentes e Desenvolvedores

Aplicativo web editorial acadêmico para elaboração de artigos científicos, relatórios técnicos e monografias com rigor normativo (ABNT, APA, Vancouver, IEEE), diagramação contínua de páginas mestras, tipografia editorial avançada, integração com Zotero e exportação fiel para PDF (HTML Paged Media) e DOCX (Word).

## Regras Permanentes do Projeto

1. **Protocolo Mandatório de Segurança e Integridade do Sistema de Arquivos (REGRA CRÍTICA ABSOLUTA):**
   - **Proibição Absoluta de Comandos Deletivos Recursivos:** É terminantemente proibido a qualquer agente, subagente ou ferramenta executar comandos destrutivos recursivos no terminal como `rmdir /s /q`, `rm -rf`, `Remove-Item -Recurse -Force`, `del /s /q` ou scripts equivalentes.
   - **Limpeza de Build 100% Canônica e Segura:** Limpezas de compilação do Android ou Web DEVEM ser realizadas estritamente através dos comandos canônicos das ferramentas (`./gradlew clean`, `npm run clean`), NUNCA por comandos de exclusão do shell montados manualmente.
   - **Proibição de Aspas Aninhadas (`""caminho""`) no Windows:** Jamais invocar comandos de shell envolvendo aspas duplas aninhadas como `cmd /c "rmdir \"\"caminho\"\""`, pois a sintaxe do `cmd.exe` quebra na primeira aspa vazia e pode truncar o caminho para a raiz da unidade (`D:\`).
   - **Escopo Estrito ao Repositório:** Nenhum agente ou ferramenta tem permissão para alterar, criar ou excluir arquivos ou diretórios fora da pasta do próprio repositório `d:\1. PROJETOS\Athenes\`. É estritamente proibido qualquer comando que toque diretórios de nível superior ou raízes de unidade (`D:\`, `C:\`, etc.).
   - Toda e qualquer exclusão pontual que se faça estritamente necessária deve ser feita exclusivamente via ferramentas de API específicas em arquivos individuais verificados, nunca por varredura recursiva de diretórios no shell.

2. **Arquitetura & Dependências:**
   - Código aberto, **GPL-3.0-or-later** (arquivo `LICENSE`).
   - Vanilla ES Modules puros (`type: "module"` no `package.json`), **zero dependências externas de runtime**.
   - Toda funcionalidade gráfica, tipográfica e de layout funciona 100% offline no navegador.

3. **Diretriz Mandatória de Temas e Pacotes de Estilo (.json):**
   - **Regra do Importador/Exportador Canônico:** Sempre que qualquer agente ou desenvolvedor adicionar, estender ou alterar atributos visuais, novos tipos de bloco, propriedades tipográficas, novos formatos ou traços de moldura de figuras/tabelas/fórmulas, ou propriedades de páginas mestras, **DEVE OBRIGATORIAMENTE na mesma rodada atualizar `src/core/athenes_pacote_estilo.js`** (`exportarPacoteEstilo`, `validarPacoteEstilo`, `aplicarPacoteEstilo` e `obterPromptIaParaExtracaoDeLayout`).
   - O formato `athenes-tema-v1` é o padrão canônico de compartilhamento de identidade visual entre relatórios, artigos e monografias no Athenes. Qualquer novo recurso de layout que não seja serializável no pacote de estilo quebra a portabilidade de documentos e será considerado defeito de regressão.
   - O prompt mestre retornado por `obterPromptIaParaExtracaoDeLayout()` deve ser mantido sempre alinhado com o schema de temas, garantindo que IAs consigam analisar PDFs/DOCX externos e gerar temas 100% compatíveis.

4. **Tipografia e Geometria:**
   - Dimensões de página e margens em milímetros (`mm`).
   - Tamanhos de fontes, entrelinhas e espaçamentos entre blocos em pontos tipográficos (`pt`).
   - Cores primárias no padrão Athenes Azul (`#314F79`), com suporte total a personalização por tema.
   - Preservar os 7 alinhamentos tipográficos editoriais (`esquerda`, `centro`, `direita`, `justificado`, `justificado_esquerda`, `justificado_centro`, `justificado_direita`).

5. **Testes Obrigatórios:**
   - Todos os commits e alterações devem manter `npm test` verde (100% de aprovação).
   - Teste qualquer mudança em temas com `tests/pacote_estilo.test.js`.

6. **Localização dos Emuladores Android (AVD):**
   - Os arquivos de disco dos emuladores Android (`.avd`) foram movidos para o disco secundário em `D:\dev\android-avd` para desafogar o disco `C:\`.
   - Uma junção de diretório transparente (`mklink /J`) foi configurada em `C:\Users\jeffe\.android\avd` apontando para `D:\dev\android-avd`, e a variável de ambiente `ANDROID_AVD_HOME=D:\dev\android-avd` está ativa.
   - Qualquer script, agente ou ferramenta (`adb`, `emulator`, etc.) continua funcionando de forma 100% transparente tanto pelo caminho legado `C:\Users\jeffe\.android\avd` quanto diretamente em `D:\dev\android-avd`.

## Comandos

| Para | Comando |
| --- | --- |
| Executar suite completa de testes | `npm test` |
| Testes específicos de estilo | `node --test tests/pacote_estilo.test.js` |
| Limpeza segura do build Android | `cd android && ./gradlew clean` (NUNCA usar rmdir) |
