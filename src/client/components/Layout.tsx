import { NavLink, Outlet } from "react-router-dom";
import { useSSE } from "../hooks/useSSE";

const navItems = [
  { path: "/", label: "Overview" },
  { path: "/agents", label: "Agents" },
  { path: "/sessions", label: "Sessions" },
  { path: "/sprites", label: "Sprites" },
  { path: "/logs", label: "Logs" },
  { path: "/crons", label: "Cron Jobs" },
  { path: "/errors", label: "Errors" },
];

export function Layout() {
  const { connected } = useSSE();

  return (
    <div className="flex h-screen">
      <nav className="w-[200px] shrink-0 border-r border-[var(--border)] bg-[var(--bg2)] flex flex-col">
        <div className="px-4 py-4 border-b border-[var(--border)]">
          <h1 className="text-base font-semibold text-[var(--blue)]">Cortex</h1>
          <span className="text-[10px] text-[var(--fg2)]">OpenClaw Dashboard</span>
        </div>
        <ul className="mt-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `block px-4 py-2 border-l-[3px] transition-all ${
                    isActive
                      ? "border-[var(--blue)] bg-[var(--bg3)] text-[var(--blue)]"
                      : "border-transparent hover:bg-[var(--bg3)]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-auto p-3 text-[11px] border-t border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-[var(--fg3)]">Cortex v2.0.0</span>
            <span
              className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
              title={connected ? "Connected" : "Disconnected"}
            />
          </div>
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center justify-end px-6 py-3 bg-[var(--bg)] border-b border-[var(--border)]">
          <div className="text-sm text-[var(--fg3)]">{connected ? "Live" : "Offline"}</div>
        </header>
        <div className="p-5">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
