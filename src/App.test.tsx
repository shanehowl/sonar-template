import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App routing', () => {
  it('renders the Home page with the counter at /', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Sonar Template' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Count: 0')
  })

  it('renders the About page at /about', () => {
    renderAt('/about')
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument()
  })

  it('renders a not-found page with a link home for unknown paths', () => {
    renderAt('/does-not-exist')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go back home' })).toHaveAttribute('href', '/')
  })

  it('marks the current page in the main navigation', () => {
    renderAt('/about')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('navigates between pages via the nav links', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('link', { name: 'About' }))
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Home' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Sonar Template' })).toBeInTheDocument()
  })
})
