import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePlayerTag, parseGroupTags } from './playerTag.js'
import { parseGroup } from '../server/groups/domain.mjs'

test('aceita tags acompanhadas de nomes por linha sem transformar os nomes em IDs', () => {
  assert.deepEqual(parseGroupTags('#P0LY Franklin\n#QY82 LULU\n#GG88 Outro amigo'), ['#P0LY', '#QY82', '#GG88'])
})

test('normaliza a confusão entre O e zero, caixa e tags repetidas', () => {
  assert.equal(normalizePlayerTag(' #v9luucror '), '#V9LUUCR0R')
  assert.deepEqual(parseGroupTags('#P0LY Amigo, #QY82 Outro; #p0ly Repetido'), ['#P0LY', '#QY82'])
})

test('mantém suporte a tags sem nomes e sem #', () => {
  assert.deepEqual(parseGroupTags('P0LY QY82'), ['#P0LY', '#QY82'])
  assert.deepEqual(parseGroupTags('#P0LY #QY82'), ['#P0LY', '#QY82'])
  assert.deepEqual(parseGroupTags(['#P0LY Amigo', '#QY82 Outro']), ['#P0LY', '#QY82'])
})

test('não ignora tags inválidas nem linhas sem tag válida', () => {
  for (const input of ['#INVALID Amigo\n#P0LY Outro', '#P0LY Amigo\nsem-tag', ['#P0LY', null], Array(21).fill('#P0LY'), '#P0LY '.repeat(21)]) {
    assert.throws(() => parseGroupTags(input))
  }
})

test('backend aceita a lista copiada e elimina jogadores repetidos', () => {
  assert.deepEqual(parseGroup({ name: 'Amigui', tags: '#P0LY Amigo\n#QY82 Outro' }).tags, ['#P0LY', '#QY82'])
  assert.deepEqual(parseGroup({ name: 'Amigui', tags: '#P0LY Um\n#p0ly Outro nome' }).tags, ['#P0LY'])
})
