import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Overview } from "./views/Overview";
import { Sessions } from "./views/Sessions";
import { Logs } from "./views/Logs";
import { Crons } from "./views/Crons";
import { Errors } from "./views/Errors";
import { Agents } from "./views/Agents";
import { AgentDetail } from "./views/AgentDetail";
import { SSEProvider } from "./components/SSEProvider";

export function App() {
  return (
    <BrowserRouter>
      <SSEProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/crons" element={<Crons />} />
            <Route path="/errors" element={<Errors />} />
            <Route path="/agents/:id" element={<AgentDetail />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </SSEProvider>
    </BrowserRouter>
  );
}
