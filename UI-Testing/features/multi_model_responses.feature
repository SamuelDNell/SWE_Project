Feature: Multi-model responses

  Scenario: A logged-in user compares three model responses for one prompt
    Given I am logged in and on the home page
    When I start a new comparison chat
    And I submit a prompt for comparison
    Then I should see three model response cards
    And each response card should be labeled with its model name
