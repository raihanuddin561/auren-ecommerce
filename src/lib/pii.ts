/**
 * Personal data must not be copied into the outbox or the audit trail: those tables are append-only
 * and long lived, so anything written there cannot be erased for a customer who asks for deletion,
 * and they are read by far more systems than the customer tables. Events and audit entries carry
 * identifiers; a consumer that needs a name or an address loads it by id at the time it needs it.
 *
 * The check is by key name (a value cannot be classified reliably): a key is personal when one of
 * its words names a person-identifying field, unless it is clearly a reference (`addressId`),
 * a flag (`emailVerified`) or a digest (`phoneHash`).
 */

const PII_WORDS = new Set([
  'email',
  'emails',
  'mail',
  'phone',
  'phones',
  'mobile',
  'msisdn',
  'tel',
  'telephone',
  'whatsapp',
  'address',
  'addresses',
  'street',
  'landmark',
  'postcode',
  'zip',
  'dob',
  'birthdate',
  'birthday',
  'nid',
  'ip',
  'ipaddress',
  'useragent',
  'firstname',
  'lastname',
  'fullname',
  'surname',
  'givenname',
  'familyname',
  'displayname',
  'receivername',
  'recipientname',
  'customername',
  'shippingname',
  'billingname',
  'contactname',
  'username',
]);

/** A trailing word that makes the key a reference, a flag or a digest rather than the data. */
const NON_PERSONAL_SUFFIX = new Set([
  'id',
  'ids',
  'verified',
  'hash',
  'hashed',
  'count',
  'at',
  'status',
  'type',
  'kind',
  'fingerprint',
  'present',
  'enabled',
  'required',
]);

const words = (key: string): string[] =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());

/** True for object keys that name personal data (email, phone, name parts, address, IP...). */
export function isPiiKey(key: string): boolean {
  const parts = words(key);
  if (parts.length === 0) return false;
  if (NON_PERSONAL_SUFFIX.has(parts[parts.length - 1]!)) return false;
  if (parts.some((part) => PII_WORDS.has(part))) return true;
  // Name parts written as separate words: first name, last name, customer name.
  const joined = parts.join('');
  if (PII_WORDS.has(joined)) return true;
  return ['firstname', 'lastname', 'fullname', 'givenname', 'familyname', 'useragent'].some((c) =>
    joined.includes(c),
  );
}

/** Dotted paths of every personal-data key in a value, for tests and for the outbox guard. */
export function findPiiKeys(value: unknown, path = '', depth = 0): string[] {
  if (depth > 12 || value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findPiiKeys(item, `${path}[${index}]`, depth + 1));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    const here = path ? `${path}.${key}` : key;
    return [...(isPiiKey(key) ? [here] : []), ...findPiiKeys(item, here, depth + 1)];
  });
}
