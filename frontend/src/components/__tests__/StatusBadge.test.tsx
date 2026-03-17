import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../StatusBadge'

test('renders running status', () => {
  render(<StatusBadge status="running" />)
  expect(screen.getByText('running')).toBeInTheDocument()
})

test('renders failed status', () => {
  render(<StatusBadge status="failed" />)
  expect(screen.getByText('failed')).toBeInTheDocument()
})
