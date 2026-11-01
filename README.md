# Clash dos Amigui

Registrador de amistosos 1×1 entre membros de grupos. O backend consulta o Clash Royale, salva cada duelo uma única vez e calcula os confrontos diretos e o ranking do grupo. Frontend React e funções de backend ficam no mesmo projeto.

O administrador pode gerar um convite do grupo. A pessoa cria a conta com nome, idade, e-mail, senha e foto opcional, informa a tag do Clash e entra sem cadastro manual pelo organizador. Consulte [o guia de contas, convites e perfil](docs/contas-convites.md).

## Desenvolvimento

Use Node 24. Execute `npm install` e `npm run dev`. Crie sua conta em `/cadastro`; a primeira conta local criada sem convite recebe administração. Em `/grupos`, crie um grupo vazio e gere o link para os jogadores, ou adicione tags manualmente. O Vite atende o backend e o monitor local. Os dados e perfis ficam em `data/x1.sqlite`, preservados entre reinícios e ignorados pelo Git.

Veja [o funcionamento do registrador e a preparação para Supabase/Vercel](docs/registrador-x1.md).

## Verificação

Execute `npm test`, `npm run test:http`, `npm run lint` e `npm run build`.

## API do Clash Royale

Configure o token no `.env` conforme [o guia da API](docs/clash-royale-api.md). O comando `npm run api:player -- "#SUA_TAG"` permite testar um perfil pelo terminal. Na aplicação, grupos, histórico, ranking e home usam os duelos salvos no banco. O mock 5 × 1 permanece acessível em `/historico?demo=1`.

A autenticação é validada no backend com senha em hash e sessão em cookie HttpOnly. `/perfil` permite editar os dados da própria conta. Confirmação por e-mail e recuperação de senha não fazem parte desta etapa.

## Estrutura e rotas

- `src/main.jsx`: inicialização do React e do BrowserRouter.
- `src/App.jsx`: composição da aplicação.
- `src/routes/AppRoutes.jsx`: definição central das rotas.
- `src/pages/Login/`: tela de login e seus estilos em CSS Modules.
- `src/pages/NotFound/`: página para endereços não encontrados.
- `src/index.css`: estilos globais e variáveis do tema.

A rota `/` redireciona para `/home`. Endereços não cadastrados exibem a página 404.

Para adicionar uma tela, crie sua pasta em `src/pages`, importe o componente em `src/routes/AppRoutes.jsx` e adicione um `<Route path="/sua-rota" element={<SuaPagina />} />`. Use `Link` do React Router para navegar entre telas sem recarregar a aplicação.

Na Vercel, selecione como raiz a pasta que contém o `package.json` do Vite, `src`, `api` e `vercel.json` (`./` se já for a raiz do repositório importado). O `vercel.json` configura as páginas React e preserva as rotas do backend. A API do Clash exige um IP de saída autorizado; escolha a conexão direta com IP estável ou configure explicitamente o proxy opcional conforme o guia.
