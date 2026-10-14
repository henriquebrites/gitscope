import { describe, expect, it } from 'vitest'
import workflow from '../../.github/workflows/ci.yml?raw'

// T7: the workflow is read as text, since the repo has no YAML parser.
const jobsStart = workflow.indexOf('\njobs:\n')
const e2eStart = workflow.indexOf('\n  e2e:\n')
const header = workflow.slice(0, jobsStart)
const checksJob = workflow.slice(workflow.indexOf('\n  checks:\n'), e2eStart)
const e2eJob = workflow.slice(e2eStart)

const position = (job: string, step: string) => {
  const index = job.indexOf(step)
  expect(index, step).toBeGreaterThan(-1)
  return index
}

describe('CI workflow', () => {
  it('triggers on pull requests to main and on pushes to main', () => {
    expect(header).toMatch(/\n {2}pull_request:\n {4}branches: \[main\]\n/)
    expect(header).toMatch(/\n {2}push:\n {4}branches: \[main\]\n/)
  })

  it('sets up node and install in both jobs with Node 24, the npm cache and npm ci', () => {
    for (const job of [checksJob, e2eJob]) {
      expect(job).toContain('uses: actions/checkout@v7')
      expect(job).toContain('uses: actions/setup-node@v7')
      expect(job).toContain('node-version: 24')
      expect(job).toContain('cache: npm')
      expect(job).toContain('run: npm ci')
    }
  })

  it('pins the action majors that run on Node 24', () => {
    expect(workflow).not.toContain('@v4')
    expect(e2eJob).toContain('uses: actions/upload-artifact@v7')
  })

  it('runs the checks order: lint, then test, then build', () => {
    const lint = position(checksJob, 'run: npm run lint')
    const test = position(checksJob, 'run: npm test')
    const build = position(checksJob, 'run: npm run build')
    expect(lint).toBeLessThan(test)
    expect(test).toBeLessThan(build)
  })

  it('runs the e2e job after checks, installing Chromium before the suite', () => {
    expect(e2eJob).toContain('needs: checks')
    const install = position(e2eJob, 'run: npx playwright install --with-deps chromium')
    const suite = position(e2eJob, 'run: npm run test:e2e')
    expect(install).toBeLessThan(suite)
  })

  it('uploads the Playwright report on failure', () => {
    const upload = e2eJob.slice(position(e2eJob, 'uses: actions/upload-artifact@v7'))
    expect(upload).toContain('if: failure()')
    expect(upload).toContain('name: playwright-report')
    expect(upload).toContain('path: playwright-report/')
  })

  it('groups concurrency by workflow and ref, cancelling only on pull requests', () => {
    expect(header).toContain('group: ${{ github.workflow }}-${{ github.ref }}')
    expect(header).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}")
  })
})
