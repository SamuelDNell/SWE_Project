Feature: Weather Tool Calling
  As a Rutgers student
  I want to ask about the weather in any city
  So that the AI fetches real-time data instead of guessing

  Background:
    Given I am registered and logged in
    And I have an active chat

  Scenario: Weather question via Ollama returns current conditions for the city
    When I ask about the weather in "New York" using Ollama
    Then the chat response should contain "New York"

  Scenario: Weather question via Groq returns current conditions for the city
    When I ask about the weather in "London" using Groq
    Then the chat response should contain "London"

  Scenario: Ollama receives weather tool instructions in the system prompt
    When I send a plain message using Ollama
    Then the Ollama system prompt should contain "get_weather"

  Scenario: Groq receives weather tool instructions in the system prompt
    When I send a plain message using Groq
    Then the Groq system prompt should contain "get_weather"

  Scenario: Groq request includes both the weather and math tools
    When I send a plain message using Groq
    Then the Groq request tools should include "get_weather"
    And the Groq request tools should include "solve_math"

  Scenario: An unknown city is handled gracefully without crashing
    When I ask about the weather in an unknown city using Ollama
    Then the chat request should succeed
