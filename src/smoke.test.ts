import { describe, expect, it } from 'vitest'

describe('toolchain', () => {
  it('runs tests with jest-dom matchers', () => {
    document.body.innerHTML = '<p>ok</p>'
    expect(document.querySelector('p')).toBeInTheDocument()
  })
})
