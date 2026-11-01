import process from 'node:process'
import { getGroupsService } from '../server/groups/service.mjs'

try {
  const service = await getGroupsService(process.env)
  console.log(JSON.stringify(await service.sync(process.argv[2] || null), null, 2))
} catch (error) { console.error(error.message); process.exitCode = 1 }
