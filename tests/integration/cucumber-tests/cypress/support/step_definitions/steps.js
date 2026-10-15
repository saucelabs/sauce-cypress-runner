const {
  Given,
  When,
  Then,
} = require('@badeball/cypress-cucumber-preprocessor');

Given('a scenario tagged {word}', function (tag) {
  cy.wrap(tag).as('tag');
});

When('the scenario runs', function () {
  cy.get('@tag').should('be.a', 'string');
});

Then('it passes', function () {
  cy.get('@tag').should('equal', '@smoke');
});

Then('it must not have run', function () {
  throw new Error('scenario tagged @other ran: tags filtering is broken');
});
