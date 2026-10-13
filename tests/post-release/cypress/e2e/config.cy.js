/// <reference types="cypress" />

context('Actions', function () {
  beforeEach(function () {
    cy.step('open a page');
    cy.visit('https://example.cypress.io/commands/actions');
  });

  // https://on.cypress.io/interacting-with-elements

  it('reads suite env via Cypress.expose', function () {
    cy.step('running assertions');
    expect(Cypress.version).to.match(/^16\./);
    expect(Cypress.expose('foo')).to.equal('bar');
  });
});
