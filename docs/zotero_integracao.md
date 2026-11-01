# Athenes — Integração com Zotero e Biblioteca de Leitura

> Estudo detalhado dos meios de integração oficiais, arquitetura de sincronização, análise sobre a necessidade de plugins e modelo da biblioteca de leitura.

---

## 1. Estudo dos Meios Oficiais e Atuais de Integração com o Zotero

O ecossistema Zotero oferece atualmente duas vias principais para interoperabilidade com aplicações externas:

### 1.1 Zotero Web API v3 (Abordagem Oficial e Recomendada)
- **O que é**: A API REST oficial do Zotero (`https://api.zotero.org`), mantida pela Corporation for Digital Scholarship.
- **Autenticação**: Chave de API de usuário (`Zotero-API-Key`) com escopos granulares (Acesso Pessoal, Acesso a Grupos, Somente Leitura ou Leitura/Escrita).
- **Formatos suportados**: JSON nativo do Zotero, CSL-JSON (Citation Style Language), BibTeX e citações HTML pré-formatadas.
- **Vantagens**:
  1. **Multiplataforma e Ubíqua**: Funciona em qualquer navegador web, tablet, notebook ou smartphone, sem depender de o aplicativo desktop do Zotero estar aberto ou instalado na máquina.
  2. **Segurança e Privacidade**: Permite usar chaves restritas apenas de leitura (Read-Only), impedindo alterações acidentais na biblioteca original do usuário.
  3. **Acesso a Coleções e Grupos**: Permite sincronizar bibliotecas pessoais e bibliotecas compartilhadas de grupos de pesquisa.
  4. **Metadados Ricos**: Retorna metadados completos (título, autores, periódicos, volume, páginas, ano, DOI, ISBN, ISSN, resumo, palavras-chave e URLs).

### 1.2 Servidor HTTP Local do Zotero Desktop (Porta 23119)
- **O que é**: O aplicativo Zotero Desktop executa um servidor HTTP interno em `http://127.0.0.1:23119`, usado pelos conectores de navegadores (Chrome/Firefox) e por extensões como o *Better BibTeX*.
- **Vantagens**: Acesso imediato à biblioteca local em cache, sem requisições à nuvem.
- **Limitações Críticas na Web**:
  1. Navegadores modernos impõem restrições de **Mixed Content** e **CORS** (PNA - Private Network Access) quando uma aplicação web servida por HTTPS tenta acessar `localhost` ou `127.0.0.1`.
  2. Requer que o aplicativo Zotero esteja em execução constante na mesma máquina.

### 1.3 Avaliação Técnica da Necessidade de um Plugin para Zotero

> **Decisão de Engenharia**: Um plugin instalado dentro do Zotero Desktop **NÃO é necessário** para estabelecer uma conexão confiável, segura e completa entre o Athenes e o Zotero.

#### Por que um plugin não é necessário (e seria prejudicial):
1. A **Zotero Web API v3** já provê acesso programático seguro a todos os itens, coleções, metadados, resumos e tags.
2. A partir do **Zotero 7** (lançado oficialmente em 2024), a arquitetura interna de extensões do Zotero migrou para um modelo moderno baseado em WebExtensions / ESM, descontinuando o formato XUL antigo. Criar um plugin proprietário exigiria empacotamento `.xpi`, assinaturas criptográficas ou habilitação do modo desenvolvedor no Zotero, aumentando a complexidade para o usuário e criando fragilidades em cada atualização do Zotero.
3. Para cenários **100% offline** (sem internet e sem chave de API), o Athenes implementa importador direto de arquivos **BibTeX (`.bib`)**, **CSL-JSON** e **RIS**, amplamente exportados pelo Zotero em um clique.

---

## 2. Fluxo de Trabalho no Athenes

### 2.1 Conexão com o Zotero
O usuário configura sua biblioteca em poucos segundos:
1. **ID de Usuário / Grupo**: Obtido na página de configurações do Zotero.
2. **Chave de API (API Key)**: Gerada em `zotero.org/settings/keys` com permissão mínima de leitura.
3. **Seleção de Coleções**: O Athenes lista as pastas/coleções disponíveis no Zotero e permite que o autor marque apenas as coleções pertinentes ao seu artigo ou projeto de pesquisa.

### 2.2 Inserção de Citações no Texto
- Ao digitar ou clicar no botão de citação (`@`), abre-se o seletor rápido com busca instantânea por autor, título, ano ou palavra-chave.
- A citação é inserida como uma **pílula interativa de citação** no meio do texto, por exemplo: `(SILVA; SANTOS, 2024)` no formato ABNT ou `(Silva & Santos, 2024)` no formato APA, ou `[1]` no formato IEEE.
- Passar o mouse sobre a pílula exibe o resumo e dados da obra; clicar leva à Biblioteca de Leitura.

### 2.3 Geração Automática de Referências Bibliográficas
- O bloco de **Referências** varre todas as pílulas de citação presentes no documento e compõe a lista bibliográfica completa, ordenada alfabeticamente (ABNT/APA) ou numericamente (IEEE/Vancouver).
- As regras de formatação (negrito no título para ABNT, itálico no periódico para APA, etc.) são aplicadas automaticamente com base no **Perfil de Formatação** ativo.

---

## 3. A Área de Biblioteca de Leitura e Fichamento

A **Biblioteca de Leitura** do Athenes é um ambiente dedicado para o pesquisador explorar e sintetizar o material bibliográfico:
- **Painel de Metadados Oficiais**: Exibe com fidelidade os dados vindos do Zotero (Título, Autores com afiliações, Publicação, Volume, Fascículo, Páginas, Ano, DOI com link ativo, Resumo original e Palavras-chave).
- **Notas Pessoais e Resumos do Pesquisador (Fichamento)**:
  * Campo de texto rico para o autor registrar seus próprios resumos, fichamento temático, pontos críticos e citações diretas favoritas.
  * **Integridade dos Dados**: Essas anotações são salvas com segurança no espaço de trabalho do documento no Athenes e **nunca sobrescrevem nem corrompem** os metadados oficiais do Zotero.
- **Estado de Sincronização**:
  * Indicador claro de status: `Sincronizado`, `Atualizado há X minutos`, `Modo Offline` ou `Falha de Conexão`.

---

## 4. Visualização de Conexões (Grafo de Conhecimento)

O Athenes inclui uma visualização interativa opcional que mapeia as inter-relações entre o acervo bibliográfico citado:
- **Nós**: Obras, Autores principais, Palavras-chave / Temas e Anos de publicação.
- **Arestas**: Coautoria, citações conjuntas no mesmo documento e temas compartilhados.
- **Tratamento de Dados Incompletos**:
  * Se um metadado (ex.: país de publicação, afiliação institucional ou DOI) não estiver presente no registro do Zotero, o sistema sinaliza explicitamente como *"Dado não informado"* com visual sutil, evitando inferências enganosas.
