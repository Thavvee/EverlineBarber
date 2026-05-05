import { useEffect, useState } from "react";
import BookingPage from "./pages/BookingPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import WorktimePage from "./pages/WorktimePage.jsx";

function App() {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const path = window.location.pathname;
  let page = <BookingPage />;
  if (path === "/dashboard") page = <DashboardPage />;
  if (path === "/worktime") page = <WorktimePage />;

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (!response.ok) return setUser(null);
        const data = await response.json();
        setUser(data.user);
      } catch {
        setUser(null);
      }
    }

    loadUser();
  }, []);

  return (
    <div className="app-layout">
      <header className="topbar">
        <h1>Everline Barber</h1>

        <div className="user-menu">
          {user ? (
            <>
              <button
                type="button"
                className="user-avatar-button"
                onClick={() => setMenuOpen((current) => !current)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <span className="user-avatar">
                  {user.pictureUrl ? (
                    <img src={user.pictureUrl} alt={user.displayName} />
                  ) : (
                    <span>{user.displayName?.charAt(0) || "U"}</span>
                  )}
                </span>
                <span className="user-display-name">{user.displayName}</span>
              </button>
              <div className={`user-dropdown ${menuOpen ? "open" : ""}`}>
                <p className="user-name">{user.displayName}</p>
                <p className="user-role">{user.role}</p>
                <form method="POST" action="/logout">
                  <button className="logout-button" type="submit">
                    Logout
                  </button>
                </form>
              </div>
            </>
          ) : (
            <a className="login-link" href="/login">
              เข้าสู่ระบบ
            </a>
          )}
        </div>
      </header>
      {page}
    </div>
  );
}

export default App;
