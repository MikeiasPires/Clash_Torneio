import process from 'node:process'
import { getGroupsService } from '../server/groups/service.mjs'

try {
  const [name, ...tags] = process.argv.slice(2)
  const service = await getGroupsService(process.env)
  const group = await service.createGroup({ name, tags })
  console.log(JSON.stringify({ group, initialSync: await service.sync(group.id) }, null, 2))
} catch (error) { console.error(error.message); process.exitCode = 1 }
