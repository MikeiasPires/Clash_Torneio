# Contas, convites e perfil

## Cadastro em duas etapas

1. Em `/cadastro`, informe nome, idade, e-mail, senha e foto opcional.
2. Ao criar a conta, a sessão é aberta e a página `/cadastro/tag` pede o código do jogador. No Clash Royale, abra seu perfil e copie a tag que começa com `#`.
3. Sem convite, **Confirmar tag e finalizar** consulta o jogador na API, salva a tag e o nick na própria conta e abre `/perfil`. Vincular a tag não concede acesso a grupos.
4. Com convite, a mesma segunda etapa mantém o convite no fragmento da URL e confirma a tag junto com a entrada no grupo, abrindo o histórico após o sucesso.

Se a tag for inválida, não existir ou já estiver vinculada a outra conta, a tela permite corrigir e tentar novamente. A conta criada permanece disponível. Recarregar a segunda etapa mantém a sessão; fazer login em uma conta sem tag retoma essa etapa. A vinculação exige a API do Clash configurada no servidor.

## Fluxo do administrador

1. Abra `/cadastro` sem convite e crie sua conta com nome, idade, e-mail, senha e, se quiser, foto.
2. Em desenvolvimento local, a primeira conta criada sem convite recebe o papel de administrador. Contas criadas por convite nunca recebem esse papel automaticamente.
3. Abra **Grupos**, crie um grupo só com o nome ou selecione um existente.
4. Em **Convidar jogadores**, clique em **Gerar link de convite** e depois em **Copiar link**.
5. Envie o link aos amigos pelo meio que preferir. O aplicativo não envia mensagens automaticamente.

Na Vercel não há promoção automática do primeiro cadastro. O proprietário cria sua conta, abre **Perfil → Sou o organizador do aplicativo** e informa seu `GROUPS_ADMIN_TOKEN` privado para ativar a administração. Essa credencial não é o token do Clash e não deve ser compartilhada com os convidados. As requisições de gerenciamento passam a usar a sessão do administrador.

Um grupo pode ser criado vazio. O monitor começa a consultar quando houver pelo menos dois jogadores. Os grupos que já existiam e suas partidas são preservados.

## Fluxo de quem recebe o link

1. Sem sessão aberta, o link abre o cadastro. Quem já tem conta pode usar **Entrar**, mantendo o convite. Se já houver uma conta conectada no navegador, a tela permite **Continuar com esta conta**, **Criar outra conta** ou **Entrar com outra conta**. As duas últimas opções encerram a sessão atual antes de continuar, preservando o convite.
2. No cadastro, a pessoa informa nome, idade, e-mail e senha. A foto é opcional e pode ser adicionada ou alterada no perfil.
3. Depois de criar a conta ou fazer login, a próxima tela pede a tag do Clash Royale em um campo vazio e editável. O link é do grupo: ele não preenche nem fixa a tag do administrador. Quem já vinculou a própria conta pode selecionar explicitamente **Usar minha tag vinculada**. Para cadastrar um amigo, use a conta desse amigo; o convite continua disponível ao trocar de conta.
4. O servidor consulta o perfil do jogo e, se o convite e a tag forem válidos e houver vaga, vincula a conta e inclui o jogador no grupo de forma transacional.
5. A pessoa vai para o histórico do grupo. Se a tag já foi adicionada manualmente pelo administrador, a entrada vincula a conta a esse membro, sem duplicá-lo nem perder partidas.

Cada conta mantém uma única tag e uma tag não pode ser reivindicada por duas contas. Isso evita duplicação no aplicativo. A existência da tag é conferida na API; essa consulta não comprova propriedade da conta Supercell. O sistema não oferece um selo de propriedade verificada do jogo. Em caso de vínculo incorreto, o organizador deve revisar o caso antes de corrigir os dados no backend.

## Convites

- O convite é específico de um grupo, vale por sete dias e permite até 20 entradas; o grupo continua limitado a 20 tags diferentes.
- Repetir uma entrada já concluída não duplica o membro nem consome outra utilização.
- Gerar um link novo invalida o anterior. **Revogar convite** bloqueia novas entradas por aquele link, sem expulsar quem já entrou.
- Ao remover um jogador, seu vínculo de acesso ao grupo também é removido. Se ainda tiver um convite válido, ele poderá pedir entrada novamente; para impedir reentradas pelo mesmo link, revogue-o.
- Excluir o grupo apaga seus convites e vínculos de acesso. As contas pessoais e perfis permanecem existentes.
- O endereço tem o formato `/convite#TOKEN`. O fragmento fica no navegador; não é enviado no caminho HTTP ou no Referer. O backend recebe o token apenas no corpo das requisições e guarda somente seu hash.

O botão usa o domínio pelo qual você abriu o app. Um link começando com `http://127.0.0.1` ou `http://localhost` só funciona no próprio computador. Para compartilhar com amigos em outros dispositivos, publique o frontend e o backend, configure o Supabase e gere o convite pelo domínio publicado. O servidor local permanece restrito ao loopback por padrão.

## Perfil e privacidade

`/perfil` mostra a conta conectada, com nome, foto, idade, e-mail, tag e frase. A pessoa pode alterar o próprio nome, idade, foto e frase pelo modal **Editar perfil**. O nome cadastrado é usado somente no próprio perfil. Home, ranking, histórico, confrontos e lista de membros usam o nick do Clash Royale obtido pela API. A foto e a frase continuam vinculadas à tag; a frase aparece na home quando a pessoa lidera o grupo.

Nome cadastrado, e-mail e idade são retornados somente para o próprio usuário. Os demais participantes recebem o nick do jogo, foto, frase e referências públicas do Clash Royale. Usuários comuns só podem consultar grupos em que entraram; somente administradores podem criar grupos, gerenciar jogadores, sincronizar manualmente e gerar ou revogar convites.

O acesso a fotos exige sessão e participação em um grupo comum, ou papel de administrador. Respostas de imagem têm cache privado e variam por cookie. O backend não aceita um ID de outra pessoa para atualizar perfil, nem aceita papel de administrador no cadastro.

## Autenticação e fotos

- E-mail/senha são tratados pelo backend do aplicativo nos dois adaptadores de banco. Esta implementação não usa o serviço Supabase Auth.
- Senhas usam scrypt com salt aleatório por senha, N=131072, r=8 e p=1. O hash, as sessões e as credenciais não são retornados pelos endpoints de grupos.
- Sessões usam tokens aleatórios de 256 bits. O banco guarda somente o hash; o navegador recebe cookie HttpOnly, SameSite=Lax, duração de sete dias e, em produção, Secure com prefixo `__Host-`.
- Login e cadastro têm limites persistidos no banco. Operações autenticadas exigem origem compatível e JSON. O login renova a sessão recebida, e o logout a invalida no servidor.
- Fotos aceitam JPEG, PNG e WebP de até 2 MB e até 16 milhões de pixels. O servidor confere a assinatura do arquivo, decodifica e regrava em JPEG de até 384×384, sem preservar EXIF. SVG e URLs externas não são aceitos como upload.
- O arquivo processado é pequeno e fica no banco, com o perfil. Não há dependência do disco temporário da Vercel para fotos.
- O servidor local bloqueia URLs diretas para `.env`, banco SQLite e diretórios privados do backend. `data/` continua ignorado pelo Git.

Esta etapa não envia mensagens de confirmação por e-mail e não implementa recuperação de senha. O e-mail identifica a conta, mas não é apresentado como verificado. Esses fluxos exigem configuração e implementação próprias antes de oferecer tais recursos aos usuários.

## Supabase e publicação

Execute as migrações em ordem, aplicando somente as que ainda não foram executadas:

1. `202611010001_x1_groups.sql`
2. `202611010002_group_management.sql`
3. `202611010003_accounts_invites.sql`
4. `202611010004_account_player_tag.sql`

A terceira migração acrescenta contas, sessões, convites, controle de tentativas e vínculos entre contas e membros. As tabelas têm RLS ativado e acesso direto revogado para `anon` e `authenticated`. As transações privadas são acessíveis somente pelo backend com `service_role`.

A quarta migração permite vincular a tag sem convite, com a mesma exclusividade e proteção contra troca de tag usadas na entrada por convite. Aplique-a antes de publicar o backend atualizado no Supabase. No SQLite local, não é necessária uma migração adicional.

Configure `X1_STORAGE=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROUPS_ADMIN_TOKEN`, `CRON_SECRET` e as variáveis da API do Clash. Nunca use prefixo `VITE_` para credenciais privadas. A configuração de IP e monitoramento segue o guia do registrador. Nenhuma conta de teste é criada no banco real pelos testes.

## Verificações

```powershell
npm test
npm run test:http
npm run lint
npm run build
```

O teste HTTP usa banco em memória e API simulada. Ele cobre o fluxo desde a criação do administrador até convite, cadastro com foto acima de 8 KB, entrada de dois jogadores, placar, privacidade da imagem e logout. Os testes PostgreSQL executam as migrações e verificam os limites de convite, a exclusividade de tags e as permissões das tabelas.

Referências: [armazenamento de senhas — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [sessões — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [upload — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
