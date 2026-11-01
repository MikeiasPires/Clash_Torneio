import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { inspectInvite } from '../services/accountApi.js'
export function useInvite() {
  const token = useLocation().hash.slice(1)
  const [state, setState] = useState({ token: '', invite: null, error: '' })
  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    inspectInvite(token, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ token, invite: data.invite, error: '' })
    }).catch(error => { if (!controller.signal.aborted) setState({ token, invite: null, error: error.message }) })
    return () => controller.abort()
  }, [token])
  return { token, invite: state.token === token ? state.invite : null, error: state.token === token ? state.error : '',
    loading: Boolean(token && state.token !== token), suffix: token ? '#' + token : '' }
}
