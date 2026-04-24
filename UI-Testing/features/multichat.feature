Feature: Multi-LLM Chat Comparison
  As a student
  I want to compare responses from three different LLMs
  So that I can choose the best answer for my question

  Background:
    Given I am logged in and on the home page

  Scenario: Send message in Compare Mode
    Given I select "Compare 3 LLMs" from the model dropdown
    When I enter "Explain quantum computing" and press send
    Then I should see a generating message for multiple responses
    And I should eventually see three different response options
    And each option should display its model name

  Scenario: Select a response from Comparison
    Given I have sent a message in Compare Mode
    And three response options are displayed
    When I click "Select this response" on the first option
    Then the comparison grid should disappear
    And the selected response should be added to the main chat history
    And the model name of the selected response should be visible above it