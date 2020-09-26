/// <reference types="cypress" />

context('Actions', () => {
    beforeEach(() => {
      cy.visit('https://example.cypress.io/commands/actions')
    })
  
    it('should use .env.json', () => {
      expect(Cypress.env('foo')).to.equal('BAR');
    })
  })
  