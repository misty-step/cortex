import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { path: "/", label: "Overview" },
  { path: "/sessions", label: "Sessions" },
  { path: "/logs", label: "Logs" },
  { path: "/crons", label: "Cron Jobs" },
  { path: "/models", label: "Models" },
  { path: "/errors", label: "Errors" },
];

export function Layout() {
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
        <div className="mt-auto p-3 text-[11px] text-[var(--fg3)] border-t border-[var(--border)]">
          Cortex v2.0.0
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto p-5">
        <Outlet />
      </main>
    </div>
  );
}
