/// <reference types="cypress" />

context('Actions', function () {
  beforeEach(function () {
    cy.step('open a page');
    cy.visit('https://example.cypress.io/commands/actions');
  });

  // https://on.cypress.io/interacting-with-elements

  it('should use cypress.json', function () {
    cy.step('running assertions');
    expect(Cypress.env('foo')).to.equal('bar');
  });
});
