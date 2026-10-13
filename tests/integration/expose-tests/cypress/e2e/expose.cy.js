/// <reference types="cypress" />

context('Cypress.expose precedence', function () {
  it('keeps the runner values when a suite env defines the same keys', function () {
    expect(Cypress.expose('SAUCE_SUITE_NAME')).to.equal('default');
    expect(Cypress.expose('SAUCE_ARTIFACTS_DIRECTORY')).to.match(/__assets__$/);
  });

  it('merges suite env values with the expose block of the cypress config', function () {
    expect(Cypress.expose('FROM_CONFIG')).to.equal('config-value');
    expect(Cypress.expose('SHARED')).to.equal('suite-value');
  });

  it('cy.env returns the suite value when a suite env collides with a runner key (documented split)', function () {
    cy.env(['SAUCE_SUITE_NAME', 'SAUCE_ARTIFACTS_DIRECTORY']).then(
      ({ SAUCE_SUITE_NAME, SAUCE_ARTIFACTS_DIRECTORY }) => {
        expect(SAUCE_SUITE_NAME).to.equal('suite-override');
        expect(SAUCE_ARTIFACTS_DIRECTORY).to.equal('/suite/override');
      },
    );
  });

  it('keeps the CYPRESS_ prefix on Cypress.expose and strips it on cy.env', function () {
    expect(Cypress.expose('CYPRESS_PREF')).to.equal('pref-value');
    expect(Cypress.expose('PREF')).to.equal(undefined);
    cy.env(['PREF']).then(({ PREF }) => {
      expect(PREF).to.equal('pref-value');
    });
  });
});
