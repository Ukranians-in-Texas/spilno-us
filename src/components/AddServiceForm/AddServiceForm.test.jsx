// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import { AddServiceForm } from './AddServiceForm';

function renderForm() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <AddServiceForm />
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe('AddServiceForm', () => {
  it('renders all required field labels', () => {
    renderForm();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Business name')).toBeInTheDocument();
    expect(screen.getByText('Description (English)')).toBeInTheDocument();
    expect(screen.getByText('Description (Ukrainian)')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('shows required field errors on empty submit', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getAllByRole('button', { name: 'Submit' })[0]);

    await waitFor(() => {
      expect(screen.getByText('Please select a category')).toBeInTheDocument();
      expect(screen.getByText('Please enter your business name')).toBeInTheDocument();
      expect(screen.getByText('Please enter a description in English')).toBeInTheDocument();
      expect(screen.getByText('Please enter a description in Ukrainian')).toBeInTheDocument();
      expect(screen.getByText('Please enter your email')).toBeInTheDocument();
    });
  });

  it('shows consent error on submit without checking the box', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getAllByRole('button', { name: 'Submit' })[0]);

    await waitFor(() => {
      expect(screen.getByText('Please agree to the terms to submit')).toBeInTheDocument();
    });
  });

  it('shows email format error for invalid email', async () => {
    const user = userEvent.setup();
    renderForm();

    const emailInput = screen.getByLabelText('Email', { exact: false });
    await user.type(emailInput, 'not-an-email');
    await user.click(screen.getAllByRole('button', { name: 'Submit' })[0]);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('shows phone format error for invalid phone', async () => {
    const user = userEvent.setup();
    renderForm();

    const phoneInput = screen.getByLabelText('Phone number', { exact: false });
    await user.type(phoneInput, 'abc');
    await user.click(screen.getAllByRole('button', { name: 'Submit' })[0]);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
    });
  });

  it('shows website format error for invalid URL', async () => {
    const user = userEvent.setup();
    renderForm();

    const websiteInput = screen.getByLabelText('Website', { exact: false });
    await user.type(websiteInput, 'not-a-url');
    await user.click(screen.getAllByRole('button', { name: 'Submit' })[0]);

    await waitFor(() => {
      expect(screen.getByText(/must start with/i)).toBeInTheDocument();
    });
  });

  it('shows business name length error', async () => {
    const user = userEvent.setup();
    renderForm();

    const nameInput = screen.getByLabelText('Business name', { exact: false });
    // maxlength="100" prevents userEvent.type from exceeding 100 chars,
    // so use fireEvent.change to bypass the HTML attribute
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(nameInput, { target: { value: 'A'.repeat(101) } });
    await user.click(screen.getAllByRole('button', { name: 'Submit' })[0]);

    await waitFor(() => {
      expect(screen.getByText('Business name must be 100 characters or less')).toBeInTheDocument();
    });
  });

  it('does not show errors before submit or blur', () => {
    renderForm();
    expect(screen.queryByText('Please select a category')).not.toBeInTheDocument();
    expect(screen.queryByText('Please enter your business name')).not.toBeInTheDocument();
  });
});
