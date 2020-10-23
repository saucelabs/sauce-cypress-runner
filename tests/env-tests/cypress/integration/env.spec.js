/// <reference types="cypress" />

context('Actions', function () {
  beforeEach(function () {
    cy.visit('https://example.cypress.io/commands/actions');
  });

  it('should use .env.json', function () {
    expect(Cypress.env('foo')).to.equal('BAR');
  });

  it('should stop recording cypress video', function () {
    expect(process.env.SAUCE_CYPRESS_VIDEO_RECORDING).to.equal('false');
  });
});
