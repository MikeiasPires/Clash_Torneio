import assert from 'node:assert/strict'
import test from 'node:test'
import { battleCardImageSrc, cardImageUrl, normalizeBattleCards } from './battleCards.js'

test('imagens aceitam apenas HTTPS no CDN das cartas, sem credenciais ou portas extras', () => {
  const url = 'https://api-assets.clashroyale.com/cards/300/knight.png'
  assert.equal(cardImageUrl(url), url)
  for (const value of [null, 'javascript:alert(1)', 'data:image/svg+xml,test',
    'http://api-assets.clashroyale.com/cards/a.png', 'https://api-assets.clashroyale.com.evil.test/cards/a.png',
    'https://api-assets.clashroyale.com@evil.test/cards/a.png', 'https://user:pass@api-assets.clashroyale.com/cards/a.png',
    'https://api-assets.clashroyale.com:8080/cards/a.png', 'https://api-assets.clashroyale.com/other/a.png']) {
    assert.equal(cardImageUrl(value), null)
    assert.equal(battleCardImageSrc(value), null)
  }
})

test('decks inválidos, repetidos, extensos ou com elixir desconhecido são tratados sem inventar custos', () => {
  assert.deepEqual(normalizeBattleCards(null), [])
  const card = { id: 26000000, name: ' Knight ', elixirCost: 3 }
  const result = normalizeBattleCards([null, {}, card, card, { ...card, id: 26000001, elixirCost: -1 },
    { ...card, id: 26000002, elixirCost: '3' }, { ...card, id: 26000003, elixirCost: 0 }])
  assert.equal(result.length, 4)
  assert.equal(result[0].name, 'Knight')
  assert.equal(result[1].elixirCost, null)
  assert.equal(result[2].elixirCost, null)
  assert.equal(result[3].elixirCost, 0)
  assert.equal(normalizeBattleCards(Array.from({ length: 30 }, (_, id) => ({ ...card, id: id + 1 }))).length, 8)
})
