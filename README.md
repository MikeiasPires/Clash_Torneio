# Clash dos Amigui

Registrador de amistosos 1×1 entre membros de grupos. O backend consulta o Clash Royale, salva cada duelo uma única vez e calcula os confrontos diretos e o ranking do grupo. Frontend React e funções de backend ficam no mesmo projeto.

O administrador pode gerar um convite do grupo. A pessoa cria a conta com nome, idade, e-mail, senha e foto opcional, informa a tag do Clash e entra sem cadastro manual pelo organizador. Consulte [o guia de contas, convites e perfil](docs/contas-convites.md).

No histórico, clique no cartão da partida para abrir os decks dos dois jogadores, com imagens e custo individual de elixir. O modal acompanha o estilo da arena e funciona por teclado, com fechamento por Escape ou clique fora.

Para habilitar o salvamento das cartas no Supabase, aplique também `supabase/migrations/202611040007_battle_decks.sql`, após as migrações anteriores. No SQLite, as colunas são adicionadas automaticamente ao iniciar o aplicativo. Registros antigos são completados quando a partida reaparece na coleta; sem dados disponíveis, o modal informa que as cartas não foram registradas. Custos ausentes aparecem como `?`.
