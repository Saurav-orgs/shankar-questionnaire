import { Navigate, Route, Routes } from 'react-router-dom'
import { AssessmentFlow } from './routes/AssessmentFlow'
import { Consent } from './routes/Consent'
import { Landing } from './routes/Landing'

// Note: there is no patient-facing emergency screen. A red-flag answer is
// handled entirely on the doctor's side (prioritised at the top of their
// dashboard); the patient only ever sees the calm completion screen. The old
// Emergency route was removed for this reason; routes/Emergency.tsx is left in
// the tree, unused, in case that decision is revisited.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/consent" element={<Consent />} />
      <Route path="/a/:token" element={<AssessmentFlow />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
