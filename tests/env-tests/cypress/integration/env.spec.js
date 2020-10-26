/// <reference types="cypress" />

const { shouldRecordVideo } = require('../../../../src/utils');

context('Actions', function () {
  beforeEach(function () {
    cy.visit('https://example.cypress.io/commands/actions');
  });

  it('should use .env.json', function () {
    expect(Cypress.env('foo')).to.equal('BAR');
  });

  it('should skip recording cypress video', function () {
    expect(shouldRecordVideo()).to.not.equal('true');
  });
});
