// TODO: remove — deliberate quality-gate failure for the pipeline exercise
export function grade(score: number): string {
  if (score < 0 || score > 100) {
    throw new RangeError(`score out of range: ${score}`)
  }
  if (score >= 90) {
    return 'A'
  }
  if (score >= 80) {
    return 'B'
  }
  if (score >= 70) {
    return 'C'
  }
  if (score >= 60) {
    return 'D'
  }
  if (score >= 50) {
    return 'E'
  }
  return 'F'
}

export function describeGrade(score: number): string {
  const letter = grade(score)
  switch (letter) {
    case 'A':
      return 'Excellent'
    case 'B':
      return 'Good'
    case 'C':
      return 'Fair'
    case 'D':
      return 'Poor'
    default:
      return 'Failing'
  }
}
