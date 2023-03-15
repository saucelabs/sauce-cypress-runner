/// <reference types="cypress" />

context('Actions', function () {
  it('should use host', function () {
    expect(Cypress.env('FOO')).to.equal('bar');
    expect(Cypress.env('VALUE')).to.equal('Some test value');
    expect(Cypress.env('host')).to.equal('https://saucelabs.com/');
    expect(Cypress.env('SAUCE_SUITE_NAME')).to.equal('default');
    expect(Cypress.env('SAUCE_ARTIFACTS_DIRECTORY')).to.equal('/home/runner/work/sauce-cypress-runner/sauce-cypress-runner/tests/env-tests/__assets__');
    cy.visit(Cypress.env('host'));
    cy.title().should('eq', 'Join our Community | Sauce Labs');
  });
});
