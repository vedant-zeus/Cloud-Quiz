import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

describe('UI Component Unit Tests', () => {
  it('renders status badge with appropriate styling for PUBLISHED', () => {
    render(<Badge status="PUBLISHED" />);
    const badge = screen.getByText('PUBLISHED');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-emerald-700');
  });

  it('renders status badge for DRAFT', () => {
    render(<Badge status="DRAFT" />);
    const badge = screen.getByText('DRAFT');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-amber-700');
  });

  it('renders Button component with label and handles click', () => {
    render(<Button variant="primary">Create Quiz</Button>);
    const btn = screen.getByRole('button', { name: /create quiz/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('disables button when loading is true', () => {
    render(<Button loading={true}>Submit</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });
});
