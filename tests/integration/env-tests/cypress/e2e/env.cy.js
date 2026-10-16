/// <reference types="cypress" />

context('Actions', function () {
  it('should use host', function () {
    expect(Cypress.expose('FOO')).to.equal('bar');
    expect(Cypress.expose('VALUE')).to.equal('Some test value');
    expect(Cypress.expose('host')).to.equal(
      'http://devexpress.github.io/testcafe/example',
    );
    expect(Cypress.expose('SAUCE_SUITE_NAME')).to.equal('default');
    cy.visit(Cypress.expose('host'));
    cy.get('#developer-name').type('devx');
    cy.get('#submit-button').click();
    cy.get('#article-header').should('have.text', 'Thank you, devx!');
  });
});
