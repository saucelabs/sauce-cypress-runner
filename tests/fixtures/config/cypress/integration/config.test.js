/// <reference types="cypress" />

context('Actions', function () {
  beforeEach(function () {
    cy.visit('https://example.cypress.io/commands/actions');
  });

  // https://on.cypress.io/interacting-with-elements

  it('should use cypress.json', function () {
    console.log('!!!!!', Cypress.env('foo'));
    expect(Cypress.env('foo')).to.equal('bar');
  });
});
