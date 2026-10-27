# Clash dos Amigui

Interface de login em React com layout responsivo, validação nativa dos campos e opção de mostrar senha.

## Desenvolvimento

Execute `npm install` e `npm run dev`.

## Verificação

Execute `npm run lint` e `npm run build`.

A autenticação ainda não está integrada. O formulário exibe uma mensagem informativa e não envia nem armazena credenciais. A integração futura deve validar as credenciais no servidor.

## Estrutura e rotas

- `src/main.jsx`: inicialização do React e do BrowserRouter.
- `src/App.jsx`: composição da aplicação.
- `src/routes/AppRoutes.jsx`: definição central das rotas.
- `src/pages/Login/`: tela de login e seus estilos em CSS Modules.
- `src/pages/NotFound/`: página para endereços não encontrados.
- `src/index.css`: estilos globais e variáveis do tema.

A rota `/` redireciona para `/login`. Endereços não cadastrados exibem a página 404.

Para adicionar uma tela, crie sua pasta em `src/pages`, importe o componente em `src/routes/AppRoutes.jsx` e adicione um `<Route path="/sua-rota" element={<SuaPagina />} />`. Use `Link` do React Router para navegar entre telas sem recarregar a aplicação.

Em produção, configure a hospedagem para servir `index.html` nas rotas da aplicação (fallback de SPA), permitindo abrir ou atualizar `/login` diretamente.
