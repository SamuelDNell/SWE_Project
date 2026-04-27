Feature: Multi-LLM comparison
  As a user of the chat interface
  I want to receive outputs from multiple LLMs at once
  So that I can compare their answers and choose the best one

  Scenario: Compare outputs from multiple models and keep one preferred answer
    Given I am on the home page
    When I select the following models:
      | llama3.2:latest |
      | llama3.1:latest |
    And I send the message "What is software engineering?"
    Then I should see model outputs for:
      | llama3.2:latest |
      | llama3.1:latest |
    And I should see a "Use this answer" button for each model output
    When I choose the response from "llama3.1:latest"
    Then only that model output remains
    And I should be in single model mode
