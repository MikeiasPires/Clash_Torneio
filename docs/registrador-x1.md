# Registrador de x1 por grupos

O app registra amistosos concluídos entre jogadores de um mesmo grupo. O backend consulta o histórico recente do Clash Royale, identifica os adversários, salva as partidas e calcula o placar acumulado. Ele não acompanha uma batalha ao vivo.

## Usar no computador

1. Use Node 24 e a chave do Clash já configurada no `.env`.
2. Execute `npm install` e `npm run dev`.
3. Faça login como administrador e abra `/grupos`. Informe o nome do grupo; as tags são opcionais. Você pode começar vazio e gerar um convite para que cada pessoa cadastre a própria conta e informe sua tag. Para adicionar manualmente, cole até 20 tags, inclusive `#TAG Nome do amigo`, uma pessoa por linha. Nas tags, a letra `O` é normalizada para o número `0`.
4. O backend consulta o perfil de cada tag. Se alguma não existir, o grupo não é criado parcialmente.
5. Clique em **Consultar agora** para o primeiro lote ou aguarde o monitor automático.
6. Acompanhe o grupo na home, em troféus e no histórico. **Ver confronto direto** mostra o placar acumulado entre os dois, incluindo partidas que não estão na página atual.

O monitor roda no backend do servidor local, inclusive com a página fechada, enquanto o processo `npm run dev` estiver ligado. A interface relê os registros a cada 30 segundos. Fechar o servidor interrompe as consultas, mas preserva os dados em `data/x1.sqlite`.

## Alterar jogadores e excluir um grupo

Na tela `/grupos`, selecione o grupo e use:

- **Adicionar ao grupo**: aceita uma ou várias tags, inclusive com os nomes ao lado. Os novos perfis são validados na API antes da gravação. O limite de 20 membros também é verificado na transação do banco para impedir que inclusões simultâneas ultrapassem o limite.
- **Retirar do grupo**: abre uma confirmação para o jogador escolhido. Ele sai do monitoramento deste grupo, e seus confrontos deixam de entrar no histórico visível, ranking e placares atuais. Os vínculos históricos ficam arquivados. Se a tag voltar ao grupo, esses registros voltam a aparecer sem duplicação.
- **Excluir grupo por completo**: pede uma confirmação e apaga o grupo, os membros e os vínculos atuais e arquivados com suas partidas. Partidas sem vínculo com qualquer outro grupo também são excluídas. Partidas compartilhadas com outros grupos permanecem neles.

Um grupo pode ficar temporariamente com zero ou um membro durante a edição. Ele só entra na fila de consultas quando tiver pelo menos dois jogadores. Remover alguém de um grupo não altera sua participação em outros grupos.

As alterações são transacionais. No PostgreSQL, coleta, criação e gerenciamento compartilham uma trava de escrita transacional curta para impedir conflitos entre exclusão de grupos e chegada de resultados. Os grupos reais não são usados nos testes de exclusão.

Também é possível gerenciar pelo terminal:

```powershell
npm run groups:create -- "Amigui" "#TAG_REAL_1" "#TAG_REAL_2" "#TAG_REAL_3"
npm run groups:sync
```

O primeiro comando valida as tags, cria o grupo e executa um lote inicial. O segundo executa um lote entre todos os grupos ativos. Não coloque segredos nos argumentos.

## Regras do registro

- Apenas batalhas com tipo `friendly`, um jogador de cada lado e os dois participantes em pelo menos um grupo comum.
- Partidas de outros modos, 2×2 e partidas contra pessoas de fora dos grupos não entram no placar.
- A primeira coleta importa os amistosos recentes que ainda estão disponíveis na API. Depois, novos registros se acumulam no banco. Não há recuperação garantida de partidas que já saíram da API.
- O mesmo duelo é identificado pela data/hora, tags ordenadas e modo do jogo. A chave continua igual quando a partida é consultada pelo outro participante.
- O banco tem uma chave única por partida e outra por associação entre partida e grupo. Duas consultas simultâneas ou repetidas não aumentam o placar.
- Se os mesmos jogadores participarem de vários grupos, o duelo é associado uma vez a cada grupo. Um grupo criado posteriormente também recebe os confrontos já conhecidos entre suas tags.
- Vitórias, derrotas e empates vêm das coroas retornadas pela API. O navegador não pode enviar nem alterar resultados.
- O ranking usa vitórias nos x1 registrados no grupo, depois menos derrotas e tag para desempate. Não usa as vitórias gerais da conta no jogo.
- Pausar um grupo suspende a necessidade de consultar seus membros exclusivamente por ele. Registros preservados e dados obtidos por outros grupos em comum continuam disponíveis.

As tags cadastradas são referências a perfis públicos do jogo, sem comprovação de propriedade. Contas, perfis pessoais e entrada por convite estão implementados e descritos em [Contas e convites](contas-convites.md).

## Como o monitor evita problemas

Cada ciclo reserva até 8 jogadores, consultando no máximo 4 ao mesmo tempo. Jogadores em vários grupos são compartilhados na fila. Depois da tentativa, há um intervalo mínimo de 60 segundos por jogador.

A reserva fica no próprio banco e dura até 120 segundos. Se um processo cair, outro poderá retomar o trabalho. Um identificador de reserva impede que uma resposta antiga sobrescreva o estado de uma coleta nova. Gravações são transacionais; falhar no meio não deixa meia partida salva.

Falhar a consulta de um jogador não descarta as partidas coletadas dos outros. A tela do grupo mostra a última consulta bem-sucedida e o último erro de cada membro. Com muitos jogadores, a volta completa na fila pode levar mais de um minuto. Nenhuma frequência elimina totalmente o risco de uma partida sair do histórico antes de ser coletada.

## Banco local

`X1_STORAGE=sqlite` usa `data/x1.sqlite`, ignorado pelo Git. As tabelas são criadas automaticamente. Para fazer uma cópia simples do banco, pare primeiro o servidor e os comandos de sincronização, e então copie o arquivo. Não confunda `data/` com um diretório descartável: ele contém os registros locais.

SQLite é usado apenas no computador. O backend recusa essa configuração na Vercel para não simular persistência em um disco temporário de função.

## Preparar o Supabase e a Vercel

Quando houver um projeto no Supabase:

1. Execute os arquivos SQL de `supabase/migrations/` em ordem de nome, aplicando somente os que ainda não foram executados. A migração `202611010003_accounts_invites.sql` acrescenta contas, perfis e convites.
2. Configure no backend da Vercel:

```dotenv
X1_STORAGE=supabase
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=CHAVE_PRIVADA_DO_BACKEND
GROUPS_ADMIN_TOKEN=SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
CRON_SECRET=OUTRO_SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
CLASH_ROYALE_API_TOKEN=TOKEN_DO_CLASH
CLASH_ROYALE_API_MODE=direct
```

Nenhuma dessas chaves privadas deve usar prefixo `VITE_` ou ser colocada no código React. Configure o IP de saída direto ou o proxy opcional conforme `docs/clash-royale-api.md`. A opção de proxy continua sendo explícita.

As tabelas do Supabase têm Row Level Security ativado e não concedem acesso direto aos papéis `anon` e `authenticated`. A chave `service_role` existe somente no backend. As funções de coleta, criação e leitura transacional também são restritas ao backend.

O usuário conectado pode ler os grupos em que entrou; administradores podem ler e gerenciar todos os grupos. Nick do Clash Royale, foto e frase aparecem aos participantes. O nome cadastrado, e-mail e idade ficam restritos ao próprio perfil. O código privado de organização pode ativar o papel de administrador na tela de perfil; não é o token da API do Clash e não deve ir no convite.

No computador, o gerenciamento pode ser feito sem digitar esse código somente por uma conexão de loopback, com host local e origem compatível. Esse atalho não existe na Vercel. Pedidos de outros sites, JSON inválido, corpos acima de 8 KB e parâmetros inesperados são rejeitados.

Os registros existentes no SQLite não são enviados automaticamente ao Supabase. O adaptador fica pronto para uma implantação nova; migrar os dados locais existentes exige uma exportação/importação específica.

## Agendamento em produção

`GET /api/monitor` executa um lote e exige `Authorization: Bearer <CRON_SECRET>`. A Vercel envia esse cabeçalho automaticamente quando `CRON_SECRET` está configurado e o endpoint é chamado por um Cron Job da plataforma.

O projeto não ativa um cron diário por padrão, pois isso daria uma falsa impressão de monitoramento frequente. A Vercel Hobby permite cron somente uma vez por dia; Pro/Enterprise permitem uma vez por minuto. Para monitoramento frequente no Pro, acrescente ao `vercel.json`:

```json
"crons": [{ "path": "/api/monitor", "schedule": "* * * * *" }]
```

No Hobby, outra opção é um agendador externo que chame o endpoint a cada minuto com o cabeçalho de autorização. Proteja esse segredo no agendador e acompanhe os limites de execução e as falhas. O loop local do Vite não é um processo permanente na Vercel.

## Endpoints

| Método e caminho | Uso | Acesso |
| --- | --- | --- |
| `GET /api/groups` | Listar grupos da conta e situação do monitor | Conta conectada |
| `GET /api/groups?id=UUID&offset=0` | Grupo, membros, 50 partidas e placares de todo o histórico salvo | Membro ou administrador |
| `POST /api/groups?action=create` | Criar grupo com `{ "name": "Amigui", "tags": ["#TAG1", "#TAG2"] }` | Organizador |
| `POST /api/groups?action=sync&id=UUID` | Consultar um lote do grupo; corpo `{}` | Organizador |
| `POST /api/groups?action=toggle&id=UUID` | Pausar/retomar com `{ "enabled": false }` | Organizador |
| `POST /api/groups?action=add-members&id=UUID` | Adicionar com `{ "tags": ["#TAG"] }` ou lista de texto | Organizador |
| `POST /api/groups?action=remove-member&id=UUID` | Retirar com `{ "tag": "#TAG" }` | Organizador |
| `POST /api/groups?action=delete&id=UUID` | Excluir grupo com `{ "confirm": true }` | Organizador |
| `GET /api/monitor` | Coletar um lote da fila de grupos ativos | CRON_SECRET |

## Validação

`npm test` inclui testes com SQLite real e PostgreSQL embarcado, executando as migrações do Supabase. Eles verificam isolamento de grupos, partidas duplicadas nos dois históricos, placar 5×1, falhas parciais, locks, recuperação de reserva, rollback, persistência, paginação, inclusão e retirada de membros, retorno ao grupo, exclusão sem afetar outros grupos e restrições de acesso. Complete com `npm run lint` e `npm run build`.

Na auditoria desta implementação, `npm audit --omit=dev` retornou zero vulnerabilidades reportadas. A auditoria completa apontou seis alertas moderados na cadeia de ferramentas ESLint/minimatch, ligados a uma possibilidade de negação de serviço com padrões de glob maliciosos, sem correção compatível indicada pelo npm. São dependências de desenvolvimento; acompanhe a atualização desse conjunto de ferramentas. Isso não equivale a uma garantia de ausência de vulnerabilidades no código da aplicação.

Referências: [limites de cron da Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing), [proteção do cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
