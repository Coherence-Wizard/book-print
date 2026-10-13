import assert from 'node:assert/strict';
import { test } from 'node:test';
import { savedShippingAddress, projectShippingAddress, SHIPPING_COUNTRIES, shippingRegions, normalizeShippingRegion, regionOptions, shippingDetailIssues, shippingDetailsMessage } from '@book-print/shared';

test('Saved Settings fill an empty resumed project and missing email/phone without replacing project edits', () => {
  const defaults={fullName:'Default Reader',addressLine1:'10 Main St',city:'Toronto',state:'ON',postalCode:'M5V 1A1',country:'CA',email:'reader@example.test',phone:'555-0100'};
  const empty={fullName:'',addressLine1:'',city:'',state:'',postalCode:'',country:'US',email:'',phone:''};
  assert.deepEqual(savedShippingAddress(empty,defaults),{addressLine2:'',...defaults});
  const edited={...defaults,fullName:'Gift Recipient',addressLine1:'20 Other St',email:'',phone:''};
  const merged=savedShippingAddress(edited,defaults);
  assert.equal(merged.fullName,'Gift Recipient');assert.equal(merged.addressLine1,'20 Other St');
  assert.equal(merged.email,defaults.email);assert.equal(merged.phone,defaults.phone);
  merged.city='Changed';assert.equal(defaults.city,'Toronto');assert.equal(edited.city,'Toronto');
});
test('Address menus normalize older state names, use country-specific regions, and preserve unknown saved values', () => {
  assert.ok(SHIPPING_COUNTRIES.some(c=>c.value==='US'&&c.label==='United States'));
  assert.equal(normalizeShippingRegion('US','Washington'),'WA');
  assert.equal(normalizeShippingRegion('US','US-WA'),'WA');
  assert.equal(normalizeShippingRegion('CA','Ontario'),'ON');
  assert.ok(shippingRegions('CA').some(r=>r.value==='ON'));
  assert.ok(!shippingRegions('CA').some(r=>r.value==='WA'));
  assert.ok(regionOptions('GB','Saved Region').some(r=>r.value==='Saved Region'));
  assert.equal(regionOptions('CA','')[0].value,'');
});
test('Missing contact details identify email and phone even with a complete postal address', () => {
  const address = { fullName: 'Test Reader', addressLine1: '10 Main St', city: 'Seattle', state: 'WA', postalCode: '98101', country: 'US', email: '', phone: '   ' };
  const issues = shippingDetailIssues(address);
  assert.deepEqual(issues.map(issue => issue.field), ['email', 'phone']);
  assert.equal(shippingDetailsMessage(issues), 'Missing email. Missing phone number.');
  assert.equal(shippingDetailIssues({ ...address, email: 'reader@example.com', phone: '555-0100' }).length, 0);
  assert.deepEqual(shippingDetailIssues({ ...address, email: 'broken', phone: '555-0100', state: '' }).map(issue => issue.field), ['email', 'state']);
});
test('Shipping summaries follow Settings while deliberate project recipients retain empty optional fields', () => {
  const defaults = { fullName: 'Saved Reader', addressLine1: '10 Main St', addressLine2: 'Unit 2', city: 'Seattle', state: 'WA', postalCode: '98101', country: 'US', email: 'reader@example.test', phone: '555-0100' };
  const legacy = projectShippingAddress({ shippingAddress: { ...defaults, state: 'Washington' } }, defaults);
  assert.equal(legacy.shippingAddressSource, 'settings');
  assert.equal(projectShippingAddress(legacy, { ...defaults, addressLine1: '30 New St' }).shippingAddress.addressLine1, '30 New St');
  const gift = { ...defaults, fullName: 'Gift Recipient', addressLine1: '20 Other St', addressLine2: '', state: '', country: 'GB' };
  const custom = projectShippingAddress({ shippingAddress: gift, shippingAddressSource: 'custom' }, defaults);
  assert.deepEqual(custom.shippingAddress, gift);
  assert.equal(projectShippingAddress(custom, defaults).shippingAddress.addressLine2, '');
  assert.equal(custom.shippingAddress.state, '');
  custom.shippingAddress.city = 'Changed';
  assert.equal(gift.city, 'Seattle');
  assert.equal(defaults.addressLine1, '10 Main St');
  assert.equal(projectShippingAddress({ shippingAddress: gift }, defaults).shippingAddressSource, 'custom');
});
