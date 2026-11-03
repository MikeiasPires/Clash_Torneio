import assert from 'node:assert/strict'
import test from 'node:test'
import { startGroupPolling } from './groupPolling.js'

const flush = () => new Promise(resolve => setImmediate(resolve))

test('consulta ao abrir e a cada 30 segundos, sem sobrepor lotes e sem publicar depois de sair', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let calls = 0, finish, signal
  const reports = [], errors = []
  const stop = startGroupPolling({ groupId: 'grupo',
    poll: (id, requestSignal) => {
      assert.equal(id, 'grupo')
      calls++; signal = requestSignal
      return new Promise(resolve => { finish = resolve })
    },
    onResult: report => reports.push(report), onError: error => errors.push(error),
  })
  t.after(stop)
  assert.equal(calls, 1)
  t.mock.timers.tick(30_000)
  assert.equal(calls, 1)
  finish({ recordedMatches: 1 }); await flush()
  assert.equal(reports.length, 1)
  t.mock.timers.tick(29_999)
  assert.equal(calls, 1)
  t.mock.timers.tick(1)
  assert.equal(calls, 2)
  stop()
  assert.equal(signal.aborted, true)
  finish({ recordedMatches: 2 }); await flush()
  t.mock.timers.tick(60_000)
  assert.equal(calls, 2)
  assert.equal(reports.length, 1)
  assert.deepEqual(errors, [])
})

test('pausa aba oculta, retoma ao voltar e recupera uma falha sem parar as proximas consultas', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  const visibility = new EventTarget()
  visibility.visibilityState = 'hidden'
  let calls = 0
  const reports = [], errors = []
  const stop = startGroupPolling({ groupId: 'grupo', visibilityTarget: visibility,
    poll: async () => {
      if (++calls === 1) throw new Error('API indisponivel')
      return { checkedPlayers: 2, recordedMatches: 1, failures: [] }
    },
    onResult: report => reports.push(report), onError: error => errors.push(error.message),
  })
  t.after(stop)
  t.mock.timers.tick(30_000)
  assert.equal(calls, 0)
  visibility.visibilityState = 'visible'
  visibility.dispatchEvent(new Event('visibilitychange')); await flush()
  assert.deepEqual(errors, ['API indisponivel'])
  t.mock.timers.tick(30_000); await flush()
  assert.equal(calls, 2)
  assert.equal(reports[0].recordedMatches, 1)
  stop()
  visibility.dispatchEvent(new Event('visibilitychange'))
  assert.equal(calls, 2)
})
