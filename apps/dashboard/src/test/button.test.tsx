import { render, screen } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders a link with asChild (single Slot child)', () => {
    render(
      <MemoryRouter>
        <Button asChild>
          <Link to="/x">Go</Link>
        </Button>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/x');
  });

  it('shows a busy state while loading', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
