/// <reference types="cypress" />

context('Failing Test', function () {
  it('Failing as expected!', function () {
    expect(true).to.equal(false);
  });
});
