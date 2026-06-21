// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import { ServiceList } from './ServiceList';

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <LanguageProvider>{ui}</LanguageProvider>
    </MemoryRouter>
  );
}

const SERVICES = [
  { id: '1', title: 'Alpha Plumbing', description: 'Pipe repairs', category: 'Plumbing', phone: '555-0001', email: 'a@test.com' },
  { id: '2', title: 'Beta Cleaning', description: 'Office cleaning', category: 'Cleaning', phone: '555-0002', email: 'b@test.com' },
];

describe('ServiceList', () => {
  it('renders loading skeletons when loading', () => {
    renderWithProviders(<ServiceList services={[]} loading={true} />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(6);
  });

  it('renders error state with retry button', () => {
    renderWithProviders(
      <ServiceList services={[]} loading={false} error="Network error" onRetry={() => {}} />
    );
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders empty state when no services', () => {
    renderWithProviders(<ServiceList services={[]} loading={false} />);
    expect(screen.getByText(/no services in this category/i)).toBeInTheDocument();
  });

  it('renders service cards when data is present', () => {
    renderWithProviders(
      <ServiceList services={SERVICES} loading={false} onSubcategoryClick={() => {}} />
    );
    expect(screen.getByText('Alpha Plumbing')).toBeInTheDocument();
    expect(screen.getByText('Beta Cleaning')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    renderWithProviders(
      <ServiceList services={SERVICES} loading={false} title="Featured" onSubcategoryClick={() => {}} />
    );
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });
});
