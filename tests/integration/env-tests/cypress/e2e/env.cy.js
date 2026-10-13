/// <reference types="cypress" />

context('Actions', function () {
  it('reads env values synchronously with Cypress.expose', function () {
    expect(Cypress.expose('FOO')).to.equal('bar');
    expect(Cypress.expose('VALUE')).to.equal('Some test value');
    expect(Cypress.expose('host')).to.equal(
      'http://devexpress.github.io/testcafe/example',
    );
    expect(Cypress.expose('SAUCE_SUITE_NAME')).to.equal('default');
    expect(Cypress.expose('SAUCE_ARTIFACTS_DIRECTORY')).to.match(/__assets__$/);
    cy.visit(Cypress.expose('host'));
    cy.get('#developer-name').type('devx');
    cy.get('#submit-button').click();
    cy.get('#article-header').should('have.text', 'Thank you, devx!');
  });

  it('reads env values with cy.env', function () {
    cy.env([
      'FOO',
      'VALUE',
      'host',
      'SAUCE_SUITE_NAME',
      'SAUCE_ARTIFACTS_DIRECTORY',
      'foo',
    ]).then(
      ({
        FOO,
        VALUE,
        host,
        SAUCE_SUITE_NAME,
        SAUCE_ARTIFACTS_DIRECTORY,
        foo,
      }) => {
        expect(FOO).to.equal('bar');
        expect(VALUE).to.equal('Some test value');
        expect(host).to.equal('http://devexpress.github.io/testcafe/example');
        expect(SAUCE_SUITE_NAME).to.equal('default');
        expect(SAUCE_ARTIFACTS_DIRECTORY)
          .to.be.a('string')
          .and.match(/__assets__$/);
        expect(SAUCE_ARTIFACTS_DIRECTORY).to.equal(
          Cypress.expose('SAUCE_ARTIFACTS_DIRECTORY'),
        );
        // `foo` comes from cypress.env.json, which only `cy.env()` reads.
        expect(foo).to.equal('BAR');
      },
    );
  });
});
