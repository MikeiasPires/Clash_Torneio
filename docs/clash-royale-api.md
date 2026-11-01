# Primeira consulta à API do Clash Royale

O projeto inclui funções de backend na pasta `api/`, um cliente compartilhado no servidor e uma busca real na tela de histórico. A integração usa `fetch` nativo, sem uma nova dependência. Use Node 24, como no ambiente de desenvolvimento.

## 1. Criar a chave

1. Abra https://developer.clashroyale.com e faça seu cadastro/login. Se o portal solicitar confirmação de e-mail, conclua essa etapa.
2. Entre em **My Account** e procure **Create New Key**.
3. Use um nome como `ClashDosAmigui-local` e uma descrição como `Testes locais do projeto`.
4. Em **Allowed IP Addresses**, informe o **IPv4 público da conexão usada pelo Node**. Não use `localhost`, `127.0.0.1` ou um endereço da rede local, como `192.168.x.x`. Você pode consultar seu IP público pesquisando `meu IPv4` no navegador.
5. Crie a chave e copie o token para o arquivo local descrito abaixo. Não envie o token no chat nem em capturas de tela.

Se o IP da conexão mudar ou você passar a usar uma VPN, confira novamente o IP autorizado. Ao hospedar a aplicação, será necessário autorizar o IP público de saída do backend.

## 2. Guardar a chave localmente

Na pasta `ClashDosAmigui` que contém o `package.json` com os scripts do Vite, copie `.env.example` para `.env` caso esse arquivo ainda não exista. Preencha no seu editor:

```dotenv
CLASH_ROYALE_API_TOKEN=COLE_SEU_TOKEN_AQUI
CLASH_ROYALE_API_MODE=direct
```

Cole somente o token, sem o prefixo `Bearer`. O comando adiciona esse prefixo ao cabeçalho de autenticação.

O `.env` está ignorado pelo Git. Não use uma variável `VITE_CLASH_ROYALE_API_TOKEN`: variáveis com o prefixo `VITE_` podem ser incorporadas ao código entregue ao navegador. Se uma chave for exposta, revogue-a no portal e crie outra.

## 3. Fazer a primeira consulta

No jogo, abra seu perfil e copie a tag que começa com `#`. No terminal, dentro da pasta do projeto, execute:

```powershell
npm run api:player -- "#SUA_TAG"
```

Substitua `#SUA_TAG` pela tag real. O resultado será um JSON com nome, troféus, vitórias, derrotas, partidas e clã. O token não é impresso.

O comando consulta `GET https://api.clashroyale.com/v1/players/{playerTag}` usando `Authorization: Bearer <token>`. O `#` da tag precisa ser codificado como `%23` na URL; o script usa `encodeURIComponent` para isso.

O script limita a chamada a 10 segundos e apresenta mensagens para erros de autenticação, IP, jogador inexistente e excesso de chamadas. Se houver erro, compartilhe somente a mensagem, sem o conteúdo do `.env`.

## 4. Consultar no aplicativo

**Fluxo atual:** use `/grupos` para cadastrar as tags e `/historico` para ler os duelos salvos pelo monitor. O histórico e o ranking já são persistidos; veja [o guia do registrador de x1](registrador-x1.md). A consulta individual descrita pelos endpoints abaixo continua disponível para diagnóstico.

Execute `npm run dev` e abra `/grupos` no endereço informado pelo Vite. Cadastre um grupo com as tags reais e clique em **Consultar agora**. Se o servidor já estava aberto quando você alterou o `.env`, reinicie-o.

A tela usa os registros do banco. A demonstração Mestre do Deck 5 × 1 Rei da Arena fica separada em `/historico?demo=1`.

Somente partidas com `type: friendly`, um jogador de cada lado e ambos em um grupo comum são registradas. O confronto direto acumula vitórias, derrotas e empates dos duelos salvos. Uma tag pública identifica um jogador; consultá-la não comprova que a pessoa é dona da conta do jogo.

O monitor consulta a API e salva no banco; o React consulta `/api/groups` para ler os registros. O servidor local do Vite usa os mesmos handlers publicados como funções na Vercel. O token é lido apenas no servidor.

Endpoints disponíveis:

- `GET /api/player?tag=%23SUA_TAG`: perfil resumido, com nome, troféus, vitórias e clã.
- `GET /api/battles?tag=%23SUA_TAG`: amistosos 1×1 recentes no formato dos cards do histórico.

As rotas são públicas e somente de leitura. Validam a tag, rejeitam parâmetros extras e métodos diferentes de GET e usam timeout de 10 segundos. Respostas bem-sucedidas têm cache de CDN de 30 segundos; falhas não são armazenadas. Antes de abrir a aplicação para muitos usuários, configure limites de requisições no firewall da Vercel ou use um limitador distribuído. O cache não substitui controle de abuso.

## 5. Publicar frontend e backend juntos na Vercel

1. Importe o repositório na Vercel e use como **Root Directory** a pasta que contém `src`, `api`, `vercel.json` e o `package.json` do Vite. Se esses arquivos já estão na raiz do repositório importado, use `./`; se estiverem dentro de uma subpasta `ClashDosAmigui`, selecione essa subpasta.
2. Use o preset **Vite**, Node **24.x**, build `npm run build` e saída `dist`.
3. Nas variáveis de ambiente, configure `CLASH_ROYALE_API_TOKEN` e `CLASH_ROYALE_API_MODE` para os ambientes desejados. Não use prefixo `VITE_` para esses valores.
4. Resolva o IP de saída conforme as opções abaixo e publique. Alterações em variáveis de ambiente exigem novo deployment.
5. Abra `/historico` e teste uma tag real. Os arquivos `api/player.js` e `api/battles.js` serão funções no mesmo domínio do frontend. O `vercel.json` preserva `/api/*` e encaminha as páginas do React para `index.html`.

### Conexão direta com IP estável

Deixe `CLASH_ROYALE_API_MODE=direct`. Autorize no portal da Supercell o IPv4 público de saída das funções. O IP que recebe os acessos ao site não é necessariamente o IP usado pelo backend para chamar serviços externos.

A Vercel usa IPs de saída dinâmicos por padrão. O recurso **Static IPs** está disponível nos planos Pro e Enterprise como recurso pago. Se escolher esse recurso, habilite-o e autorize os IPs apresentados pela Vercel no token da Supercell. Não é necessário alterar o código.

### Proxy RoyaleAPI, opcional

O RoyaleAPI documenta um proxy para conexões sem IP estável. Ele é um serviço terceiro, independente do nosso app: **o proxy recebe o token de autenticação enviado pelo backend e as tags consultadas**. Ele só será usado se você optar por configurá-lo.

Se aceitar esse fluxo:

1. Crie uma chave separada no portal da Supercell e autorize o IP **`45.79.218.79`**, indicado na documentação do RoyaleAPI.
2. Coloque essa chave em `CLASH_ROYALE_API_TOKEN` na Vercel.
3. Defina `CLASH_ROYALE_API_MODE=royaleapi` e publique novamente.

O backend passará a consultar `https://proxy.royaleapi.dev/v1`. Não há fallback automático para o proxy, e URLs arbitrárias não são aceitas. Confirme as instruções atuais e a disponibilidade do serviço antes de usá-lo em produção.

## 6. Histórico permanente e contas

Nome, troféus e resultados do jogo podem alimentar o ranking. Foto enviada pelo usuário e frase personalizada devem ser tratadas como dados do nosso aplicativo, armazenados separadamente. O total de vitórias do perfil também não equivale às vitórias de um campeonato entre amigos: esse placar precisa de regras próprias.

O banco local, a lógica de grupos e as contas pessoais estão conectados. Os convites permitem cadastro, login e entrada por tag; veja [contas e convites](contas-convites.md). O adaptador e as migrações do Supabase estão preparados, mas exigem configuração de um projeto para publicar na Vercel. O monitor preserva as partidas coletadas; não recupera automaticamente partidas antigas que já saíram da API.

## Verificação

Execute `npm test`, `npm run lint` e `npm run build`. Os testes simulam a API e verificam filtros de amistosos, IDs consistentes, contagem sem duplicação, validação de tags, destinos permitidos, timeout e erros sem expor o token. A validação com dados reais depende de uma chave e IP autorizados.

Referências: [portal oficial](https://developer.clashroyale.com/), [documentação da API](https://developer.clashroyale.com/#/documentation), [funções Node na Vercel](https://vercel.com/docs/functions/runtimes/node-js), [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [IPs de saída na Vercel](https://vercel.com/kb/guide/how-to-allowlist-deployment-ip-address), [proxy RoyaleAPI](https://docs.royaleapi.com/proxy.html).
