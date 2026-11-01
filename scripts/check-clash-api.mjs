import process from 'node:process'
import { createClashClient } from '../server/clashRoyale.mjs'

try {
  const player = await createClashClient().getPlayer(process.argv[2])
  console.log(JSON.stringify({
    tag: player.tag,
    nome: player.name,
    trofeus: player.trophies,
    recordeDeTrofeus: player.bestTrophies,
    vitorias: player.wins,
    derrotas: player.losses,
    partidas: player.matches,
    cla: player.clan || 'Sem clã',
  }, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
