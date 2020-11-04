/// <reference types="cypress" />

context('Waiting', function () {
  beforeEach(function () {
    cy.visit('https://example.cypress.io/commands/waiting');
  });
  // BE CAREFUL of adding unnecessary wait times.
  // https://on.cypress.io/best-practices#Unnecessary-Waiting

  // https://on.cypress.io/wait
  it('cy.wait() - wait for a specific amount of time', function () {
    cy.get('.wait-input1').type('Wait timeoutms after typing');
    cy.get('.wait-input2').type('Wait timeoutms after typing');
    cy.get('.wait-input3').type('Wait timeoutms after typing');
  });

  it('cy.wait() - wait for a specific route', function () {
    cy.server();

    // Listen to GET to comments/1
    cy.route('GET', 'comments/*').as('getComment');

    // we have code that gets a comment when
    // the button is clicked in scripts.js
    cy.get('.network-btn').click();

    // wait for GET comments/1
    cy.wait('@getComment').its('status').should('eq', 200);
  });
});