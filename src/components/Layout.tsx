import { NavLink, Outlet } from 'react-router'

export default function Layout() {
  return (
    <>
      <header className="site-header">
        <nav aria-label="Main">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </>
  )
}
