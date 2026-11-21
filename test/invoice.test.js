var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice GST and total match what order pricing billed for HSN-only lines', function () {
  // This matches the line shape assembled by routes/orders.js: no gstRate is stored.
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(billed.lines[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
  assert.equal(invoiceFigures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
});

test('invoice uses the same coupon and post-discount GST figures as order pricing', function () {
  var items = [{ id: 2, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  // Billing discounts the ₹100 subtotal, then applies 5% GST to ₹95.
  assert.equal(billed.discount, 5);
  assert.equal(billed.tax, 4.75);
  assert.equal(billed.total, 99.75);

  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
});

test('GST reconciliation matches the invoice against the figures stored at billing', function () {
  var items = [{ id: 3, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WELCOME');
  var order = {
    id: 42,
    date: '2026-11-21',
    customer: 'In-memory customer',
    items: items,
    coupon: 'WELCOME',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  var result = reports.getGstReconciliation({ orders: [order], products: [], customers: [] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 42,
    date: '2026-11-21',
    customer: 'In-memory customer',
    coupon: 'WELCOME',
    ledgerSubtotal: 100,
    ledgerDiscount: 5,
    ledgerTax: 4.75,
    ledgerTotal: 99.75,
    invoiceDiscount: 5,
    invoiceTax: 4.75,
    invoiceTotal: 99.75,
    delta: 0,
    matched: true
  });
});
