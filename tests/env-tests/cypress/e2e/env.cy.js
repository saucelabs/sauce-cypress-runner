/// <reference types="cypress" />

context('Actions', function () {
  it('should use host', function () {
    expect(Cypress.env('FOO')).to.equal('bar');
    expect(Cypress.env('VALUE')).to.equal('Some test value');
    expect(Cypress.env('host')).to.equal('https://training.staging.saucelabs.net/');
    cy.visit(Cypress.env('host'));
    cy.title().should('eq', 'Sauce School Training | Sauce Labs');
  });
});
