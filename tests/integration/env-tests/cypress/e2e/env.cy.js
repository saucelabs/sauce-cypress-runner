/// <reference types="cypress" />

context('Getting Started', function () {
  const testName = 'cypress test';
  it(testName, function () {
    expect(Cypress.env('FOO')).to.equal('bar');
    expect(Cypress.env('VALUE')).to.equal('Some test value');
    expect(Cypress.env('host')).to.equal(
      'http://devexpress.github.io/testcafe/example',
    );
    expect(Cypress.env('SAUCE_SUITE_NAME')).to.equal('default');
    cy.visit(Cypress.env('host'));
    cy.get('#developer-name').type('devx');
    cy.get('#submit-button').click();
    cy.get('#article-header').should('have.text', 'Thank you, devx!');
  });
});
