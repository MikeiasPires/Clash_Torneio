import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHeadToHeadIndex } from './headToHead.js'

function match(id, leftId, leftCrowns, rightId, rightCrowns) {
  return { id, left: { id: leftId, crowns: leftCrowns }, right: { id: rightId, crowns: rightCrowns } }
}

test('conta vitórias e derrotas mesmo quando os jogadores trocam de lado', () => {
  const index = buildHeadToHeadIndex([
    match('a', 1, 3, 2, 1),
    match('b', 2, 2, 1, 0),
    match('c', 2, 0, 1, 1),
  ])
  assert.deepEqual(index.get(1).get(2), { wins: 2, losses: 1, draws: 0, total: 3 })
  assert.deepEqual(index.get(2).get(1), { wins: 1, losses: 2, draws: 0, total: 3 })
})

test('separa empates de vitórias e derrotas', () => {
  const index = buildHeadToHeadIndex([match('a', 1, 0, 2, 0), match('b', 2, 1, 1, 1)])
  assert.deepEqual(index.get(1).get(2), { wins: 0, losses: 0, draws: 2, total: 2 })
})

test('isola o placar de cada adversário pelos IDs', () => {
  const index = buildHeadToHeadIndex([match('a', 1, 3, 2, 0), match('b', 1, 0, 3, 2)])
  assert.deepEqual(index.get(1).get(2), { wins: 1, losses: 0, draws: 0, total: 1 })
  assert.deepEqual(index.get(1).get(3), { wins: 0, losses: 1, draws: 0, total: 1 })
  assert.equal(index.get(2).has(3), false)
})

test('não conta duas vezes uma partida repetida no histórico', () => {
  const game = match('a', 1, 3, 2, 0)
  const index = buildHeadToHeadIndex([game, game])
  assert.equal(index.get(1).get(2).total, 1)
  assert.equal(index.get(2).get(1).total, 1)
})

test('aceita histórico vazio', () => {
  assert.equal(buildHeadToHeadIndex([]).size, 0)
})
