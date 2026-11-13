# Hostinger VPS: Athenes + Cronos

Servidor: 200.141.22.152. Serviços separados do GlauxGIS existente. Cronos e Athenes usam a rede externa dedicada glauxtools_proxy; somente o Caddy também se conecta a ela. A API e o PostGIS do GlauxGIS permanecem exclusivamente na sua rede original glauxgis_default. O banco e o código do GlauxGIS não são alterados.

## Preservação de dados

- Cronos: cloud-server.mjs reutiliza exatamente os handlers da Vercel, Supabase, usuários e SESSION_SECRET existentes. Não executar server.js para esta migração: ele usa SQLite local. A inicialização cloud falha se a configuração estiver incompleta.
- Athenes: mantém o projeto Supabase configurado no aplicativo. Documentos, referências e configurações apenas locais não mudam de domínio automaticamente. Exportar o conteúdo local no endereço antigo e conferir a sincronização antes de trocar o acesso. Não redirecionar nem desativar os endereços antigos.
- O backup lógico do Cronos contém as sete tabelas usadas pelo adaptador cloud, inclusive contas, snapshot, conversas, convites e sessões. É uma cópia REST paginada, não um backup transacional PostgreSQL. Deve ficar com permissão 600 em private/, fora das imagens e do Git. Não restaurar sobre a base ativa sem uma investigação separada.
- Nunca substituir SESSION_SECRET por uma chave aleatória: ela protege os tokens Google existentes.

## Instalação

1. Construir as imagens de cada repositório com seu deploy/vps/Dockerfile, usando o mesmo identificador RELEASE. Somente arquivos selecionados entram nas imagens; .env e .git ficam fora.
2. Colocar compose.yaml em /opt/glauxtools, com private/cronos.env e private/athenes.env. Os segredos são transferidos por SSH e não devem aparecer em logs. athenes.env pode conter GEMINI_API_KEY e GEMINI_TRANSLATION_MODEL se a tradução estiver configurada. A chave marcada como sensitive na Vercel não pode ser recuperada pela API: ATHENES_TRANSLATION_LEGACY=1 mantém somente a tradução no endpoint HTTPS antigo, sem encaminhar cookies ou credenciais. Configurar GEMINI_API_KEY na VPS desativa automaticamente essa ponte.
3. Criar a rede com docker network create glauxtools_proxy e conectar o Caddy com docker network connect glauxtools_proxy glauxgis-proxy-1 (somente se ainda não existir/conectar). Executar RELEASE=<id> docker compose up -d --wait. Os serviços são publicados somente em loopback (3001 e 3301) e na rede dedicada do proxy. Têm limites de memória, CPU, processos e logs, usuário sem privilégios e filesystem somente leitura. Se o contêiner Caddy for recriado em manutenção futura do GlauxGIS, reconectá-lo a glauxtools_proxy; reiniciar a VPS ou o mesmo contêiner preserva a conexão.
4. Testar /api/health, login, arquivos estáticos, proteção de arquivos privados e acesso aos dados. Não criar registros de teste no banco real.
   O endpoint PDF aceita somente uma busca por vez por instância (inclusive até terminar o envio); pedidos concorrentes recebem 429 e Retry-After. Isso limita os buffers de PDFs de até 40 MB dentro dos 256 MB reservados. Um cliente desconectado não libera uma busca que ainda esteja em andamento.
5. Fazer backup de /opt/glauxgis/Caddyfile, acrescentar os blocos Caddy.append, validar a configuração e recarregar com sinal USR1 (admin off). Não reiniciar os serviços ou o banco do GlauxGIS.
6. Na Hostinger, substituir os CNAME de cronos e athenes por registros A para 200.141.22.152. Não manter A e CNAME simultaneamente no mesmo nome. Caddy emite os certificados quando DNS e portas 80/443 estiverem acessíveis.
7. Google Cloud: manter retornos antigos e adicionar https://cronos.glauxtools.online/api/auth/callback ao cliente do Cronos (njba4...). Adicionar https://athenes.glauxtools.online/oauth_callback.html e a origem https://athenes.glauxtools.online ao cliente do Athenes (j898...). Autorizar também a origem do Cronos quando aplicável. O login precisa de validação interativa após esta etapa.

## Reversão

Voltar o DNS à Vercel e manter os serviços cloud antigos disponíveis. Como o banco não muda, não importar snapshots para reverter hospedagem. Restaurar o Caddyfile de backup somente se necessário, validar antes de USR1. Trocar RELEASE para a imagem anterior permite reverter os contêineres sem alterar o banco. Não usar comandos de remoção recursiva ou docker compose down -v.
