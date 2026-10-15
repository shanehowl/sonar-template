import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import Counter from './Counter'

describe('Counter', () => {
  it('starts at zero by default', () => {
    render(<Counter />)
    expect(screen.getByRole('status')).toHaveTextContent('Count: 0')
  })

  it('starts at the given initial value', () => {
    render(<Counter initial={5} />)
    expect(screen.getByRole('status')).toHaveTextContent('Count: 5')
  })

  it('increments and decrements', async () => {
    const user = userEvent.setup()
    render(<Counter />)
    await user.click(screen.getByRole('button', { name: 'Increment' }))
    await user.click(screen.getByRole('button', { name: 'Increment' }))
    await user.click(screen.getByRole('button', { name: 'Decrement' }))
    expect(screen.getByRole('status')).toHaveTextContent('Count: 1')
  })

  it('goes below zero', async () => {
    const user = userEvent.setup()
    render(<Counter />)
    await user.click(screen.getByRole('button', { name: 'Decrement' }))
    expect(screen.getByRole('status')).toHaveTextContent('Count: -1')
  })

  it('resets to the initial value', async () => {
    const user = userEvent.setup()
    render(<Counter initial={3} />)
    await user.click(screen.getByRole('button', { name: 'Increment' }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByRole('status')).toHaveTextContent('Count: 3')
  })
})
