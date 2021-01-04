/// <reference types="cypress" />

context('Failing Test', function () {
  beforeEach(function () {
    cy.visit('https://example.cypress.io/commands/actions');
  });

  it('Failing as expected!', function () {
    cy.get('.action-email')
        .type('test@email.com').should('have.value', 'failing@email.com');
  });
});
