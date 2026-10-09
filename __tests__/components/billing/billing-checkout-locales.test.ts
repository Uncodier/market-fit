import en from '@/app/context/locales/en.json'
import es from '@/app/context/locales/es.json'
import fr from '@/app/context/locales/fr.json'
import de from '@/app/context/locales/de.json'
import ja from '@/app/context/locales/ja.json'

const checkoutKeys = ['title', 'description', 'credits', 'pricePerCredit', 'discount', 'total',
  'paymentMethod', 'savedCard', 'securePayment', 'encryption', 'authentication', 'processing', 'confirm']
const addonKeys = ['add', 'remove', 'count', 'target', 'confirm', 'increaseNotice', 'reduceNotice',
  'pending', 'paid', 'scheduled']

it.each([['English', en], ['Spanish', es], ['French', fr], ['German', de], ['Japanese', ja]])(
  '%s includes all credit checkout and add-on control translations', (_, messages) => {
    for (const key of checkoutKeys.map(key => `billing.checkout.${key}`)
      .concat(addonKeys.map(key => `billing.addons.${key}`))) {
      expect(messages[key as keyof typeof messages]).toEqual(expect.any(String))
      expect(messages[key as keyof typeof messages]).not.toBe(key)
    }
  })