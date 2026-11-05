import LoadingIndicator from '../LoadingIndicator/LoadingIndicator.jsx'

function SessionLoading({ children }) {
  return <LoadingIndicator fullscreen>{children}</LoadingIndicator>
}

export default SessionLoading
