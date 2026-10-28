import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AmountField } from '@/app/purchases/procurement/components/form-fields';

function Editor({ currency = 'MXN' }: { currency?: string }) {
  const [amount, setAmount] = useState(0);
  return <><AmountField label="Net amount" currency={currency} value={amount} onChange={setAmount} />
    <output data-testid="minor">{Number.isNaN(amount) ? 'invalid' : amount}</output></>;
}

test('preserves decimal entry and trailing zeros while emitting exact minor units', () => {
  render(<Editor />);
  const field = screen.getByLabelText('Net amount (MXN, net of tax)');
  for (const [raw, minor] of [['1', '100'], ['1.', '100'], ['1.0', '100'], ['1.01', '101'], ['50000.01', '5000001']]) {
    fireEvent.change(field, { target: { value: raw } });
    expect(field).toHaveValue(raw);
    expect(screen.getByTestId('minor')).toHaveTextContent(minor);
  }
});

test.each(['', '1.001', '-1', '1e3', 'Infinity', '9007199254740992'])('retains invalid input %s for correction without rounding it', raw => {
  render(<Editor />);
  const field = screen.getByLabelText('Net amount (MXN, net of tax)');
  fireEvent.change(field, { target: { value: raw } });
  expect(field).toHaveValue(raw);
  expect(screen.getByTestId('minor')).toHaveTextContent('invalid');
});

test.each([['JPY', '12', '12'], ['KWD', '12.345', '12345']])('respects %s minor-unit precision', (currency, raw, minor) => {
  render(<Editor currency={currency} />);
  fireEvent.change(screen.getByLabelText(`Net amount (${currency}, net of tax)`), { target: { value: raw } });
  expect(screen.getByTestId('minor')).toHaveTextContent(minor);
});