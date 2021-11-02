context('Sauce-Connect', function () {
  beforeEach(function () {
    cy.visit('http://127.0.0.1:8000/');
  });

  it('sc connection working', function () {
    cy.title().should('eq', 'Simple Page');
  });
});
