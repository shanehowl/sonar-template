import { useState } from 'react'

type CounterProps = {
  initial?: number
}

export default function Counter({ initial = 0 }: Readonly<CounterProps>) {
  const [count, setCount] = useState(initial)

  return (
    <section aria-label="Counter" className="counter">
      <p role="status">Count: {count}</p>
      <div className="counter-actions">
        <button type="button" onClick={() => setCount((c) => c - 1)}>
          Decrement
        </button>
        <button type="button" onClick={() => setCount((c) => c + 1)}>
          Increment
        </button>
        <button type="button" onClick={() => setCount(initial)}>
          Reset
        </button>
      </div>
    </section>
  )
}
