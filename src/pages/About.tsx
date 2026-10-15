export default function About() {
  return (
    <>
      <h1>About</h1>
      <p>
        Every push to <code>main</code> runs lint, tests with coverage and a build on GitHub Actions,
        then a SonarQube Community Build scan on a self-hosted runner. The app deploys to GitHub
        Pages only when the quality gate passes.
      </p>
    </>
  )
}
