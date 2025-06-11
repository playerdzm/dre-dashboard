import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Dashboard Financeiro link', () => {
  render(<App />);
  const linkElement = screen.getByText(/Dashboard Financeiro/i);
  expect(linkElement).toBeInTheDocument();
});
