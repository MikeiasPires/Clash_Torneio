import LoadingIndicator from '../LoadingIndicator/LoadingIndicator.jsx'

function SessionLoading({ children }) {
  return <div className="session-loading">
    <LoadingIndicator>{children}</LoadingIndicator>
  </div>
}

export default SessionLoading
