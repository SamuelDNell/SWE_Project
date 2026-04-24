Feature: Multi-LLM Chat

  Scenario: User receives responses from multiple models
    Given the user is on the chat page
    When the user enters a prompt
    Then the system returns responses from 3 models

  Scenario: Responses are formatted correctly
    Given a user sends a message
    Then each response should include Model 1, Model 2, and Model 3