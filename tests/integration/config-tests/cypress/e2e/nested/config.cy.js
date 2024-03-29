/// <reference types="cypress" />

context('Actions', function () {
  beforeEach(function () {
    cy.visit('https://example.cypress.io/commands/actions');
  });
  it('.type() - type into a DOM element', function () {
    // https://on.cypress.io/type
    cy.get('.action-email').type('fake@email.com');
    cy.get('.action-email').should('have.value', 'fake@email.com');
  });
});
