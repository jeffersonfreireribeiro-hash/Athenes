# Redes, relações e gráficos — implementação

## Nos dois aplicativos

- Análise de relações entre campos ordenados e de termos presentes no mesmo registro ou parágrafo.
- Escolha de fonte, campos, medida numérica, registros, período, frequência e força mínima das ligações.
- Expressões compostas, palavras ignoradas e equivalências de termos, sem dependência de IA.
- Doze disposições: rede orgânica, comunidades, radial, centro e anéis, circular, elíptica, feixes radiais, ramificações, esfera projetada, arcos, Sankey e fluxo temporal.
- Comunidades automáticas ou cor definida por um campo. Inspeção dos registros que originaram um nó ou uma ligação.
- Controles quadrados com ícones SVG. Um único botão de baixar abre SVG e PNG; o ícone de banco de dados no painel permite baixar os dados/configuração em JSON.
- Espaçamento consistente entre rótulos, campos, variáveis e grupos de opções. Adaptação a telas pequenas, zoom, enquadramento e deslocamento da rede.

## Athenes

O painel está disponível no documento e no catálogo de referências. Fontes: referências do documento, biblioteca disponível, pasta atual e texto do relatório. Campos bibliográficos incluem autores, temas, ano, publicação, tipo e local de publicação; a análise textual inclui título, resumo e fichamentos.

Uma análise pode ser inserida como figura vinculada ou cópia fixa. Figuras vinculadas ao documento recalculam quando suas referências/texto mudam. Figuras da biblioteca guardam uma cópia dos registros disponíveis e atualizam com edições locais/remotas da biblioteca. O vínculo de pasta acompanha entradas e saídas; documentos carregados e inativos também recebem salvamento em segundo plano. Fontes da biblioteca usam referências próprias; referências compartilhadas já presentes no relatório podem ser analisadas pela fonte do documento. Documentos em leitura ou comentário permitem explorar e baixar; salvar/inserir fica desabilitado.

As figuras usam o mesmo renderizador SVG do editor, PDF e DOCX. As opções visuais de relações participam da exportação, validação, aplicação e prompt do pacote canônico `athenes-tema-v1`.

## Cronos

O bloco Gráfico ganha a análise de relações em Editar layout. Depois de configurado, pode ser explorado sem alterar a configuração no modo de visualização. As fontes são tabelas, bases, cronogramas e textos das páginas legíveis do mesmo espaço. A configuração pode manter vínculo ou guardar um instantâneo.

Foi corrigido o caminho que agregava a tabela escolhida, mas entregava os antigos exemplos JSON aos renderizadores novos. Distribuições agora recebem observações individuais; séries recebem os grupos/períodos; dispersões recebem X/Y/tamanho; redes recebem origem/destino/peso; hierarquias, conjuntos, cotações, Gantt e mapas recebem campos próprios. Mapeamentos incompletos avisam em vez de mostrar exemplos antigos. O Sankey passou a ajustar sua escala a pesos altos.

Na Galeria de blocos, a página **Laboratório · Gráficos e bases de dados** acrescenta duas tabelas independentes: 120 registros na base principal e 36 na alternativa. Inclui nove blocos de gráficos/análise vinculados. A atualização é aditiva e não reescreve dados já editados.

O botão de baixar também aparece nas visualizações de tabelas e cronogramas e nos blocos de gráfico, imagem, mapa e fluxo de etapas. A captura dos gráficos HTML inclui suas legendas e os setores das roscas.

## Mapas fornecidos

O GeoJSON `World_Continents_-866833026731040087.geojson`, fornecido pelo usuário, foi identificado como EPSG:4326 e convertido em contornos continentais para o Cronos. A simplificação é feita durante a preparação, a 0,06 grau; pequenas ilhas e anéis interiores são omitidos. O aplicativo utiliza o resultado localmente, sem carregar o arquivo de 6,5 MB nem buscar mapas na internet.

Os quatro arquivos brasileiros foram identificados como conjuntos Shapefile (SHP/SHX/DBF/PRJ). A projeção verificada no arquivo de UFs é SIRGAS 2000. Essas malhas ainda não foram incorporadas ao aplicativo; a malha municipal isolada tem mais de 320 MB descompactada e pede preparação específica. Os quadrados GeoJSON do laboratório são dados fictícios de teste, não limites do IBGE.

## Validação e limites

Os testes cobrem análise fracionada, campos multivalorados, termos/equivalências, proveniência, seleção temporal, determinismo, marcação segura, figuras vinculadas/fixas, biblioteca e ida e volta dos temas. O teste de vínculo percorre todos os tipos do catálogo do Cronos e verifica a mudança da fonte. A auditoria no navegador usa dados fictícios e testa o seletor real de fonte, edição de registro, inserção no Athenes, downloads SVG/PNG, menu de formatos e tela pequena.

O processamento limita cada análise a 2.000 registros, 180 nós e 900 ligações visíveis, com avisos de truncamento. A análise textual usa uma árvore de busca de expressões e um orçamento de 2 milhões de caracteres por análise. Gráficos vinculados comuns também avisam seus recortes e usam o mesmo recorte nos totais e no desenho. Presença conjunta não demonstra causalidade. Comunidades são um agrupamento exploratório, não classificação científica garantida. Um download de visual muito extenso avisa ao exceder o limite de texto em vez de omitir rótulos silenciosamente.

Capturas em `docs/relations-audit/` nos respectivos repositórios. Alterações locais, sem publicação em produção nesta rodada.

Limitação de exportação: SVGs nativos preservam o desenho vetorial. A captura de figuras HTML reconstrói texto, cores, setores de rosca, recortes e posicionamento de imagens; estilos CSS complexos, como sombras e rotação de texto, podem variar. Imagens externas dependem da permissão de exportação do servidor de origem; o Cronos oferece também abrir o arquivo original.

Verificação final: 708 testes aprovados no Cronos e 1.210 no Athenes. A revisão automática do Cronos relatou cobertura parcial; os achados identificados de vínculo, cópia de registros, escalas e preservação de dados foram tratados e verificados localmente. No Athenes, foi acrescentada uma fila por documento para ordenar salvamentos, além do fechamento do painel ao sair da biblioteca e da atualização da data de edição ao inserir figuras. A limitação de CSS complexo na exportação HTML permanece declarada acima.
