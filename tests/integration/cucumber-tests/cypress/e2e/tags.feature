Feature: Suite env tags filtering

  @smoke
  Scenario: a scenario tagged @smoke runs
    Given a scenario tagged @smoke
    When the scenario runs
    Then it passes

  @other
  Scenario: a scenario tagged @other is filtered out
    Given a scenario tagged @other
    When the scenario runs
    Then it must not have run
