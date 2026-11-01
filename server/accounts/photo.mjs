import sharp from 'sharp'
import { hashToken } from './security.mjs'
import { ApiError } from '../clashRoyale.mjs'

export async function processPhoto(value) {
  if (value === undefined || value === null || value === '') return { photo: null, photoVersion: null }
  if (typeof value !== 'string' || value.length > 2_800_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) throw new ApiError(400, 'Envie uma foto JPEG, PNG ou WebP de até 2 MB.')
  const bytes = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64')
  if (bytes.length > 2 * 1024 * 1024) throw new ApiError(413, 'A foto deve ter até 2 MB.')
  const validMagic = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP')
  if (!validMagic) throw new ApiError(400, 'Escolha uma foto JPEG, PNG ou WebP válida.')
  try {
    const image = sharp(bytes, { limitInputPixels: 16_000_000, animated: false, failOn: 'warning' })
    const metadata = await image.metadata()
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Formato não permitido')
    const normalized = await image.rotate().resize(384, 384, { fit: 'cover', withoutEnlargement: true }).flatten({ background: '#153e72' }).jpeg({ quality: 80 }).toBuffer()
    if (normalized.length > 200_000) throw new Error('Imagem muito grande')
    return { photo: normalized.toString('base64'), photoVersion: hashToken(normalized).slice(0, 24) }
  } catch { throw new ApiError(400, 'Não foi possível ler a foto. Escolha uma imagem JPEG, PNG ou WebP válida.') }
}
