import { render, screen } from '@testing-library/react';
import { VisitIdentityFields } from '@/app/visits/components/VisitIdentityFields';

jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));

test('visit identity labels identify their inputs and expose invalid contact state', () => {
  render(<VisitIdentityFields mode="kiosk" visitorName="" visitorEmail="invalid" visitorPhone=""
    emailError="Invalid email" onNameChange={jest.fn()} onEmailChange={jest.fn()} onPhoneChange={jest.fn()} />);
  expect(screen.getByLabelText('visits.fields.fullName')).toHaveAttribute('autocomplete', 'name');
  expect(screen.getByLabelText('visits.fields.email')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('visits.fields.phone')).toHaveAttribute('autocomplete', 'tel');
});

test('multiple visit identity forms retain distinct label associations', () => {
  const props = { mode: 'kiosk' as const, visitorName: '', visitorEmail: '', visitorPhone: '',
    onNameChange: jest.fn(), onEmailChange: jest.fn(), onPhoneChange: jest.fn() };
  render(<><VisitIdentityFields {...props} /><VisitIdentityFields {...props} /></>);
  const names = screen.getAllByLabelText('visits.fields.fullName');
  expect(names).toHaveLength(2);
  expect(names[0].id).not.toBe(names[1].id);
});