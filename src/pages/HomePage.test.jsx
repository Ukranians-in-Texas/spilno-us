// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../context/LanguageContext';
import { ThemeProvider } from '../context/ThemeContext';
import { HomePage } from './HomePage';

const SERVICES = [
  { id: '1', title: 'Alpha Plumbing', description: 'Pipe repairs', category: 'Plumbing', featured: true, featured_order: 1 },
  { id: '2', title: 'Beta Cleaning', description: 'Office cleaning', category: 'Cleaning', featured: false },
  { id: '3', title: 'Gamma Electric', description: 'Electrical work', category: 'Electrical', featured: false, address: '123 Main St, Dallas' },
  { id: '4', title: 'Delta Paint', description: 'House painting', category: 'Painting', featured: true, featured_order: 2 },
  { id: '5', title: 'Epsilon HVAC', description: 'AC repair', category: 'HVAC', featured: false },
  { id: '6', title: 'Zeta Roofing', description: 'Roof repair', category: 'Roofing', featured: false },
  { id: '7', title: 'Eta Landscaping', description: 'Yard work', category: 'Landscaping', featured: false },
  { id: '8', title: 'Theta Plumbing Pro', description: 'Advanced plumbing in Houston', category: 'Plumbing', featured: false },
];

vi.mock('../hooks/useServices', () => ({
  useServices: () => ({
    services: SERVICES,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

function renderHomePage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <LanguageProvider>
          <HomePage />
        </LanguageProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('HomePage', () => {
  beforeEach(() => { localStorage.clear(); });

  it('renders the search bar', () => {
    renderHomePage();
    expect(screen.getByPlaceholderText('Search for services...')).toBeInTheDocument();
  });

  it('shows all service titles', () => {
    renderHomePage();
    for (const s of SERVICES) {
      expect(screen.getByText(s.title)).toBeInTheDocument();
    }
  });

  it('search filters by title', async () => {
    const user = userEvent.setup();
    renderHomePage();
    const searchInput = screen.getByPlaceholderText('Search for services...');
    await user.type(searchInput, 'Plumbing');

    expect(screen.getByText('Alpha Plumbing')).toBeInTheDocument();
    expect(screen.getByText('Theta Plumbing Pro')).toBeInTheDocument();
    expect(screen.queryByText('Beta Cleaning')).not.toBeInTheDocument();
    expect(screen.queryByText('Gamma Electric')).not.toBeInTheDocument();
  });

  it('search filters by description', async () => {
    const user = userEvent.setup();
    renderHomePage();
    const searchInput = screen.getByPlaceholderText('Search for services...');
    await user.type(searchInput, 'Houston');

    expect(screen.getByText('Theta Plumbing Pro')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Plumbing')).not.toBeInTheDocument();
  });

  it('search filters by address', async () => {
    const user = userEvent.setup();
    renderHomePage();
    const searchInput = screen.getByPlaceholderText('Search for services...');
    await user.type(searchInput, 'Dallas');

    expect(screen.getByText('Gamma Electric')).toBeInTheDocument();
  });

  it('clearing search shows all services again', async () => {
    const user = userEvent.setup();
    renderHomePage();
    const searchInput = screen.getByPlaceholderText('Search for services...');
    await user.type(searchInput, 'Plumbing');
    expect(screen.queryByText('Beta Cleaning')).not.toBeInTheDocument();

    await user.clear(searchInput);
    expect(screen.getByText('Beta Cleaning')).toBeInTheDocument();
  });

  it('no-match search shows empty state', async () => {
    const user = userEvent.setup();
    renderHomePage();
    const searchInput = screen.getByPlaceholderText('Search for services...');
    await user.type(searchInput, 'xyznonexistent');

    for (const s of SERVICES) {
      expect(screen.queryByText(s.title)).not.toBeInTheDocument();
    }
  });

  it('search is case-insensitive', async () => {
    const user = userEvent.setup();
    renderHomePage();
    const searchInput = screen.getByPlaceholderText('Search for services...');
    await user.type(searchInput, 'plumbing');

    expect(screen.getByText('Alpha Plumbing')).toBeInTheDocument();
    expect(screen.getByText('Theta Plumbing Pro')).toBeInTheDocument();
  });
});
