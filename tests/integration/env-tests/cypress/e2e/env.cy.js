/// <reference types="cypress" />

context('Actions', function () {
  it('should use host', function () {
    expect(Cypress.expose('FOO')).to.equal('bar');
    expect(Cypress.expose('VALUE')).to.equal('Some test value');
    expect(Cypress.expose('host')).to.equal(
      'http://devexpress.github.io/testcafe/example',
    );
    expect(Cypress.expose('SAUCE_SUITE_NAME')).to.equal('default');
    // A suite's TAGS is copied to the lowercase `tags` that cucumber 28 reads,
    // and wins over `tags` as it did in cucumber 24.
    expect(Cypress.expose('tags')).to.equal('@smoke');
    expect(Cypress.expose('SAUCE_ARTIFACTS_DIRECTORY'))
      .to.be.a('string')
      .with.length.greaterThan(0);
    // cypress.env.json values stay in the Node process: cy.env() reads them,
    // Cypress.expose() does not.
    expect(Cypress.expose('foo')).to.equal(undefined);
    cy.env([
      'FOO',
      'VALUE',
      'host',
      'foo',
      'tags',
      'SAUCE_SUITE_NAME',
      'SAUCE_ARTIFACTS_DIRECTORY',
    ]).then((env) => {
      expect(env.FOO).to.equal('bar');
      expect(env.VALUE).to.equal('Some test value');
      expect(env.host).to.equal('http://devexpress.github.io/testcafe/example');
      expect(env.foo).to.equal('BAR');
      expect(env.tags).to.equal('@smoke');
      expect(env.SAUCE_SUITE_NAME).to.equal('default');
      expect(env.SAUCE_ARTIFACTS_DIRECTORY).to.equal(
        Cypress.expose('SAUCE_ARTIFACTS_DIRECTORY'),
      );
    });
    cy.visit(Cypress.expose('host'));
    cy.get('#developer-name').type('devx');
    cy.get('#submit-button').click();
    cy.get('#article-header').should('have.text', 'Thank you, devx!');
  });
});
