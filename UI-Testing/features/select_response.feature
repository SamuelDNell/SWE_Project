Feature: Select one model response

  Scenario: A user selects one response and continues with that model
    Given I am logged in and have received multiple model responses
    When I select one of the successful model responses
    Then the selected model should become active
    When I send a follow-up message in the selected chat
    Then the conversation should continue in single-model mode
