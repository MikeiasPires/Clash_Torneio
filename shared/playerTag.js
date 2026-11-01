export function normalizePlayerTag(value) {
  const tag = typeof value === 'string' ? value.trim().toUpperCase().replace(/^#/, '').replace(/O/g, '0') : ''
  if (!/^[0289PYLQGRJCUV]{3,15}$/.test(tag)) {
    throw new Error('Informe uma tag válida do Clash Royale, como #P0LYQ.')
  }
  return `#${tag}`
}

export function parseGroupTags(input) {
  if (typeof input === 'string' && input.length > 4000) throw new Error('A lista de jogadores é muito longa.')
  const entries = typeof input === 'string' ? input.split(/[\n\r,;]+/) : input
  if (!Array.isArray(entries) || (Array.isArray(input) && entries.length > 20) || entries.some(entry => typeof entry !== 'string')) {
    throw new Error('Informe uma lista com até 20 tags de jogadores.')
  }
  const tags = []
  for (const entry of entries) {
    const words = entry.trim().split(/\s+/).filter(Boolean)
    if (!words.length) continue
    // Com #, o restante da linha pode conter nomes de referência.
    // Sem #, cada palavra deve ser uma tag, evitando ignorar entradas inválidas.
    const explicitTags = words.filter(word => word.startsWith('#'))
    for (const candidate of explicitTags.length ? explicitTags : words) {
      tags.push(normalizePlayerTag(candidate))
      if (tags.length > 20) throw new Error('Informe no máximo 20 tags por grupo.')
    }
  }
  return [...new Set(tags)]
}
