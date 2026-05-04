Feature: Math Tool Calling
  As a Rutgers student
  I want the AI to use a precise math solver for calculations
  So that I receive accurate answers instead of hallucinated ones

  Background:
    Given I am registered and logged in
    And I have an active chat

  Scenario: Math question via Ollama returns the correct answer after a tool call
    When I send the math question "What is sqrt(144)?" using Ollama
    Then the chat response should contain "12"

  Scenario: Math question via Groq returns the correct answer after a tool call
    When I send the math question "What is 2 + 2?" using Groq
    Then the chat response should contain "4"

  Scenario: Ollama receives math tool instructions in the system prompt
    When I send a plain message using Ollama
    Then the Ollama system prompt should contain "solve_math"

  Scenario: Groq receives math tool instructions in the system prompt
    When I send a plain message using Groq
    Then the Groq system prompt should contain "solve_math"

  Scenario: Ollama request includes both the math and weather tools
    When I send a plain message using Ollama
    Then the Ollama request tools should include "solve_math"
    And the Ollama request tools should include "get_weather"

  Scenario: The solve_math tool handles an invalid expression without crashing
    When the solve_math tool is called directly with expression "invalid###"
    Then the math tool result should have an error field
