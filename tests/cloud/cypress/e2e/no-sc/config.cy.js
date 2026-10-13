/// <reference types="cypress" />

context('Actions', function () {
  beforeEach(function () {
    cy.visit('https://example.cypress.io/commands/actions');
  });

  // https://on.cypress.io/interacting-with-elements

  it('reads suite env via Cypress.expose', function () {
    expect(Cypress.version).to.match(/^16\./);
    expect(Cypress.expose('foo')).to.equal('bar');
    expect(Cypress.expose('SAUCE_SUITE_NAME')).to.match(/^Cypress - /);
    expect(Cypress.expose('SAUCE_ARTIFACTS_DIRECTORY'))
      .to.be.a('string')
      .and.have.length.above(0);
  });
});
