Feature: Multi-model chat comparison

  As a registered user
  I want to send one prompt to multiple language models simultaneously
  So that I can compare different model responses without multiple requests

  Scenario: Send one prompt to multiple models
    Given I am a registered user
    When I send a message "Hello models"
    Then the backend sends the prompt to "llama3.2:latest" and "phi"
    And I receive responses from both models
    And both responses appear in the same chat

  Scenario: Each response includes model name
    Given I have sent a message "Hello models"
    When the responses are returned
    Then each response includes its model name
    And I see "llama3.2:latest" or "phi" above each response

  Scenario: Chat history stores all responses
    Given I have an existing conversation
    When I reopen the chat
    Then I see the original user message once
    And I see responses from both models
    And all messages appear in order