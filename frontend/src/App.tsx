import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RigbyPage from './pages/RigbyPage';
import LoadOptimizer from './pages/LoadOptimizer';
import DispatchEngine from './pages/DispatchEngine.tsx';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RigbyPage />} />
        <Route path="/load-optimizer" element={<LoadOptimizer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/dispatch-engine" element={<DispatchEngine />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;